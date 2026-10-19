import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseResourceSetRules, slugifyResourceName, type CatalogRef, type ResourceSetKind } from '$lib/studies/resource-sets';
import { GENRES, type Genre } from '$lib/types/library';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trimOrNull(v: FormDataEntryValue | null): string | null {
	if (v === null || v === undefined) return null;
	const t = String(v).trim();
	return t.length > 0 ? t : null;
}

function parseRefs(fd: FormData): { ok: true; refs: CatalogRef[] } | { ok: false; message: string } {
	const essayId = trimOrNull(fd.get('essay_id'));
	const bookIds = [
		...new Set(
			fd
				.getAll('book_id')
				.map((value) => trimOrNull(value))
				.filter((value): value is string => !!value)
		)
	];
	if (essayId && bookIds.length > 0) return { ok: false, message: 'Pick a book or an essay.' };
	if (essayId) {
		if (!UUID_RE.test(essayId)) return { ok: false, message: 'Invalid essay.' };
		return { ok: true, refs: [{ bookId: null, essayId }] };
	}
	if (bookIds.length === 0) return { ok: false, message: 'Missing catalog row.' };
	if (bookIds.some((id) => !UUID_RE.test(id))) return { ok: false, message: 'Invalid book.' };
	return { ok: true, refs: bookIds.map((bookId) => ({ bookId, essayId: null })) };
}

async function refMatchesRules(
	supabase: SupabaseClient,
	rules: ReturnType<typeof parseResourceSetRules>,
	ref: CatalogRef
): Promise<boolean> {
	for (const rule of rules) {
		if (rule.kind === 'genre' && ref.bookId) {
			const { data, error } = await supabase
				.from('books')
				.select('id')
				.eq('id', ref.bookId)
				.eq('genre', rule.value)
				.is('deleted_at', null)
				.maybeSingle();
			if (error) console.error('[studies] genre match', error);
			if (data) return true;
		}
		if (rule.kind === 'topic' && ref.bookId) {
			const { data, error } = await supabase
				.from('book_topics')
				.select('id')
				.eq('book_id', ref.bookId)
				.eq('topic', rule.value.toLowerCase())
				.is('deleted_at', null)
				.limit(1);
			if (error) console.error('[studies] topic match', error);
			if ((data ?? []).length > 0) return true;
		}
		if (rule.kind === 'bible_book') {
			let q = supabase
				.from('book_bible_coverage')
				.select('id, book_id, essay_id')
				.eq('bible_book', rule.value)
				.limit(1);
			q = ref.essayId ? q.eq('essay_id', ref.essayId) : q.eq('book_id', ref.bookId ?? '').is('essay_id', null);
			const { data, error } = await q;
			if (error) console.error('[studies] coverage match', error);
			const row = (data ?? [])[0] as { book_id: string | null; essay_id: string | null } | undefined;
			if (!row) continue;
			const bookId = ref.bookId ?? row.book_id;
			if (!bookId && ref.essayId) {
				const essay = await supabase
					.from('essays')
					.select('parent_book_id')
					.eq('id', ref.essayId)
					.is('deleted_at', null)
					.maybeSingle();
				if (essay.error) console.error('[studies] essay parent', essay.error);
				const parentId = (essay.data as { parent_book_id: string } | null)?.parent_book_id;
				if (!parentId) continue;
				const parent = await supabase
					.from('books')
					.select('id')
					.eq('id', parentId)
					.eq('genre', 'Commentary')
					.is('deleted_at', null)
					.maybeSingle();
				if (parent.data) return true;
				continue;
			}
			if (!bookId) continue;
			const book = await supabase
				.from('books')
				.select('id')
				.eq('id', bookId)
				.eq('genre', 'Commentary')
				.is('deleted_at', null)
				.maybeSingle();
			if (book.error) console.error('[studies] commentary genre', book.error);
			if (book.data) return true;
		}
	}
	return false;
}

async function liveMember(
	supabase: SupabaseClient,
	setId: string,
	ref: CatalogRef
): Promise<{ id: string; kind: string; bibliographical: boolean } | null> {
	let q = supabase
		.from('resource_set_members')
		.select('id, kind, bibliographical')
		.eq('set_id', setId)
		.is('deleted_at', null);
	q = ref.bookId ? q.eq('book_id', ref.bookId) : q.eq('essay_id', ref.essayId ?? '');
	const { data, error } = await q.maybeSingle();
	if (error) {
		console.error('[studies] live member', error);
		return null;
	}
	const row = data as { id: string; kind: string; bibliographical: boolean } | null;
	return row ? { ...row, bibliographical: row.bibliographical !== false } : null;
}

export async function markSetReviewedAction(supabase: SupabaseClient, fd: FormData) {
	const setId = trimOrNull(fd.get('set_id'));
	if (!setId || !UUID_RE.test(setId)) {
		return fail(400, { kind: 'markSetReviewed' as const, message: 'Invalid set.' });
	}
	const { error } = await supabase
		.from('resource_sets')
		.update({ last_reviewed_at: new Date().toISOString() } as never)
		.eq('id', setId)
		.is('deleted_at', null);
	if (error) {
		console.error('[studies] markSetReviewed', error);
		return fail(500, { kind: 'markSetReviewed' as const, setId, message: error.message });
	}
	return { kind: 'markSetReviewed' as const, setId, success: true as const };
}

export async function removeSetMemberAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const setId = trimOrNull(fd.get('set_id'));
	if (!setId || !UUID_RE.test(setId)) {
		return fail(400, { kind: 'removeSetMember' as const, message: 'Invalid set.' });
	}
	const parsed = parseRefs(fd);
	if (!parsed.ok) {
		return fail(400, { kind: 'removeSetMember' as const, setId, message: parsed.message });
	}
	for (const ref of parsed.refs) {
		const existing = await liveMember(supabase, setId, ref);
		if (existing?.kind === 'exclude') continue;
		if (existing) {
			const { error } = await supabase
				.from('resource_set_members')
				.update({ kind: 'exclude' } as never)
				.eq('id', existing.id);
			if (error) {
				console.error('[studies] remove member update', error);
				return fail(500, { kind: 'removeSetMember' as const, setId, message: error.message });
			}
			continue;
		}
		const { error } = await supabase.from('resource_set_members').insert({
			set_id: setId,
			book_id: ref.bookId,
			essay_id: ref.essayId,
			kind: 'exclude',
			created_by: userId
		} as never);
		if (error) {
			console.error('[studies] remove member insert', error);
			return fail(500, { kind: 'removeSetMember' as const, setId, message: error.message });
		}
	}
	return { kind: 'removeSetMember' as const, setId, success: true as const };
}

export async function restoreSetMemberAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const setId = trimOrNull(fd.get('set_id'));
	if (!setId || !UUID_RE.test(setId)) {
		return fail(400, { kind: 'restoreSetMember' as const, message: 'Invalid set.' });
	}
	const parsed = parseRefs(fd);
	if (!parsed.ok) {
		return fail(400, { kind: 'restoreSetMember' as const, setId, message: parsed.message });
	}
	const setRes = await supabase
		.from('resource_sets')
		.select('rules')
		.eq('id', setId)
		.is('deleted_at', null)
		.maybeSingle();
	if (setRes.error || !setRes.data) {
		return fail(404, {
			kind: 'restoreSetMember' as const,
			setId,
			message: setRes.error?.message ?? 'Set not found.'
		});
	}
	const rules = parseResourceSetRules((setRes.data as { rules: unknown }).rules);
	for (const ref of parsed.refs) {
		const matches = await refMatchesRules(supabase, rules, ref);
		const existing = await liveMember(supabase, setId, ref);
		if (!existing) {
			if (matches) continue;
			const { error } = await supabase.from('resource_set_members').insert({
				set_id: setId,
				book_id: ref.bookId,
				essay_id: ref.essayId,
				kind: 'include',
				created_by: userId
			} as never);
			if (error) {
				console.error('[studies] restore insert', error);
				return fail(500, { kind: 'restoreSetMember' as const, setId, message: error.message });
			}
			continue;
		}
		if (existing.kind === 'include') continue;
		if (matches && existing.bibliographical) {
			const { error } = await supabase
				.from('resource_set_members')
				.update({ deleted_at: new Date().toISOString() } as never)
				.eq('id', existing.id);
			if (error) {
				console.error('[studies] restore soft-delete', error);
				return fail(500, { kind: 'restoreSetMember' as const, setId, message: error.message });
			}
			continue;
		}
		const { error } = await supabase
			.from('resource_set_members')
			.update({ kind: 'include' } as never)
			.eq('id', existing.id);
		if (error) {
			console.error('[studies] restore to include', error);
			return fail(500, { kind: 'restoreSetMember' as const, setId, message: error.message });
		}
	}
	return { kind: 'restoreSetMember' as const, setId, success: true as const };
}

export async function setMemberBibliographicalAction(supabase: SupabaseClient, userId: string, fd: FormData) {
	const setId = trimOrNull(fd.get('set_id'));
	if (!setId || !UUID_RE.test(setId)) {
		return fail(400, { kind: 'setBibliographical' as const, message: 'Invalid set.' });
	}
	const parsed = parseRefs(fd);
	if (!parsed.ok) {
		return fail(400, { kind: 'setBibliographical' as const, setId, message: parsed.message });
	}
	const bibliographical = fd.get('bibliographical') === 'true';
	for (const ref of parsed.refs) {
		const existing = await liveMember(supabase, setId, ref);
		if (existing) {
			const { error } = await supabase
				.from('resource_set_members')
				.update({ bibliographical } as never)
				.eq('id', existing.id);
			if (error) {
				console.error('[studies] set bibliographical', error);
				return fail(500, { kind: 'setBibliographical' as const, setId, message: error.message });
			}
			continue;
		}
		const { error } = await supabase.from('resource_set_members').insert({
			set_id: setId,
			book_id: ref.bookId,
			essay_id: ref.essayId,
			kind: 'include',
			bibliographical,
			created_by: userId
		} as never);
		if (error) {
			console.error('[studies] set bibliographical insert', error);
			return fail(500, { kind: 'setBibliographical' as const, setId, message: error.message });
		}
	}
	return { kind: 'setBibliographical' as const, setId, success: true as const };
}

const NAME_MAX = 80;

function parseName(raw: string | null, label: string): { ok: true; name: string } | { ok: false; message: string } {
	const name = raw?.trim() ?? '';
	if (!name) return { ok: false, message: `${label} is required.` };
	if (name.length > NAME_MAX) return { ok: false, message: `${label} must be ${NAME_MAX} characters or fewer.` };
	if (!slugifyResourceName(name)) return { ok: false, message: `${label} needs a letter or number.` };
	return { ok: true, name };
}

function parseGenre(raw: string | null): Genre | null {
	if (!raw) return null;
	return (GENRES as readonly string[]).includes(raw) ? (raw as Genre) : null;
}

async function liveSlugTaken(
	supabase: SupabaseClient,
	table: 'resource_sets' | 'resource_set_sections',
	slug: string
): Promise<boolean> {
	const { data, error } = await supabase
		.from(table)
		.select('id')
		.eq('slug', slug)
		.is('deleted_at', null)
		.limit(1);
	if (error) console.error('[studies] slug lookup', error);
	return (data ?? []).length > 0;
}

export async function createResourceSetSectionAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const parsed = parseName(trimOrNull(fd.get('name')), 'Section name');
	if (!parsed.ok) {
		return fail(400, { kind: 'createSection' as const, message: parsed.message });
	}
	const slug = slugifyResourceName(parsed.name);
	if (await liveSlugTaken(supabase, 'resource_set_sections', slug)) {
		return fail(400, { kind: 'createSection' as const, message: 'A section with that name already exists.' });
	}
	const { data: last, error: lastErr } = await supabase
		.from('resource_set_sections')
		.select('sort_order')
		.is('deleted_at', null)
		.order('sort_order', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (lastErr) console.error('[studies] section sort', lastErr);
	const sortOrder = ((last?.sort_order as number | undefined) ?? 0) + 1;
	const { error } = await supabase.from('resource_set_sections').insert({
		name: parsed.name,
		slug,
		set_kind: 'custom',
		locked: false,
		sort_order: sortOrder,
		created_by: userId
	});
	if (error) {
		console.error('[studies] create section', error);
		return fail(500, { kind: 'createSection' as const, message: error.message });
	}
	return { kind: 'createSection' as const, success: true as const };
}

export async function createResourceSetAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const sectionId = trimOrNull(fd.get('section_id'));
	if (!sectionId || !UUID_RE.test(sectionId)) {
		return fail(400, { kind: 'createSet' as const, message: 'Pick a section.' });
	}
	const parsed = parseName(trimOrNull(fd.get('name')), 'Set name');
	if (!parsed.ok) {
		return fail(400, { kind: 'createSet' as const, sectionId, message: parsed.message });
	}
	const genreRaw = trimOrNull(fd.get('genre'));
	const genre = parseGenre(genreRaw);
	if (genreRaw && !genre) {
		return fail(400, { kind: 'createSet' as const, sectionId, message: 'Unknown genre.' });
	}
	const sectionRes = await supabase
		.from('resource_set_sections')
		.select('id, set_kind, locked')
		.eq('id', sectionId)
		.is('deleted_at', null)
		.maybeSingle();
	if (sectionRes.error || !sectionRes.data) {
		return fail(404, {
			kind: 'createSet' as const,
			sectionId,
			message: sectionRes.error?.message ?? 'Section not found.'
		});
	}
	const section = sectionRes.data;
	if (section.locked || section.set_kind === 'bible_book') {
		return fail(400, {
			kind: 'createSet' as const,
			sectionId,
			message: 'Bible book sets stay tied to the canon.'
		});
	}
	const kind = section.set_kind as ResourceSetKind;
	if (kind !== 'language' && kind !== 'custom') {
		return fail(400, { kind: 'createSet' as const, sectionId, message: 'This section cannot take a new set.' });
	}
	const slug = slugifyResourceName(parsed.name);
	if (await liveSlugTaken(supabase, 'resource_sets', slug)) {
		return fail(400, { kind: 'createSet' as const, sectionId, message: 'A set with that name already exists.' });
	}
	const { data: last, error: lastErr } = await supabase
		.from('resource_sets')
		.select('sort_order')
		.eq('section_id', sectionId)
		.is('deleted_at', null)
		.order('sort_order', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (lastErr) console.error('[studies] set sort', lastErr);
	const sortOrder = ((last?.sort_order as number | undefined) ?? -1) + 1;
	const rules = genre ? [{ kind: 'genre' as const, value: genre }] : [];
	const { error } = await supabase.from('resource_sets').insert({
		name: parsed.name,
		slug,
		kind,
		section_id: sectionId,
		rules,
		sort_order: sortOrder,
		created_by: userId
	});
	if (error) {
		console.error('[studies] create set', error);
		return fail(500, { kind: 'createSet' as const, sectionId, message: error.message });
	}
	return { kind: 'createSet' as const, sectionId, success: true as const };
}

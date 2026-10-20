import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	catalogRefsFromGroupSources,
	parseResourceSetRules,
	slugifyResourceName,
	type CatalogRef,
	type ResourceSetKind
} from '$lib/studies/resource-sets';
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

type LiveMemberRow = {
	id: string;
	book_id: string | null;
	essay_id: string | null;
	kind: string;
	bibliographical: boolean;
};

function catalogKey(ref: CatalogRef): string {
	if (ref.essayId) return `e:${ref.essayId}`;
	if (ref.bookId) return `b:${ref.bookId}`;
	return '';
}

async function liveMembersForRefs(
	supabase: SupabaseClient,
	setId: string,
	refs: CatalogRef[]
): Promise<Map<string, LiveMemberRow>> {
	const out = new Map<string, LiveMemberRow>();
	const bookIds = [...new Set(refs.flatMap((r) => (r.bookId ? [r.bookId] : [])))];
	const essayIds = [...new Set(refs.flatMap((r) => (r.essayId ? [r.essayId] : [])))];
	const [booksRes, essaysRes] = await Promise.all([
		bookIds.length
			? supabase
					.from('resource_set_members')
					.select('id, book_id, essay_id, kind, bibliographical')
					.eq('set_id', setId)
					.in('book_id', bookIds)
					.is('deleted_at', null)
			: Promise.resolve({ data: [] as LiveMemberRow[], error: null }),
		essayIds.length
			? supabase
					.from('resource_set_members')
					.select('id, book_id, essay_id, kind, bibliographical')
					.eq('set_id', setId)
					.in('essay_id', essayIds)
					.is('deleted_at', null)
			: Promise.resolve({ data: [] as LiveMemberRow[], error: null })
	]);
	if (booksRes.error) console.error('[studies] live members books', booksRes.error);
	if (essaysRes.error) console.error('[studies] live members essays', essaysRes.error);
	for (const row of [...(booksRes.data ?? []), ...(essaysRes.data ?? [])] as LiveMemberRow[]) {
		const key = row.essay_id ? `e:${row.essay_id}` : row.book_id ? `b:${row.book_id}` : '';
		if (!key) continue;
		out.set(key, { ...row, bibliographical: row.bibliographical !== false });
	}
	return out;
}

type MemberKind = 'include' | 'exclude' | 'dismiss';

async function applyMemberKind(
	supabase: SupabaseClient,
	userId: string,
	setId: string,
	refs: CatalogRef[],
	kind: MemberKind
): Promise<{ ok: true } | { ok: false; message: string }> {
	const existing = await liveMembersForRefs(supabase, setId, refs);
	let rules: ReturnType<typeof parseResourceSetRules> | null = null;
	if (kind === 'include') {
		const setRes = await supabase
			.from('resource_sets')
			.select('rules')
			.eq('id', setId)
			.is('deleted_at', null)
			.maybeSingle();
		if (setRes.error || !setRes.data) {
			return { ok: false, message: setRes.error?.message ?? 'Set not found.' };
		}
		rules = parseResourceSetRules((setRes.data as { rules: unknown }).rules);
	}

	const toUpdate: { id: string; patch: Record<string, unknown> }[] = [];
	const toInsert: {
		set_id: string;
		book_id: string | null;
		essay_id: string | null;
		kind: MemberKind;
		created_by: string;
	}[] = [];

	for (const ref of refs) {
		const key = catalogKey(ref);
		if (!key) continue;
		const row = existing.get(key) ?? null;
		if (kind === 'include') {
			const matches = rules ? await refMatchesRules(supabase, rules, ref) : false;
			if (!row) {
				if (!matches) {
					toInsert.push({
						set_id: setId,
						book_id: ref.bookId,
						essay_id: ref.essayId,
						kind: 'include',
						created_by: userId
					});
				}
				continue;
			}
			if (row.kind === 'include') continue;
			if (matches && row.bibliographical) {
				toUpdate.push({ id: row.id, patch: { deleted_at: new Date().toISOString() } });
			} else {
				toUpdate.push({ id: row.id, patch: { kind: 'include' } });
			}
			continue;
		}
		if (row?.kind === kind) continue;
		if (row) {
			toUpdate.push({ id: row.id, patch: { kind } });
		} else {
			toInsert.push({
				set_id: setId,
				book_id: ref.bookId,
				essay_id: ref.essayId,
				kind,
				created_by: userId
			});
		}
	}

	if (toUpdate.length > 0) {
		const results = await Promise.all(
			toUpdate.map((item) =>
				supabase.from('resource_set_members').update(item.patch as never).eq('id', item.id)
			)
		);
		for (const res of results) {
			if (res.error) {
				console.error('[studies] member kind update', res.error);
				return { ok: false, message: res.error.message };
			}
		}
	}
	if (toInsert.length > 0) {
		const { error } = await supabase.from('resource_set_members').insert(toInsert as never);
		if (error) {
			console.error('[studies] member kind insert', error);
			return { ok: false, message: error.message };
		}
	}
	return { ok: true };
}

/** Remove = dismiss. Gone from Included and Not included. */
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
	const result = await applyMemberKind(supabase, userId, setId, parsed.refs, 'dismiss');
	if (!result.ok) {
		return fail(500, { kind: 'removeSetMember' as const, setId, message: result.message });
	}
	return { kind: 'removeSetMember' as const, setId, success: true as const };
}

/** Park as Not included (visible, not in import). */
export async function excludeSetMemberAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const setId = trimOrNull(fd.get('set_id'));
	if (!setId || !UUID_RE.test(setId)) {
		return fail(400, { kind: 'excludeSetMember' as const, message: 'Invalid set.' });
	}
	const parsed = parseRefs(fd);
	if (!parsed.ok) {
		return fail(400, { kind: 'excludeSetMember' as const, setId, message: parsed.message });
	}
	const result = await applyMemberKind(supabase, userId, setId, parsed.refs, 'exclude');
	if (!result.ok) {
		return fail(500, { kind: 'excludeSetMember' as const, setId, message: result.message });
	}
	return { kind: 'excludeSetMember' as const, setId, success: true as const };
}

/** Include / add back / add a book. */
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
	const result = await applyMemberKind(supabase, userId, setId, parsed.refs, 'include');
	if (!result.ok) {
		return fail(500, { kind: 'restoreSetMember' as const, setId, message: result.message });
	}
	return { kind: 'restoreSetMember' as const, setId, success: true as const };
}

/** Move to another set: include on the destination, dismiss on the source. */
export async function moveSetMembersAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const setId = trimOrNull(fd.get('set_id'));
	const targetSetId = trimOrNull(fd.get('target_set_id'));
	if (!setId || !UUID_RE.test(setId)) {
		return fail(400, { kind: 'moveSetMembers' as const, message: 'Invalid set.' });
	}
	if (!targetSetId || !UUID_RE.test(targetSetId)) {
		return fail(400, { kind: 'moveSetMembers' as const, setId, message: 'Pick a destination set.' });
	}
	if (targetSetId === setId) {
		return fail(400, { kind: 'moveSetMembers' as const, setId, message: 'Pick a different set.' });
	}
	const parsed = parseRefs(fd);
	if (!parsed.ok) {
		return fail(400, { kind: 'moveSetMembers' as const, setId, message: parsed.message });
	}
	const dest = await supabase
		.from('resource_sets')
		.select('id')
		.eq('id', targetSetId)
		.is('deleted_at', null)
		.maybeSingle();
	if (dest.error || !dest.data) {
		return fail(404, {
			kind: 'moveSetMembers' as const,
			setId,
			message: dest.error?.message ?? 'Destination set not found.'
		});
	}
	const include = await applyMemberKind(supabase, userId, targetSetId, parsed.refs, 'include');
	if (!include.ok) {
		return fail(500, { kind: 'moveSetMembers' as const, setId, message: include.message });
	}
	const dismiss = await applyMemberKind(supabase, userId, setId, parsed.refs, 'dismiss');
	if (!dismiss.ok) {
		return fail(500, { kind: 'moveSetMembers' as const, setId, message: dismiss.message });
	}
	return { kind: 'moveSetMembers' as const, setId, success: true as const };
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
	const existing = await liveMembersForRefs(supabase, setId, parsed.refs);
	const toUpdate: string[] = [];
	const toInsert: {
		set_id: string;
		book_id: string | null;
		essay_id: string | null;
		kind: 'include';
		bibliographical: boolean;
		created_by: string;
	}[] = [];
	for (const ref of parsed.refs) {
		const key = catalogKey(ref);
		if (!key) continue;
		const row = existing.get(key);
		if (row) {
			if (row.bibliographical === bibliographical) continue;
			toUpdate.push(row.id);
		} else {
			toInsert.push({
				set_id: setId,
				book_id: ref.bookId,
				essay_id: ref.essayId,
				kind: 'include',
				bibliographical,
				created_by: userId
			});
		}
	}
	if (toUpdate.length > 0) {
		const { error } = await supabase
			.from('resource_set_members')
			.update({ bibliographical } as never)
			.in('id', toUpdate);
		if (error) {
			console.error('[studies] set bibliographical', error);
			return fail(500, { kind: 'setBibliographical' as const, setId, message: error.message });
		}
	}
	if (toInsert.length > 0) {
		const { error } = await supabase.from('resource_set_members').insert(toInsert as never);
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
	const { data: created, error } = await supabase
		.from('resource_sets')
		.insert({
			name: parsed.name,
			slug,
			kind,
			section_id: sectionId,
			rules,
			sort_order: sortOrder,
			created_by: userId
		})
		.select('id')
		.single();
	if (error) {
		console.error('[studies] create set', error);
		return fail(500, { kind: 'createSet' as const, sectionId, message: error.message });
	}
	return {
		kind: 'createSet' as const,
		sectionId,
		setId: (created as { id: string }).id,
		success: true as const
	};
}

function parseSaveGroupItems(raw: string | null): CatalogRef[] | null {
	if (!raw?.trim()) return null;
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return null;
		const refs: CatalogRef[] = [];
		const seen = new Set<string>();
		for (const item of parsed) {
			if (!item || typeof item !== 'object') continue;
			const row = item as { book_id?: unknown; essay_id?: unknown };
			const essayId =
				typeof row.essay_id === 'string' && UUID_RE.test(row.essay_id.trim())
					? row.essay_id.trim()
					: null;
			const bookId =
				typeof row.book_id === 'string' && UUID_RE.test(row.book_id.trim())
					? row.book_id.trim()
					: null;
			const key = essayId ? `e:${essayId}` : bookId ? `b:${bookId}` : '';
			if (!key || seen.has(key)) continue;
			seen.add(key);
			refs.push({ bookId: essayId ? null : bookId, essayId });
		}
		return refs;
	} catch {
		return null;
	}
}

/**
 * Create a custom set from selected book/essay sources in a study research
 * group. Requires an explicit set name and a multi-select `items` JSON payload.
 */
export async function saveGroupAsSetAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const groupId = trimOrNull(fd.get('group_id'));
	if (!groupId || !UUID_RE.test(groupId)) {
		return fail(400, { kind: 'saveGroupAsSet' as const, message: 'Missing group.' });
	}
	const groupRes = await supabase
		.from('study_research_groups')
		.select('id, name, paper_id, sermon_id')
		.eq('id', groupId)
		.is('deleted_at', null)
		.maybeSingle();
	if (groupRes.error || !groupRes.data) {
		return fail(404, {
			kind: 'saveGroupAsSet' as const,
			message: groupRes.error?.message ?? 'Group not found.'
		});
	}
	const group = groupRes.data as {
		id: string;
		name: string;
		paper_id: string | null;
		sermon_id: string | null;
	};
	const nameParsed = parseName(trimOrNull(fd.get('name')), 'Set name');
	if (!nameParsed.ok) {
		return fail(400, { kind: 'saveGroupAsSet' as const, message: nameParsed.message });
	}

	const selected = parseSaveGroupItems(trimOrNull(fd.get('items')));
	if (!selected) {
		return fail(400, {
			kind: 'saveGroupAsSet' as const,
			message: 'Pick at least one source.'
		});
	}
	if (selected.length === 0) {
		return fail(400, {
			kind: 'saveGroupAsSet' as const,
			message: 'Pick at least one source.'
		});
	}

	let sourcesQuery = supabase
		.from('study_sources')
		.select('book_id, essay_id')
		.eq('group_id', groupId)
		.is('deleted_at', null);
	if (group.paper_id) sourcesQuery = sourcesQuery.eq('paper_id', group.paper_id);
	else if (group.sermon_id) sourcesQuery = sourcesQuery.eq('sermon_id', group.sermon_id);
	const sourcesRes = await sourcesQuery;
	if (sourcesRes.error) {
		console.error('[studies] saveGroupAsSet sources', sourcesRes.error);
		return fail(500, { kind: 'saveGroupAsSet' as const, message: sourcesRes.error.message });
	}
	const allowed = new Set(
		catalogRefsFromGroupSources(
			(sourcesRes.data ?? []) as { book_id: string | null; essay_id: string | null }[]
		).map((ref) => (ref.essayId ? `e:${ref.essayId}` : `b:${ref.bookId}`))
	);
	const refs = selected.filter((ref) =>
		allowed.has(ref.essayId ? `e:${ref.essayId}` : `b:${ref.bookId}`)
	);
	if (refs.length === 0) {
		return fail(400, {
			kind: 'saveGroupAsSet' as const,
			message: 'Selected sources are not in this group.'
		});
	}

	const sectionRes = await supabase
		.from('resource_set_sections')
		.select('id')
		.eq('set_kind', 'custom')
		.eq('locked', false)
		.is('deleted_at', null)
		.order('sort_order', { ascending: true })
		.limit(1)
		.maybeSingle();
	if (sectionRes.error || !sectionRes.data) {
		return fail(400, {
			kind: 'saveGroupAsSet' as const,
			message: sectionRes.error?.message ?? 'No custom set section available.'
		});
	}
	const sectionId = (sectionRes.data as { id: string }).id;
	const slug = slugifyResourceName(nameParsed.name);
	if (await liveSlugTaken(supabase, 'resource_sets', slug)) {
		return fail(400, {
			kind: 'saveGroupAsSet' as const,
			message: 'A set with that name already exists.'
		});
	}
	const { data: last, error: lastErr } = await supabase
		.from('resource_sets')
		.select('sort_order')
		.eq('section_id', sectionId)
		.is('deleted_at', null)
		.order('sort_order', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (lastErr) console.error('[studies] saveGroupAsSet sort', lastErr);
	const sortOrder = ((last?.sort_order as number | undefined) ?? -1) + 1;
	const { data: created, error: createErr } = await supabase
		.from('resource_sets')
		.insert({
			name: nameParsed.name,
			slug,
			kind: 'custom',
			section_id: sectionId,
			rules: [],
			sort_order: sortOrder,
			created_by: userId
		})
		.select('id')
		.single();
	if (createErr || !created) {
		console.error('[studies] saveGroupAsSet create', createErr);
		return fail(500, {
			kind: 'saveGroupAsSet' as const,
			message: createErr?.message ?? 'Could not create set.'
		});
	}
	const setId = (created as { id: string }).id;
	const { error: memberErr } = await supabase.from('resource_set_members').insert(
		refs.map((ref) => ({
			set_id: setId,
			book_id: ref.bookId,
			essay_id: ref.essayId,
			kind: 'include' as const,
			bibliographical: true,
			created_by: userId
		}))
	);
	if (memberErr) {
		console.error('[studies] saveGroupAsSet members', memberErr);
		return fail(500, { kind: 'saveGroupAsSet' as const, setId, message: memberErr.message });
	}
	return { kind: 'saveGroupAsSet' as const, setId, success: true as const };
}

import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseResourceSetRules, type CatalogRef } from '$lib/studies/resource-sets';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trimOrNull(v: FormDataEntryValue | null): string | null {
	if (v === null || v === undefined) return null;
	const t = String(v).trim();
	return t.length > 0 ? t : null;
}

function parseRef(fd: FormData): { ok: true; ref: CatalogRef } | { ok: false; message: string } {
	const bookId = trimOrNull(fd.get('book_id'));
	const essayId = trimOrNull(fd.get('essay_id'));
	if (bookId && essayId) return { ok: false, message: 'Pick a book or an essay.' };
	if (bookId) {
		if (!UUID_RE.test(bookId)) return { ok: false, message: 'Invalid book.' };
		return { ok: true, ref: { bookId, essayId: null } };
	}
	if (essayId) {
		if (!UUID_RE.test(essayId)) return { ok: false, message: 'Invalid essay.' };
		return { ok: true, ref: { bookId: null, essayId } };
	}
	return { ok: false, message: 'Missing catalog row.' };
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
				.is('deleted_at', null)
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
): Promise<{ id: string; kind: string } | null> {
	let q = supabase
		.from('resource_set_members')
		.select('id, kind')
		.eq('set_id', setId)
		.is('deleted_at', null);
	q = ref.bookId ? q.eq('book_id', ref.bookId) : q.eq('essay_id', ref.essayId ?? '');
	const { data, error } = await q.maybeSingle();
	if (error) {
		console.error('[studies] live member', error);
		return null;
	}
	return (data as { id: string; kind: string } | null) ?? null;
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
	const parsed = parseRef(fd);
	if (!parsed.ok) {
		return fail(400, { kind: 'removeSetMember' as const, setId, message: parsed.message });
	}
	const existing = await liveMember(supabase, setId, parsed.ref);
	if (existing?.kind === 'exclude') {
		return { kind: 'removeSetMember' as const, setId, success: true as const };
	}
	if (existing) {
		const { error } = await supabase
			.from('resource_set_members')
			.update({ kind: 'exclude' } as never)
			.eq('id', existing.id);
		if (error) {
			console.error('[studies] remove member update', error);
			return fail(500, { kind: 'removeSetMember' as const, setId, message: error.message });
		}
		return { kind: 'removeSetMember' as const, setId, success: true as const };
	}
	const { error } = await supabase.from('resource_set_members').insert({
		set_id: setId,
		book_id: parsed.ref.bookId,
		essay_id: parsed.ref.essayId,
		kind: 'exclude',
		created_by: userId
	} as never);
	if (error) {
		console.error('[studies] remove member insert', error);
		return fail(500, { kind: 'removeSetMember' as const, setId, message: error.message });
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
	const parsed = parseRef(fd);
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
	const matches = await refMatchesRules(
		supabase,
		parseResourceSetRules((setRes.data as { rules: unknown }).rules),
		parsed.ref
	);
	const existing = await liveMember(supabase, setId, parsed.ref);
	if (!existing) {
		if (matches) {
			return { kind: 'restoreSetMember' as const, setId, success: true as const };
		}
		const { error } = await supabase.from('resource_set_members').insert({
			set_id: setId,
			book_id: parsed.ref.bookId,
			essay_id: parsed.ref.essayId,
			kind: 'include',
			created_by: userId
		} as never);
		if (error) {
			console.error('[studies] restore insert', error);
			return fail(500, { kind: 'restoreSetMember' as const, setId, message: error.message });
		}
		return { kind: 'restoreSetMember' as const, setId, success: true as const };
	}
	if (existing.kind === 'include') {
		return { kind: 'restoreSetMember' as const, setId, success: true as const };
	}
	if (matches) {
		const { error } = await supabase
			.from('resource_set_members')
			.update({ deleted_at: new Date().toISOString() } as never)
			.eq('id', existing.id);
		if (error) {
			console.error('[studies] restore soft-delete', error);
			return fail(500, { kind: 'restoreSetMember' as const, setId, message: error.message });
		}
		return { kind: 'restoreSetMember' as const, setId, success: true as const };
	}
	const { error } = await supabase
		.from('resource_set_members')
		.update({ kind: 'include' } as never)
		.eq('id', existing.id);
	if (error) {
		console.error('[studies] restore to include', error);
		return fail(500, { kind: 'restoreSetMember' as const, setId, message: error.message });
	}
	return { kind: 'restoreSetMember' as const, setId, success: true as const };
}

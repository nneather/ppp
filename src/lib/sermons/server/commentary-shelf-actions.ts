/**
 * Owner writes for the commentary shelf: park/restore a set, or set its stars.
 * Parked essays update `essays` only. Stars always land on the book ids.
 */
import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 40;

export function parseShelfUuidList(values: FormDataEntryValue[]): string[] | null {
	const ids = [
		...new Set(values.map((value) => String(value).trim()).filter((value) => value.length > 0))
	];
	if (ids.length === 0 || ids.length > MAX_IDS) return null;
	if (ids.some((id) => !UUID_RE.test(id))) return null;
	return ids;
}

export function parseShelfRating(raw: FormDataEntryValue | null): number | null | 'invalid' {
	const text = String(raw ?? '').trim();
	if (text.length === 0) return null;
	const n = Number(text);
	if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 5) return 'invalid';
	return n;
}

async function assertOwner(supabase: SupabaseClient, userId: string): Promise<boolean> {
	const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
	return (data?.role as string | null) === 'owner';
}

export async function setCommentaryRatingAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	if (!(await assertOwner(supabase, userId))) {
		return fail(403, {
			kind: 'setCommentaryRating' as const,
			message: 'Only the owner can rate a commentary.'
		});
	}
	const bookIds = parseShelfUuidList(fd.getAll('book_id'));
	if (!bookIds) {
		return fail(400, {
			kind: 'setCommentaryRating' as const,
			message: 'Missing commentary.'
		});
	}
	if (!fd.has('rating')) {
		return fail(400, {
			kind: 'setCommentaryRating' as const,
			message: 'Missing rating.'
		});
	}
	const rating = parseShelfRating(fd.get('rating'));
	if (rating === 'invalid') {
		return fail(400, {
			kind: 'setCommentaryRating' as const,
			message: 'Rating must be 1–5, or empty to clear.'
		});
	}

	const { error } = await supabase
		.from('books')
		.update({ rating })
		.in('id', bookIds)
		.is('deleted_at', null);
	if (error) {
		console.error('[sermons] set commentary rating', error);
		return fail(500, {
			kind: 'setCommentaryRating' as const,
			message: error.message ?? 'Could not update the rating.'
		});
	}
	return { kind: 'setCommentaryRating' as const, success: true as const, rating };
}

export async function setCommentaryShelfAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	if (!(await assertOwner(supabase, userId))) {
		return fail(403, {
			kind: 'setCommentaryShelf' as const,
			message: 'Only the owner can change which commentaries are dismissed by default.'
		});
	}
	const flag = String(fd.get('shelf_dismissed') ?? '').trim();
	if (flag !== 'true' && flag !== 'false') {
		return fail(400, {
			kind: 'setCommentaryShelf' as const,
			message: 'Missing dismissed flag.'
		});
	}
	const shelfDismissed = flag === 'true';
	const essayIds = parseShelfUuidList(fd.getAll('essay_id'));
	const bookIds = parseShelfUuidList(fd.getAll('book_id'));
	if (essayIds) {
		const { error } = await supabase
			.from('essays')
			.update({ shelf_dismissed: shelfDismissed })
			.in('id', essayIds)
			.is('deleted_at', null);
		if (error) {
			console.error('[sermons] set essay shelf', error);
			return fail(500, {
				kind: 'setCommentaryShelf' as const,
				message: error.message ?? 'Could not update the commentary.'
			});
		}
		return { kind: 'setCommentaryShelf' as const, success: true as const, shelfDismissed };
	}
	if (!bookIds) {
		return fail(400, {
			kind: 'setCommentaryShelf' as const,
			message: 'Missing commentary.'
		});
	}
	const { error } = await supabase
		.from('books')
		.update({ shelf_dismissed: shelfDismissed })
		.in('id', bookIds)
		.is('deleted_at', null);
	if (error) {
		console.error('[sermons] set book shelf', error);
		return fail(500, {
			kind: 'setCommentaryShelf' as const,
			message: error.message ?? 'Could not update the commentary.'
		});
	}
	return { kind: 'setCommentaryShelf' as const, success: true as const, shelfDismissed };
}

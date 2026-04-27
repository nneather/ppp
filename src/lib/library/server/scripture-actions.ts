import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	insertPolymorphicRow,
	polymorphicToColumns,
	validateXor
} from '$lib/library/polymorphic';
import type { PolymorphicParent, PolymorphicParentInput } from '$lib/library/polymorphic';

/**
 * Server-side helpers for `scripture_references`. Mirrors the
 * `src/lib/library/server/book-actions.ts` shape — both per-route page-server
 * action handlers thinly wrap these so the action surface is shared between
 * `/library/books/[id]` (where the scripture-reference form will live in
 * Session 2) and any future review-queue page.
 *
 * Form-action result shape per `.cursor/rules/sveltekit-routes.mdc`:
 *   { kind, success?, message?, refId? }
 *
 * Page numbers (page_start, page_end) are TEXT and intentionally NOT coerced
 * — schema handles `IV.317`, `xiv`, etc. per `.cursor/rules/library-module.mdc`.
 */

export type ScriptureActionKind =
	| 'createScriptureRef'
	| 'updateScriptureRef'
	| 'softDeleteScriptureRef';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trimOrNull(raw: FormDataEntryValue | null): string | null {
	const t = String(raw ?? '').trim();
	return t.length > 0 ? t : null;
}

function parseChapterOrVerse(raw: FormDataEntryValue | null, max: number): number | null {
	const t = String(raw ?? '').trim();
	if (t.length === 0) return null;
	const n = Number(t);
	if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > max) return null;
	return n;
}

function parseBoolean(raw: FormDataEntryValue | null): boolean {
	const t = String(raw ?? '').trim().toLowerCase();
	return t === 'true' || t === 'on' || t === '1';
}

function parseParent(fd: FormData): PolymorphicParent | { error: string } {
	const kind = String(fd.get('source_kind') ?? '').trim();
	if (kind !== 'book' && kind !== 'essay') {
		return { error: 'Source must be a book or an essay.' };
	}
	const raw: PolymorphicParentInput =
		kind === 'book'
			? { kind: 'book', book_id: String(fd.get('book_id') ?? '').trim() }
			: { kind: 'essay', essay_id: String(fd.get('essay_id') ?? '').trim() };
	try {
		return validateXor(raw);
	} catch (err) {
		return { error: err instanceof Error ? err.message : 'Invalid source.' };
	}
}

export type ScripturePayload = {
	bible_book: string;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
	page_start: string;
	page_end: string | null;
	needs_review: boolean;
	review_note: string | null;
	source_image_url: string | null;
};

export type ScriptureParseResult =
	| { ok: true; parent: PolymorphicParent; payload: ScripturePayload }
	| { ok: false; message: string };

export function parseScriptureRefForm(fd: FormData): ScriptureParseResult {
	const parent = parseParent(fd);
	if ('error' in parent) return { ok: false, message: parent.error };

	const bible_book = String(fd.get('bible_book') ?? '').trim();
	if (!bible_book) return { ok: false, message: 'Bible book is required.' };

	const chapter_start = parseChapterOrVerse(fd.get('chapter_start'), 199);
	if (fd.get('chapter_start') != null && String(fd.get('chapter_start')).trim() !== '' && chapter_start == null) {
		return { ok: false, message: 'chapter_start must be 0–199.' };
	}
	const verse_start = parseChapterOrVerse(fd.get('verse_start'), 999);
	if (fd.get('verse_start') != null && String(fd.get('verse_start')).trim() !== '' && verse_start == null) {
		return { ok: false, message: 'verse_start must be 0–999.' };
	}
	const chapter_end = parseChapterOrVerse(fd.get('chapter_end'), 199);
	if (fd.get('chapter_end') != null && String(fd.get('chapter_end')).trim() !== '' && chapter_end == null) {
		return { ok: false, message: 'chapter_end must be 0–199.' };
	}
	const verse_end = parseChapterOrVerse(fd.get('verse_end'), 999);
	if (fd.get('verse_end') != null && String(fd.get('verse_end')).trim() !== '' && verse_end == null) {
		return { ok: false, message: 'verse_end must be 0–999.' };
	}

	const page_start = String(fd.get('page_start') ?? '').trim();
	if (!page_start) return { ok: false, message: 'page_start is required.' };
	if (page_start.length > 50) return { ok: false, message: 'page_start is too long.' };

	const page_end = trimOrNull(fd.get('page_end'));
	if (page_end != null && page_end.length > 50) {
		return { ok: false, message: 'page_end is too long.' };
	}

	return {
		ok: true,
		parent,
		payload: {
			bible_book,
			chapter_start,
			verse_start,
			chapter_end,
			verse_end,
			page_start,
			page_end,
			needs_review: parseBoolean(fd.get('needs_review')),
			review_note: trimOrNull(fd.get('review_note')),
			source_image_url: trimOrNull(fd.get('source_image_url'))
		}
	};
}

export async function createScriptureRefAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const parsed = parseScriptureRefForm(fd);
	if (!parsed.ok)
		return fail(400, { kind: 'createScriptureRef' as const, message: parsed.message });

	const result = await insertPolymorphicRow(
		supabase,
		'scripture_references',
		parsed.parent,
		{
			...parsed.payload,
			created_by: userId
		}
	);
	if (!result.ok) {
		console.error('[createScriptureRef]', result.message);
		return fail(500, { kind: 'createScriptureRef' as const, message: result.message });
	}
	return {
		kind: 'createScriptureRef' as const,
		refId: result.id,
		success: true as const
	};
}

export async function updateScriptureRefAction(supabase: SupabaseClient, fd: FormData) {
	const id = String(fd.get('id') ?? '').trim();
	if (!UUID_RE.test(id)) {
		return fail(400, { kind: 'updateScriptureRef' as const, message: 'Missing scripture_reference id.' });
	}

	const parsed = parseScriptureRefForm(fd);
	if (!parsed.ok)
		return fail(400, { kind: 'updateScriptureRef' as const, refId: id, message: parsed.message });

	// Per Session 0 S12: disallow moving a ref between book/essay parents via
	// the UI. Caller is expected not to send a different parent than the
	// existing row, but we double-check at the boundary.
	const { data: existing, error: fetchErr } = await supabase
		.from('scripture_references')
		.select('id, book_id, essay_id')
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (fetchErr || !existing) {
		return fail(404, {
			kind: 'updateScriptureRef' as const,
			refId: id,
			message: 'Scripture reference not found.'
		});
	}
	const existingParent: PolymorphicParent = (existing.book_id as string | null)
		? { kind: 'book', book_id: existing.book_id as string }
		: { kind: 'essay', essay_id: existing.essay_id as string };
	if (
		(existingParent.kind === 'book' && parsed.parent.kind !== 'book') ||
		(existingParent.kind === 'book' &&
			parsed.parent.kind === 'book' &&
			existingParent.book_id !== parsed.parent.book_id)
	) {
		return fail(400, {
			kind: 'updateScriptureRef' as const,
			refId: id,
			message: 'Cannot move a scripture_reference to a different source. Delete and recreate.'
		});
	}

	const cols = polymorphicToColumns(parsed.parent);
	const patch = { ...parsed.payload, ...cols };

	const { error: updErr } = await supabase
		.from('scripture_references')
		.update(patch as never)
		.eq('id', id);
	if (updErr) {
		console.error('[updateScriptureRef]', updErr);
		return fail(500, {
			kind: 'updateScriptureRef' as const,
			refId: id,
			message: updErr.message ?? 'Could not update scripture_reference.'
		});
	}
	return { kind: 'updateScriptureRef' as const, refId: id, success: true as const };
}

export async function softDeleteScriptureRefAction(supabase: SupabaseClient, fd: FormData) {
	const id = String(fd.get('id') ?? '').trim();
	if (!UUID_RE.test(id)) {
		return fail(400, {
			kind: 'softDeleteScriptureRef' as const,
			message: 'Missing scripture_reference id.'
		});
	}
	const { error } = await supabase
		.from('scripture_references')
		.update({ deleted_at: new Date().toISOString() })
		.eq('id', id);
	if (error) {
		console.error('[softDeleteScriptureRef]', error);
		return fail(500, {
			kind: 'softDeleteScriptureRef' as const,
			refId: id,
			message: error.message ?? 'Could not delete scripture_reference.'
		});
	}
	return { kind: 'softDeleteScriptureRef' as const, refId: id, success: true as const };
}

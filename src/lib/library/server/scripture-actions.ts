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
	| 'createScriptureRefsBatch'
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

/** Optional 0–1 confidence from OCR row payloads; invalid/absent → null. */
function parseConfidenceScore(raw: FormDataEntryValue | null): number | null {
	const t = String(raw ?? '').trim();
	if (t.length === 0) return null;
	const n = Number(t);
	if (!Number.isFinite(n) || n < 0 || n > 1) return null;
	return n;
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
	confidence_score: number | null;
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
			source_image_url: trimOrNull(fd.get('source_image_url')),
			confidence_score: parseConfidenceScore(fd.get('confidence_score'))
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

/**
 * Batch parser for the bulk "Add references" form. The form posts:
 *   - source_kind / book_id / essay_id (parent, validated once)
 *   - source_image_url (optional, shared across the batch — same page image)
 *   - rows_json: a JSON array of per-row payloads
 *
 * Each row carries its own bible_book + chapter/verse/page fields + needs_review
 * note. A row is skipped silently when it has no `bible_book` AND no `page_start`
 * (treated as an empty draft row from the form). Otherwise the row is parsed
 * with the same rules as the single-row form; an invalid row aborts the whole
 * batch with a row-indexed error message.
 */
export type ScriptureBatchParseResult =
	| {
			ok: true;
			parent: PolymorphicParent;
			rows: ScripturePayload[];
	  }
	| { ok: false; message: string };

type RawBatchRow = {
	bible_book?: unknown;
	chapter_start?: unknown;
	verse_start?: unknown;
	chapter_end?: unknown;
	verse_end?: unknown;
	page_start?: unknown;
	page_end?: unknown;
	needs_review?: unknown;
	review_note?: unknown;
	confidence_score?: unknown;
};

function rawToFormData(row: RawBatchRow, sharedImage: string | null): FormData {
	const fd = new FormData();
	const set = (key: string, val: unknown) => {
		if (val == null) return;
		fd.set(key, String(val));
	};
	set('bible_book', row.bible_book);
	set('chapter_start', row.chapter_start);
	set('verse_start', row.verse_start);
	set('chapter_end', row.chapter_end);
	set('verse_end', row.verse_end);
	set('page_start', row.page_start);
	set('page_end', row.page_end);
	set('needs_review', row.needs_review === true || row.needs_review === 'true' ? 'true' : 'false');
	set('review_note', row.review_note);
	if (row.confidence_score != null && row.confidence_score !== '')
		fd.set('confidence_score', String(row.confidence_score));
	if (sharedImage) fd.set('source_image_url', sharedImage);
	// parent fields are not consumed by parseScriptureRefForm's payload — we
	// fill them so parseParent's branch sees something, but the batch caller
	// already validated the parent once; we'll discard parsed.parent below.
	fd.set('source_kind', 'book');
	fd.set('book_id', '00000000-0000-0000-0000-000000000000');
	return fd;
}

function isEmptyBatchRow(row: RawBatchRow): boolean {
	const bb = String(row.bible_book ?? '').trim();
	const ps = String(row.page_start ?? '').trim();
	return bb.length === 0 && ps.length === 0;
}

export function parseScriptureRefBatchForm(fd: FormData): ScriptureBatchParseResult {
	const parent = parseParent(fd);
	if ('error' in parent) return { ok: false, message: parent.error };

	const sharedImage = trimOrNull(fd.get('source_image_url'));

	const rowsRaw = String(fd.get('rows_json') ?? '').trim();
	if (!rowsRaw) return { ok: false, message: 'Add at least one reference before saving.' };

	let parsedJson: unknown;
	try {
		parsedJson = JSON.parse(rowsRaw);
	} catch {
		return { ok: false, message: 'Batch payload is malformed.' };
	}
	if (!Array.isArray(parsedJson)) {
		return { ok: false, message: 'Batch payload must be an array.' };
	}

	const out: ScripturePayload[] = [];
	for (let i = 0; i < parsedJson.length; i++) {
		const raw = parsedJson[i];
		if (!raw || typeof raw !== 'object') {
			return { ok: false, message: `Row ${i + 1}: malformed.` };
		}
		const row = raw as RawBatchRow;
		if (isEmptyBatchRow(row)) continue;

		const rowFd = rawToFormData(row, sharedImage);
		const parsedRow = parseScriptureRefForm(rowFd);
		if (!parsedRow.ok) {
			return { ok: false, message: `Row ${i + 1}: ${parsedRow.message}` };
		}
		out.push(parsedRow.payload);
	}

	if (out.length === 0) {
		return { ok: false, message: 'Add at least one reference before saving.' };
	}

	return { ok: true, parent, rows: out };
}

export async function createScriptureRefsBatchAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const parsed = parseScriptureRefBatchForm(fd);
	if (!parsed.ok) {
		return fail(400, { kind: 'createScriptureRefsBatch' as const, message: parsed.message });
	}

	const cols = polymorphicToColumns(parsed.parent);
	const rows = parsed.rows.map((p) => ({ ...p, ...cols, created_by: userId }));

	const { data, error } = await supabase
		.from('scripture_references')
		.insert(rows as never)
		.select('id');

	if (error) {
		console.error('[createScriptureRefsBatch]', error);
		return fail(500, {
			kind: 'createScriptureRefsBatch' as const,
			message: error.message ?? 'Could not save references.'
		});
	}

	const refIds = ((data ?? []) as { id: string }[]).map((r) => r.id);
	return {
		kind: 'createScriptureRefsBatch' as const,
		refIds,
		count: refIds.length,
		success: true as const
	};
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

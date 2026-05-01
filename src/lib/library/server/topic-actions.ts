import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	insertPolymorphicRow,
	polymorphicToColumns,
	validateXor
} from '$lib/library/polymorphic';
import type { PolymorphicParent, PolymorphicParentInput } from '$lib/library/polymorphic';

/**
 * Server-side helpers for `book_topics`. Mirrors `scripture-actions.ts` —
 * single-row edit contract + batch-create contract sharing the same parser.
 *
 * Topic canonicalization:
 *   - `book_topics.topic` has a schema CHECK: `topic = lower(trim(topic))`.
 *     We enforce lowercasing + trim at the parser boundary so CHECK
 *     violations never surface to the user. The <CanonicalizingCombobox>
 *     typo-warn gate is a separate client-side concern (no migration).
 *
 * Form-action result shape per `.cursor/rules/sveltekit-routes.mdc`:
 *   { kind, success?, message?, topicId? }
 */

export type BookTopicActionKind =
	| 'createBookTopic'
	| 'createBookTopicsBatch'
	| 'updateBookTopic'
	| 'softDeleteBookTopic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trimOrNull(raw: FormDataEntryValue | null): string | null {
	const t = String(raw ?? '').trim();
	return t.length > 0 ? t : null;
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

export type TopicPayload = {
	topic: string;
	page_start: string;
	page_end: string | null;
	needs_review: boolean;
	review_note: string | null;
	source_image_url: string | null;
};

export type TopicParseResult =
	| { ok: true; parent: PolymorphicParent; payload: TopicPayload }
	| { ok: false; message: string };

/**
 * Parse a single-row topic form. Shared between the legacy single-row
 * contract and the batch parser (which reuses this per-row).
 */
export function parseBookTopicForm(fd: FormData): TopicParseResult {
	const parent = parseParent(fd);
	if ('error' in parent) return { ok: false, message: parent.error };

	// Canonicalize to the schema CHECK: lower(trim(topic)).
	const topic = String(fd.get('topic') ?? '')
		.trim()
		.toLowerCase();
	if (!topic) return { ok: false, message: 'Topic is required.' };
	if (topic.length > 120) return { ok: false, message: 'Topic is too long (max 120 chars).' };

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
			topic,
			page_start,
			page_end,
			needs_review: parseBoolean(fd.get('needs_review')),
			review_note: trimOrNull(fd.get('review_note')),
			source_image_url: trimOrNull(fd.get('source_image_url'))
		}
	};
}

export async function createBookTopicAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const parsed = parseBookTopicForm(fd);
	if (!parsed.ok)
		return fail(400, { kind: 'createBookTopic' as const, message: parsed.message });

	const result = await insertPolymorphicRow(supabase, 'book_topics', parsed.parent, {
		...parsed.payload,
		created_by: userId
	});
	if (!result.ok) {
		console.error('[createBookTopic]', result.message);
		return fail(500, { kind: 'createBookTopic' as const, message: result.message });
	}
	return {
		kind: 'createBookTopic' as const,
		topicId: result.id,
		success: true as const
	};
}

export async function updateBookTopicAction(supabase: SupabaseClient, fd: FormData) {
	const id = String(fd.get('id') ?? '').trim();
	if (!UUID_RE.test(id)) {
		return fail(400, {
			kind: 'updateBookTopic' as const,
			message: 'Missing book_topic id.'
		});
	}
	const parsed = parseBookTopicForm(fd);
	if (!parsed.ok)
		return fail(400, {
			kind: 'updateBookTopic' as const,
			topicId: id,
			message: parsed.message
		});

	const { data: existing, error: fetchErr } = await supabase
		.from('book_topics')
		.select('id, book_id, essay_id')
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (fetchErr || !existing) {
		return fail(404, {
			kind: 'updateBookTopic' as const,
			topicId: id,
			message: 'Topic not found.'
		});
	}
	const cols = polymorphicToColumns(parsed.parent);
	if (
		parsed.parent.kind === 'book' &&
		(existing.book_id as string | null) !== parsed.parent.book_id
	) {
		return fail(400, {
			kind: 'updateBookTopic' as const,
			topicId: id,
			message: 'Cannot move a topic to a different source. Delete and recreate.'
		});
	}

	const patch = { ...parsed.payload, ...cols };
	const { error: updErr } = await supabase
		.from('book_topics')
		.update(patch as never)
		.eq('id', id);
	if (updErr) {
		console.error('[updateBookTopic]', updErr);
		return fail(500, {
			kind: 'updateBookTopic' as const,
			topicId: id,
			message: updErr.message ?? 'Could not update topic.'
		});
	}
	return { kind: 'updateBookTopic' as const, topicId: id, success: true as const };
}

// ---------------------------------------------------------------------------
// Batch create
// ---------------------------------------------------------------------------

export type TopicBatchParseResult =
	| { ok: true; parent: PolymorphicParent; rows: TopicPayload[] }
	| { ok: false; message: string };

type RawBatchRow = {
	topic?: unknown;
	page_start?: unknown;
	page_end?: unknown;
	needs_review?: unknown;
	review_note?: unknown;
};

function rawToFormData(row: RawBatchRow, sharedImage: string | null): FormData {
	const fd = new FormData();
	const set = (key: string, val: unknown) => {
		if (val == null) return;
		fd.set(key, String(val));
	};
	set('topic', row.topic);
	set('page_start', row.page_start);
	set('page_end', row.page_end);
	fd.set(
		'needs_review',
		row.needs_review === true || row.needs_review === 'true' ? 'true' : 'false'
	);
	set('review_note', row.review_note);
	if (sharedImage) fd.set('source_image_url', sharedImage);
	// Dummy parent — the batch parser already validated the real parent once.
	fd.set('source_kind', 'book');
	fd.set('book_id', '00000000-0000-0000-0000-000000000000');
	return fd;
}

function isEmptyBatchRow(row: RawBatchRow): boolean {
	const t = String(row.topic ?? '').trim();
	const ps = String(row.page_start ?? '').trim();
	return t.length === 0 && ps.length === 0;
}

export function parseBookTopicsBatchForm(fd: FormData): TopicBatchParseResult {
	const parent = parseParent(fd);
	if ('error' in parent) return { ok: false, message: parent.error };

	const sharedImage = trimOrNull(fd.get('source_image_url'));
	const rowsRaw = String(fd.get('rows_json') ?? '').trim();
	if (!rowsRaw) return { ok: false, message: 'Add at least one topic before saving.' };

	let parsedJson: unknown;
	try {
		parsedJson = JSON.parse(rowsRaw);
	} catch {
		return { ok: false, message: 'Batch payload is malformed.' };
	}
	if (!Array.isArray(parsedJson)) {
		return { ok: false, message: 'Batch payload must be an array.' };
	}

	const out: TopicPayload[] = [];
	for (let i = 0; i < parsedJson.length; i++) {
		const raw = parsedJson[i];
		if (!raw || typeof raw !== 'object') {
			return { ok: false, message: `Row ${i + 1}: malformed.` };
		}
		const row = raw as RawBatchRow;
		if (isEmptyBatchRow(row)) continue;
		const rowFd = rawToFormData(row, sharedImage);
		const parsedRow = parseBookTopicForm(rowFd);
		if (!parsedRow.ok) {
			return { ok: false, message: `Row ${i + 1}: ${parsedRow.message}` };
		}
		out.push(parsedRow.payload);
	}

	if (out.length === 0) {
		return { ok: false, message: 'Add at least one topic before saving.' };
	}

	return { ok: true, parent, rows: out };
}

export async function createBookTopicsBatchAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const parsed = parseBookTopicsBatchForm(fd);
	if (!parsed.ok) {
		return fail(400, {
			kind: 'createBookTopicsBatch' as const,
			message: parsed.message
		});
	}

	const cols = polymorphicToColumns(parsed.parent);
	const rows = parsed.rows.map((p) => ({ ...p, ...cols, created_by: userId }));

	const { data, error } = await supabase
		.from('book_topics')
		.insert(rows as never)
		.select('id');
	if (error) {
		console.error('[createBookTopicsBatch]', error);
		return fail(500, {
			kind: 'createBookTopicsBatch' as const,
			message: error.message ?? 'Could not save topics.'
		});
	}

	const topicIds = ((data ?? []) as { id: string }[]).map((r) => r.id);
	return {
		kind: 'createBookTopicsBatch' as const,
		topicIds,
		count: topicIds.length,
		success: true as const
	};
}

export async function softDeleteBookTopicAction(supabase: SupabaseClient, fd: FormData) {
	const id = String(fd.get('id') ?? '').trim();
	if (!UUID_RE.test(id)) {
		return fail(400, {
			kind: 'softDeleteBookTopic' as const,
			message: 'Missing book_topic id.'
		});
	}
	const { error } = await supabase
		.from('book_topics')
		.update({ deleted_at: new Date().toISOString() })
		.eq('id', id);
	if (error) {
		console.error('[softDeleteBookTopic]', error);
		return fail(500, {
			kind: 'softDeleteBookTopic' as const,
			topicId: id,
			message: error.message ?? 'Could not delete topic.'
		});
	}
	return { kind: 'softDeleteBookTopic' as const, topicId: id, success: true as const };
}

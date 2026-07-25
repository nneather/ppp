import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeCitationText } from '$lib/library/turabian/text-normalize';

/**
 * Server-side helpers for `essays` + `essay_authors`. Mirrors scripture-actions
 * shape — per-route handlers are thin wrappers on the book detail page.
 *
 * Form-action result: `{ kind, success?, message?, essayId? | essayIds? }`
 */

export type EssayActionKind =
	| 'createEssay'
	| 'createEssaysBatch'
	| 'updateEssay'
	| 'softDeleteEssay';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EssayAuthorInput = {
	person_id: string;
	sort_order: number;
};

export type EssayFormPayload = {
	parent_book_id: string;
	essay_title: string;
	page_start: number | null;
	page_end: number | null;
	authors: EssayAuthorInput[];
};

/** Per-row payload inside a batch (parent book is shared at the form level). */
export type EssayBatchRowPayload = {
	essay_title: string;
	page_start: number | null;
	page_end: number | null;
	authors: EssayAuthorInput[];
};

export type EssayParseResult =
	| { ok: true; payload: EssayFormPayload; essayId?: string }
	| { ok: false; message: string };

export type EssayBatchParseResult =
	| { ok: true; parent_book_id: string; rows: EssayBatchRowPayload[] }
	| { ok: false; message: string };

type RawBatchRow = {
	essay_title?: unknown;
	page_start?: unknown;
	page_end?: unknown;
	authors?: unknown;
};

function parseOptionalPage(raw: unknown): number | null {
	const t = String(raw ?? '').trim();
	if (t.length === 0) return null;
	const n = Number(t);
	if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
	return n;
}

function parseAuthorsArray(raw: unknown): EssayAuthorInput[] | { error: string } {
	if (raw == null) return [];
	if (typeof raw === 'string') {
		const t = raw.trim();
		if (t.length === 0) return [];
		try {
			return parseAuthorsArray(JSON.parse(t));
		} catch {
			return { error: 'Authors payload is malformed.' };
		}
	}
	if (!Array.isArray(raw)) return { error: 'Authors payload must be an array.' };

	const out: EssayAuthorInput[] = [];
	const seen = new Set<string>();
	for (let i = 0; i < raw.length; i++) {
		const row = raw[i];
		if (!row || typeof row !== 'object') {
			return { error: `Author row ${i + 1}: malformed.` };
		}
		const person_id = String((row as { person_id?: string }).person_id ?? '').trim();
		if (!UUID_RE.test(person_id)) continue;
		if (seen.has(person_id)) continue;
		seen.add(person_id);
		const sort_order = Number((row as { sort_order?: number }).sort_order);
		out.push({
			person_id,
			sort_order: Number.isFinite(sort_order) ? sort_order : out.length
		});
	}
	out.sort((a, b) => a.sort_order - b.sort_order);
	return out.map((a, idx) => ({ ...a, sort_order: idx }));
}

function parseAuthorsJson(raw: FormDataEntryValue | null): EssayAuthorInput[] | { error: string } {
	return parseAuthorsArray(raw == null ? null : String(raw));
}

/** Shared title/pages/authors validation for single-row and batch create. */
export function parseEssayRowFields(input: {
	essay_title: unknown;
	page_start: unknown;
	page_end: unknown;
	authors: unknown;
}): { ok: true; row: EssayBatchRowPayload } | { ok: false; message: string } {
	const essay_title = normalizeCitationText(String(input.essay_title ?? '').trim());
	if (!essay_title) return { ok: false, message: 'Essay title is required.' };
	if (essay_title.length > 500) return { ok: false, message: 'Essay title is too long.' };

	const pageStartRaw = input.page_start;
	const page_start = parseOptionalPage(pageStartRaw);
	if (
		pageStartRaw != null &&
		String(pageStartRaw).trim() !== '' &&
		page_start == null
	) {
		return { ok: false, message: 'page_start must be a non-negative integer.' };
	}
	const pageEndRaw = input.page_end;
	const page_end = parseOptionalPage(pageEndRaw);
	if (pageEndRaw != null && String(pageEndRaw).trim() !== '' && page_end == null) {
		return { ok: false, message: 'page_end must be a non-negative integer.' };
	}
	if (page_start != null && page_end != null && page_end < page_start) {
		return { ok: false, message: 'page_end must be greater than or equal to page_start.' };
	}

	const authorsParsed = parseAuthorsArray(input.authors);
	if ('error' in authorsParsed) return { ok: false, message: authorsParsed.error };

	return {
		ok: true,
		row: {
			essay_title,
			page_start,
			page_end,
			authors: authorsParsed
		}
	};
}

function isEmptyBatchRow(row: RawBatchRow): boolean {
	return String(row.essay_title ?? '').trim().length === 0;
}

export function parseEssayForm(fd: FormData, opts?: { essayId?: string }): EssayParseResult {
	const parent_book_id = String(fd.get('parent_book_id') ?? '').trim();
	if (!UUID_RE.test(parent_book_id)) {
		return { ok: false, message: 'Parent book is required.' };
	}

	const authorsParsed = parseAuthorsJson(fd.get('authors_json'));
	if ('error' in authorsParsed) return { ok: false, message: authorsParsed.error };

	const rowParsed = parseEssayRowFields({
		essay_title: fd.get('essay_title'),
		page_start: fd.get('page_start'),
		page_end: fd.get('page_end'),
		authors: authorsParsed
	});
	if (!rowParsed.ok) return { ok: false, message: rowParsed.message };

	const essayId = opts?.essayId ?? String(fd.get('id') ?? '').trim();
	if (opts?.essayId !== undefined && !UUID_RE.test(essayId)) {
		return { ok: false, message: 'Essay id is required.' };
	}

	return {
		ok: true,
		essayId: essayId && UUID_RE.test(essayId) ? essayId : undefined,
		payload: {
			parent_book_id,
			...rowParsed.row
		}
	};
}

export function parseEssaysBatchForm(fd: FormData): EssayBatchParseResult {
	const parent_book_id = String(fd.get('parent_book_id') ?? '').trim();
	if (!UUID_RE.test(parent_book_id)) {
		return { ok: false, message: 'Parent book is required.' };
	}

	const rowsRaw = String(fd.get('rows_json') ?? '').trim();
	if (!rowsRaw) return { ok: false, message: 'Add at least one essay before saving.' };

	let parsedJson: unknown;
	try {
		parsedJson = JSON.parse(rowsRaw);
	} catch {
		return { ok: false, message: 'Batch payload is malformed.' };
	}
	if (!Array.isArray(parsedJson)) {
		return { ok: false, message: 'Batch payload must be an array.' };
	}

	const out: EssayBatchRowPayload[] = [];
	for (let i = 0; i < parsedJson.length; i++) {
		const raw = parsedJson[i];
		if (!raw || typeof raw !== 'object') {
			return { ok: false, message: `Row ${i + 1}: malformed.` };
		}
		const row = raw as RawBatchRow;
		if (isEmptyBatchRow(row)) continue;
		const parsedRow = parseEssayRowFields({
			essay_title: row.essay_title,
			page_start: row.page_start,
			page_end: row.page_end,
			authors: row.authors ?? []
		});
		if (!parsedRow.ok) {
			return { ok: false, message: `Row ${i + 1}: ${parsedRow.message}` };
		}
		out.push(parsedRow.row);
	}

	if (out.length === 0) {
		return { ok: false, message: 'Add at least one essay before saving.' };
	}

	return { ok: true, parent_book_id, rows: out };
}

async function assertEssayParent(
	supabase: SupabaseClient,
	parentBookId: string
): Promise<{ ok: true } | { ok: false; status: 400 | 404; message: string }> {
	const { data: parent, error: parentErr } = await supabase
		.from('books')
		.select('id, work_type')
		.eq('id', parentBookId)
		.is('deleted_at', null)
		.maybeSingle();
	if (parentErr || !parent) {
		return { ok: false, status: 404, message: 'Parent book not found.' };
	}
	const workType = parent.work_type as string | null;
	if (workType !== 'reference_work' && workType !== 'edited_volume') {
		return {
			ok: false,
			status: 400,
			message: 'Essays are only supported on reference works and edited volumes.'
		};
	}
	return { ok: true };
}

async function syncEssayAuthors(
	supabase: SupabaseClient,
	essayId: string,
	desired: EssayAuthorInput[]
): Promise<{ ok: true } | { ok: false; message: string }> {
	const { data: existing, error: fetchErr } = await supabase
		.from('essay_authors')
		.select('person_id, sort_order')
		.eq('essay_id', essayId);
	if (fetchErr) {
		return { ok: false, message: fetchErr.message ?? 'Could not load essay authors.' };
	}

	const currentMap = new Map<string, number>();
	for (const r of existing ?? []) {
		currentMap.set(r.person_id as string, Number(r.sort_order));
	}
	const desiredMap = new Map(desired.map((a) => [a.person_id, a.sort_order]));

	const toInsert: EssayAuthorInput[] = [];
	const toUpdate: EssayAuthorInput[] = [];
	for (const [person_id, sort_order] of desiredMap) {
		if (!currentMap.has(person_id)) toInsert.push({ person_id, sort_order });
		else if (currentMap.get(person_id) !== sort_order) {
			toUpdate.push({ person_id, sort_order });
		}
	}
	const toDelete: string[] = [];
	for (const person_id of currentMap.keys()) {
		if (!desiredMap.has(person_id)) toDelete.push(person_id);
	}

	for (const person_id of toDelete) {
		const { error } = await supabase
			.from('essay_authors')
			.delete()
			.eq('essay_id', essayId)
			.eq('person_id', person_id);
		if (error) return { ok: false, message: error.message ?? 'Author remove failed.' };
	}
	for (const u of toUpdate) {
		const { error } = await supabase
			.from('essay_authors')
			.update({ sort_order: u.sort_order })
			.eq('essay_id', essayId)
			.eq('person_id', u.person_id);
		if (error) return { ok: false, message: error.message ?? 'Author reorder failed.' };
	}
	if (toInsert.length > 0) {
		const rows = toInsert.map((a) => ({
			essay_id: essayId,
			person_id: a.person_id,
			role: 'author' as const,
			sort_order: a.sort_order
		}));
		const { error } = await supabase.from('essay_authors').insert(rows);
		if (error) return { ok: false, message: error.message ?? 'Author add failed.' };
	}
	return { ok: true };
}

export async function createEssayAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const parsed = parseEssayForm(fd);
	if (!parsed.ok) {
		return fail(400, { kind: 'createEssay' as const, message: parsed.message });
	}

	const parentOk = await assertEssayParent(supabase, parsed.payload.parent_book_id);
	if (!parentOk.ok) {
		return fail(parentOk.status, {
			kind: 'createEssay' as const,
			message: parentOk.message
		});
	}

	const { data: inserted, error: insErr } = await supabase
		.from('essays')
		.insert({
			essay_title: parsed.payload.essay_title,
			parent_book_id: parsed.payload.parent_book_id,
			page_start: parsed.payload.page_start,
			page_end: parsed.payload.page_end,
			created_by: userId
		} as never)
		.select('id')
		.single();

	if (insErr || !inserted) {
		console.error('[createEssay]', insErr);
		return fail(500, {
			kind: 'createEssay' as const,
			message: insErr?.message ?? 'Could not create essay.'
		});
	}

	const essayId = (inserted as { id: string }).id;
	if (parsed.payload.authors.length > 0) {
		const auth = await syncEssayAuthors(supabase, essayId, parsed.payload.authors);
		if (!auth.ok) {
			return fail(500, { kind: 'createEssay' as const, essayId, message: auth.message });
		}
	}

	return { kind: 'createEssay' as const, success: true as const, essayId };
}

export async function createEssaysBatchAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const parsed = parseEssaysBatchForm(fd);
	if (!parsed.ok) {
		return fail(400, {
			kind: 'createEssaysBatch' as const,
			message: parsed.message
		});
	}

	const parentOk = await assertEssayParent(supabase, parsed.parent_book_id);
	if (!parentOk.ok) {
		return fail(parentOk.status, {
			kind: 'createEssaysBatch' as const,
			message: parentOk.message
		});
	}

	const essayIds: string[] = [];
	const authorRows: {
		essay_id: string;
		person_id: string;
		role: 'author';
		sort_order: number;
	}[] = [];

	// Sequential inserts keep author pairing reliable (batch sizes are TOC-scale).
	for (const row of parsed.rows) {
		const { data: inserted, error: insErr } = await supabase
			.from('essays')
			.insert({
				essay_title: row.essay_title,
				parent_book_id: parsed.parent_book_id,
				page_start: row.page_start,
				page_end: row.page_end,
				created_by: userId
			} as never)
			.select('id')
			.single();

		if (insErr || !inserted) {
			console.error('[createEssaysBatch]', insErr);
			return fail(500, {
				kind: 'createEssaysBatch' as const,
				essayIds,
				message: insErr?.message ?? 'Could not create essays.'
			});
		}

		const essayId = (inserted as { id: string }).id;
		essayIds.push(essayId);
		for (const a of row.authors) {
			authorRows.push({
				essay_id: essayId,
				person_id: a.person_id,
				role: 'author',
				sort_order: a.sort_order
			});
		}
	}

	if (authorRows.length > 0) {
		const { error: authErr } = await supabase.from('essay_authors').insert(authorRows);
		if (authErr) {
			console.error('[createEssaysBatch] authors', authErr);
			return fail(500, {
				kind: 'createEssaysBatch' as const,
				essayIds,
				message: authErr.message ?? 'Could not save essay authors.'
			});
		}
	}

	return {
		kind: 'createEssaysBatch' as const,
		success: true as const,
		essayIds,
		count: essayIds.length
	};
}

export async function updateEssayAction(supabase: SupabaseClient, fd: FormData) {
	const id = String(fd.get('id') ?? '').trim();
	if (!UUID_RE.test(id)) {
		return fail(400, { kind: 'updateEssay' as const, message: 'Essay id is required.' });
	}

	const parsed = parseEssayForm(fd, { essayId: id });
	if (!parsed.ok) {
		return fail(400, { kind: 'updateEssay' as const, essayId: id, message: parsed.message });
	}

	const { data: existing, error: fetchErr } = await supabase
		.from('essays')
		.select('id, parent_book_id')
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (fetchErr || !existing) {
		return fail(404, { kind: 'updateEssay' as const, essayId: id, message: 'Essay not found.' });
	}
	if ((existing as { parent_book_id: string }).parent_book_id !== parsed.payload.parent_book_id) {
		return fail(400, {
			kind: 'updateEssay' as const,
			essayId: id,
			message: 'Parent book mismatch.'
		});
	}

	const { error: updErr } = await supabase
		.from('essays')
		.update({
			essay_title: parsed.payload.essay_title,
			page_start: parsed.payload.page_start,
			page_end: parsed.payload.page_end
		} as never)
		.eq('id', id);
	if (updErr) {
		console.error('[updateEssay]', updErr);
		return fail(500, {
			kind: 'updateEssay' as const,
			essayId: id,
			message: updErr.message ?? 'Could not update essay.'
		});
	}

	const auth = await syncEssayAuthors(supabase, id, parsed.payload.authors);
	if (!auth.ok) {
		return fail(500, { kind: 'updateEssay' as const, essayId: id, message: auth.message });
	}

	return { kind: 'updateEssay' as const, essayId: id, success: true as const };
}

export async function softDeleteEssayAction(supabase: SupabaseClient, fd: FormData) {
	const id = String(fd.get('id') ?? '').trim();
	if (!UUID_RE.test(id)) {
		return fail(400, { kind: 'softDeleteEssay' as const, message: 'Essay id is required.' });
	}

	const { data: existing, error: fetchErr } = await supabase
		.from('essays')
		.select('id')
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (fetchErr || !existing) {
		return fail(404, { kind: 'softDeleteEssay' as const, essayId: id, message: 'Essay not found.' });
	}

	const { error } = await supabase
		.from('essays')
		.update({ deleted_at: new Date().toISOString() } as never)
		.eq('id', id);
	if (error) {
		console.error('[softDeleteEssay]', error);
		return fail(500, {
			kind: 'softDeleteEssay' as const,
			essayId: id,
			message: error.message ?? 'Could not delete essay.'
		});
	}

	return { kind: 'softDeleteEssay' as const, essayId: id, success: true as const };
}

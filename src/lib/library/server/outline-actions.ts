import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseOutlineTsv } from '$lib/library/outline';

/**
 * Server helpers for `book_outline_sections` — per-volume TOC nodes
 * (page range → locator + label) ([252]).
 *
 * Form-action result: `{ kind, success?, message?, sectionId? | inserted? }`.
 */

export type OutlineActionKind =
	| 'createOutlineSection'
	| 'updateOutlineSection'
	| 'softDeleteOutlineSection'
	| 'pasteOutlineSections';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trimOrNull(raw: FormDataEntryValue | null): string | null {
	const t = String(raw ?? '').trim();
	return t.length > 0 ? t : null;
}

function parsePageInt(raw: FormDataEntryValue | null): number | null {
	const t = String(raw ?? '').trim();
	if (!t) return null;
	const n = Number(t);
	if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 99999) return null;
	return n;
}

export type OutlineSectionPayload = {
	book_id: string;
	parent_id: string | null;
	sort_order: number;
	locator: string | null;
	label: string;
	page_start: number;
	page_end: number;
};

export type OutlineParseResult =
	| { ok: true; payload: OutlineSectionPayload }
	| { ok: false; message: string };

export function parseOutlineSectionForm(fd: FormData): OutlineParseResult {
	const book_id = String(fd.get('book_id') ?? '').trim();
	if (!UUID_RE.test(book_id)) return { ok: false, message: 'Book is required.' };

	const label = String(fd.get('label') ?? '').trim();
	if (!label) return { ok: false, message: 'Label is required.' };
	if (label.length > 300) return { ok: false, message: 'label is too long.' };

	const locator = trimOrNull(fd.get('locator'));
	if (locator != null && locator.length > 80) {
		return { ok: false, message: 'locator is too long.' };
	}

	const page_start = parsePageInt(fd.get('page_start'));
	if (page_start == null) return { ok: false, message: 'page_start must be 1–99999.' };
	const page_endRaw = parsePageInt(fd.get('page_end'));
	const page_end = page_endRaw ?? page_start;
	if (page_end < page_start) {
		return { ok: false, message: 'page_end must be ≥ page_start.' };
	}

	const parentRaw = trimOrNull(fd.get('parent_id'));
	const parent_id = parentRaw && UUID_RE.test(parentRaw) ? parentRaw : null;

	const sortRaw = String(fd.get('sort_order') ?? '').trim();
	let sort_order = 0;
	if (sortRaw) {
		const n = Number(sortRaw);
		if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 99999) {
			return { ok: false, message: 'sort_order must be 0–99999.' };
		}
		sort_order = n;
	}

	return {
		ok: true,
		payload: {
			book_id,
			parent_id,
			sort_order,
			locator,
			label,
			page_start,
			page_end
		}
	};
}

export async function createOutlineSectionAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const parsed = parseOutlineSectionForm(fd);
	if (!parsed.ok) {
		return fail(400, { kind: 'createOutlineSection' as const, message: parsed.message });
	}

	const { data, error } = await supabase
		.from('book_outline_sections')
		.insert({
			...parsed.payload,
			created_by: userId
		})
		.select('id')
		.single();

	if (error || !data) {
		console.error('[outline] create', error);
		return fail(500, {
			kind: 'createOutlineSection' as const,
			message: error?.message ?? 'Could not create outline section.'
		});
	}

	return {
		kind: 'createOutlineSection' as const,
		success: true as const,
		sectionId: data.id as string
	};
}

export async function updateOutlineSectionAction(supabase: SupabaseClient, fd: FormData) {
	const sectionId = String(fd.get('section_id') ?? '').trim();
	if (!UUID_RE.test(sectionId)) {
		return fail(400, {
			kind: 'updateOutlineSection' as const,
			sectionId,
			message: 'Invalid section id.'
		});
	}

	const parsed = parseOutlineSectionForm(fd);
	if (!parsed.ok) {
		return fail(400, {
			kind: 'updateOutlineSection' as const,
			sectionId,
			message: parsed.message
		});
	}

	const { error } = await supabase
		.from('book_outline_sections')
		.update({
			parent_id: parsed.payload.parent_id,
			sort_order: parsed.payload.sort_order,
			locator: parsed.payload.locator,
			label: parsed.payload.label,
			page_start: parsed.payload.page_start,
			page_end: parsed.payload.page_end
		})
		.eq('id', sectionId)
		.is('deleted_at', null);

	if (error) {
		console.error('[outline] update', error);
		return fail(500, {
			kind: 'updateOutlineSection' as const,
			sectionId,
			message: error.message
		});
	}

	return {
		kind: 'updateOutlineSection' as const,
		success: true as const,
		sectionId
	};
}

export async function softDeleteOutlineSectionAction(supabase: SupabaseClient, fd: FormData) {
	const sectionId = String(fd.get('section_id') ?? '').trim();
	if (!UUID_RE.test(sectionId)) {
		return fail(400, {
			kind: 'softDeleteOutlineSection' as const,
			sectionId,
			message: 'Invalid section id.'
		});
	}

	const { error } = await supabase
		.from('book_outline_sections')
		.update({ deleted_at: new Date().toISOString() })
		.eq('id', sectionId)
		.is('deleted_at', null);

	if (error) {
		console.error('[outline] soft-delete', error);
		return fail(500, {
			kind: 'softDeleteOutlineSection' as const,
			sectionId,
			message: error.message
		});
	}

	return {
		kind: 'softDeleteOutlineSection' as const,
		success: true as const,
		sectionId
	};
}

export async function pasteOutlineSectionsAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const book_id = String(fd.get('book_id') ?? '').trim();
	if (!UUID_RE.test(book_id)) {
		return fail(400, { kind: 'pasteOutlineSections' as const, message: 'Book is required.' });
	}

	const tsv = String(fd.get('tsv') ?? '');
	const { rows, skipped } = parseOutlineTsv(tsv);
	if (rows.length === 0) {
		return fail(400, {
			kind: 'pasteOutlineSections' as const,
			message: skipped
				? 'No valid TSV rows (expected locator\\tlabel\\tpages).'
				: 'Paste at least one TSV row.'
		});
	}
	if (rows.length > 500) {
		return fail(400, {
			kind: 'pasteOutlineSections' as const,
			message: 'At most 500 outline rows per paste.'
		});
	}

	const { data: existing, error: existErr } = await supabase
		.from('book_outline_sections')
		.select('sort_order')
		.eq('book_id', book_id)
		.is('deleted_at', null)
		.order('sort_order', { ascending: false })
		.limit(1);

	if (existErr) {
		console.error('[outline] paste max sort', existErr);
		return fail(500, {
			kind: 'pasteOutlineSections' as const,
			message: existErr.message
		});
	}

	let nextSort = ((existing?.[0]?.sort_order as number | undefined) ?? -1) + 1;

	const insertRows = rows.map((r) => ({
		book_id,
		parent_id: null as string | null,
		sort_order: nextSort++,
		locator: r.locator,
		label: r.label,
		page_start: r.pageStart,
		page_end: r.pageEnd,
		created_by: userId
	}));

	const { error } = await supabase.from('book_outline_sections').insert(insertRows);
	if (error) {
		console.error('[outline] paste insert', error);
		return fail(500, {
			kind: 'pasteOutlineSections' as const,
			message: error.message
		});
	}

	return {
		kind: 'pasteOutlineSections' as const,
		success: true as const,
		inserted: insertRows.length,
		skipped
	};
}

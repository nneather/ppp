import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server helpers for `book_passage_sections` — curated monograph sections
 * with biblical range + pages ([249]). Not the scripture index; not essays.
 *
 * Form-action result: `{ kind, success?, message?, sectionId? }`.
 */

export type PassageSectionActionKind =
	| 'createPassageSection'
	| 'updatePassageSection'
	| 'softDeletePassageSection';

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

export type PassageSectionPayload = {
	book_id: string;
	label: string | null;
	bible_book: string;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
	page_start: string;
	page_end: string | null;
};

export type PassageSectionParseResult =
	| { ok: true; payload: PassageSectionPayload }
	| { ok: false; message: string };

export function parsePassageSectionForm(fd: FormData): PassageSectionParseResult {
	const book_id = String(fd.get('book_id') ?? '').trim();
	if (!UUID_RE.test(book_id)) return { ok: false, message: 'Book is required.' };

	const bible_book = String(fd.get('bible_book') ?? '').trim();
	if (!bible_book) return { ok: false, message: 'Bible book is required.' };

	const chapter_start = parseChapterOrVerse(fd.get('chapter_start'), 199);
	if (
		fd.get('chapter_start') != null &&
		String(fd.get('chapter_start')).trim() !== '' &&
		chapter_start == null
	) {
		return { ok: false, message: 'chapter_start must be 0–199.' };
	}
	const verse_start = parseChapterOrVerse(fd.get('verse_start'), 999);
	if (
		fd.get('verse_start') != null &&
		String(fd.get('verse_start')).trim() !== '' &&
		verse_start == null
	) {
		return { ok: false, message: 'verse_start must be 0–999.' };
	}
	const chapter_end = parseChapterOrVerse(fd.get('chapter_end'), 199);
	if (
		fd.get('chapter_end') != null &&
		String(fd.get('chapter_end')).trim() !== '' &&
		chapter_end == null
	) {
		return { ok: false, message: 'chapter_end must be 0–199.' };
	}
	const verse_end = parseChapterOrVerse(fd.get('verse_end'), 999);
	if (
		fd.get('verse_end') != null &&
		String(fd.get('verse_end')).trim() !== '' &&
		verse_end == null
	) {
		return { ok: false, message: 'verse_end must be 0–999.' };
	}

	const page_start = String(fd.get('page_start') ?? '').trim();
	if (!page_start) return { ok: false, message: 'page_start is required.' };
	if (page_start.length > 50) return { ok: false, message: 'page_start is too long.' };

	const page_end = trimOrNull(fd.get('page_end'));
	if (page_end != null && page_end.length > 50) {
		return { ok: false, message: 'page_end is too long.' };
	}

	const label = trimOrNull(fd.get('label'));
	if (label != null && label.length > 200) {
		return { ok: false, message: 'label is too long.' };
	}

	return {
		ok: true,
		payload: {
			book_id,
			label,
			bible_book,
			chapter_start,
			verse_start,
			chapter_end,
			verse_end,
			page_start,
			page_end
		}
	};
}

export async function createPassageSectionAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const parsed = parsePassageSectionForm(fd);
	if (!parsed.ok) {
		return fail(400, { kind: 'createPassageSection' as const, message: parsed.message });
	}

	const { data, error } = await supabase
		.from('book_passage_sections')
		.insert({
			...parsed.payload,
			created_by: userId
		})
		.select('id')
		.single();

	if (error || !data) {
		console.error('[passage-section] create', error);
		return fail(500, {
			kind: 'createPassageSection' as const,
			message: error?.message ?? 'Could not create passage section.'
		});
	}

	return {
		kind: 'createPassageSection' as const,
		success: true as const,
		sectionId: data.id as string
	};
}

export async function updatePassageSectionAction(supabase: SupabaseClient, fd: FormData) {
	const sectionId = String(fd.get('section_id') ?? '').trim();
	if (!UUID_RE.test(sectionId)) {
		return fail(400, {
			kind: 'updatePassageSection' as const,
			sectionId,
			message: 'Invalid section id.'
		});
	}

	const parsed = parsePassageSectionForm(fd);
	if (!parsed.ok) {
		return fail(400, {
			kind: 'updatePassageSection' as const,
			sectionId,
			message: parsed.message
		});
	}

	const { error } = await supabase
		.from('book_passage_sections')
		.update({
			label: parsed.payload.label,
			bible_book: parsed.payload.bible_book,
			chapter_start: parsed.payload.chapter_start,
			verse_start: parsed.payload.verse_start,
			chapter_end: parsed.payload.chapter_end,
			verse_end: parsed.payload.verse_end,
			page_start: parsed.payload.page_start,
			page_end: parsed.payload.page_end
		})
		.eq('id', sectionId)
		.is('deleted_at', null);

	if (error) {
		console.error('[passage-section] update', error);
		return fail(500, {
			kind: 'updatePassageSection' as const,
			sectionId,
			message: error.message
		});
	}

	return {
		kind: 'updatePassageSection' as const,
		success: true as const,
		sectionId
	};
}

export async function softDeletePassageSectionAction(supabase: SupabaseClient, fd: FormData) {
	const sectionId = String(fd.get('section_id') ?? '').trim();
	if (!UUID_RE.test(sectionId)) {
		return fail(400, {
			kind: 'softDeletePassageSection' as const,
			sectionId,
			message: 'Invalid section id.'
		});
	}

	const { error } = await supabase
		.from('book_passage_sections')
		.update({ deleted_at: new Date().toISOString() })
		.eq('id', sectionId)
		.is('deleted_at', null);

	if (error) {
		console.error('[passage-section] soft-delete', error);
		return fail(500, {
			kind: 'softDeletePassageSection' as const,
			sectionId,
			message: error.message
		});
	}

	return {
		kind: 'softDeletePassageSection' as const,
		success: true as const,
		sectionId
	};
}

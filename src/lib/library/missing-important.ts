/**
 * Shared IMPORTANT_FIELDS / missing-citation helpers — client-safe.
 * Server `book-actions` re-exports these for save-time auto-flag.
 */

import type { AuthorRole, WorkType } from '$lib/types/library';

export const IMPORTANT_FIELDS = ['title', 'author', 'editor', 'genre', 'year', 'publisher'] as const;
export type ImportantField = (typeof IMPORTANT_FIELDS)[number];

/** Minimal author shape for missing-field checks (form rows or detail authors). */
export type MissingImportantAuthor = {
	role: AuthorRole;
	person_id?: string | null;
	name?: string | null;
	/** Detail rows use `person_label` instead of `name`. */
	person_label?: string | null;
	/** Allowed so form AuthorFormEntry objects pass without stripping. */
	sort_order?: number;
};

function authorEntryPresent(e: MissingImportantAuthor, role: AuthorRole): boolean {
	if (e.role !== role) return false;
	if (e.person_id?.trim()) return true;
	if ((e.name?.trim().length ?? 0) > 0) return true;
	return (e.person_label?.trim().length ?? 0) > 0;
}

/**
 * Compute which IMPORTANT_FIELDS are missing. Used by save-time auto-flag,
 * book-form preview, and book-detail citation incomplete hint.
 */
export function computeMissingImportant(p: {
	title: string | null;
	genre: string | null;
	work_type: WorkType;
	year: number | null;
	publisher: string | null;
	authors: MissingImportantAuthor[];
	no_attributed_author?: boolean;
}): ImportantField[] {
	const out: ImportantField[] = [];
	if (!p.title?.trim()) out.push('title');
	if (!p.no_attributed_author) {
		if (p.work_type === 'monograph') {
			if (!p.authors.some((a) => authorEntryPresent(a, 'author'))) out.push('author');
		} else if (!p.authors.some((a) => authorEntryPresent(a, 'editor'))) {
			out.push('editor');
		}
	}
	if (!p.genre) out.push('genre');
	if (p.year == null) out.push('year');
	if (!p.publisher?.trim()) out.push('publisher');
	return out;
}

/** Amber caption for draft-copy surfaces. */
export function incompleteCitationCaption(
	missing: ImportantField[],
	needsReview: boolean
): string | null {
	if (missing.length > 0) {
		return `Citation may be incomplete — missing: ${missing.join(', ')}.`;
	}
	if (needsReview) {
		return 'Citation may be incomplete — flagged for review.';
	}
	return null;
}

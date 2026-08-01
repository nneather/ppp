/**
 * Client-safe view-models for paper sources ([188]).
 *
 * A source is a live library citation target: a catalog book (owned or
 * not-owned stub) XOR an essay inside a catalog book. Citation inputs are
 * hydrated server-side by `server/paper-loaders.ts` so rows can copy
 * Turabian footnote / short form / bibliography without extra fetches.
 */
import type { BookCitationInput, EssayCitationInput } from '$lib/library/turabian';

export type PaperBookSourceView = {
	kind: 'book';
	sourceId: string;
	groupId: string | null;
	notes: string | null;
	/** Sort/citation-ready book input (title, authors, pub facts). */
	citation: BookCitationInput;
	owned: boolean;
	authorsLabel: string | null;
};

export type PaperEssaySourceView = {
	kind: 'essay';
	sourceId: string;
	groupId: string | null;
	notes: string | null;
	essayId: string;
	essay: EssayCitationInput & { essay_title: string };
	/** Parent volume citation input — required for essay formatters. */
	volume: BookCitationInput;
	parentBookId: string;
	parentOwned: boolean;
	authorsLabel: string | null;
};

export type PaperSourceView = PaperBookSourceView | PaperEssaySourceView;

export function paperSourceTitle(source: PaperSourceView): string {
	if (source.kind === 'book') return source.citation.title?.trim() || '(untitled)';
	return source.essay.essay_title.trim() || '(untitled essay)';
}

/** Book id behind the source (the essay's parent volume for essays). */
export function paperSourceBookId(source: PaperSourceView): string {
	return source.kind === 'book' ? source.citation.id : source.parentBookId;
}

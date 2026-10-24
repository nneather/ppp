/**
 * Client-safe view-models for paper sources ([188]).
 *
 * A source is a catalog book, an essay inside a book, or a journal article.
 * Citation inputs are hydrated server-side by `server/paper-loaders.ts` so
 * rows can copy Turabian footnote / short form / bibliography without extra fetches.
 */
import type {
	BookCitationInput,
	EssayCitationInput,
	JournalArticleCitationInput
} from '$lib/library/turabian';
import type { StudyUsage } from './source-usage';

/** Live junction row whose catalog book, essay, or article was soft-deleted. */
export type OrphanPaperSource = {
	sourceId: string;
	kind: 'book' | 'essay' | 'article';
	notes: string | null;
};

export type PaperBookSourceView = {
	kind: 'book';
	sourceId: string;
	groupId: string | null;
	usage: StudyUsage;
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
	usage: StudyUsage;
	notes: string | null;
	essayId: string;
	essay: EssayCitationInput & { essay_title: string };
	/** Parent volume citation input — required for essay formatters. */
	volume: BookCitationInput;
	parentBookId: string;
	parentOwned: boolean;
	authorsLabel: string | null;
};

export type PaperArticleSourceView = {
	kind: 'article';
	sourceId: string;
	groupId: string | null;
	usage: StudyUsage;
	notes: string | null;
	articleId: string;
	article: JournalArticleCitationInput;
	authorsLabel: string | null;
};

export type PaperSourceView = PaperBookSourceView | PaperEssaySourceView | PaperArticleSourceView;

/** Live research group on a paper (sorted by sort_order by the loader). */
export type PaperGroupView = {
	id: string;
	name: string;
	sort_order: number;
};

export type PaperSourceBucket<T extends { groupId: string | null }> = {
	/** Null = the ungrouped bucket (always first). */
	group: PaperGroupView | null;
	sources: T[];
};

/**
 * Bucket sources for rendering: ungrouped first, then groups in the given
 * (already sorted) order. Sources keep their relative order inside each
 * bucket. A source pointing at a group that is no longer live falls back to
 * ungrouped rather than disappearing (same class as the orphan-source
 * finding in decision 189).
 */
export function groupPaperSources<T extends { groupId: string | null }>(
	sources: T[],
	groups: PaperGroupView[]
): PaperSourceBucket<T>[] {
	const byGroup = new Map<string, T[]>(groups.map((g) => [g.id, []]));
	const ungrouped: T[] = [];
	for (const s of sources) {
		const bucket = s.groupId ? byGroup.get(s.groupId) : undefined;
		if (bucket) bucket.push(s);
		else ungrouped.push(s);
	}
	return [
		{ group: null, sources: ungrouped },
		...groups.map((g) => ({ group: g, sources: byGroup.get(g.id) ?? [] }))
	];
}

export function paperSourceTitle(source: PaperSourceView): string {
	if (source.kind === 'book') return source.citation.title?.trim() || '(untitled)';
	if (source.kind === 'article') return source.article.title.trim() || '(untitled article)';
	return source.essay.essay_title.trim() || '(untitled essay)';
}

/** Book id behind the source. Essays use the parent volume. Articles have none. */
export function paperSourceBookId(source: PaperSourceView): string | null {
	if (source.kind === 'book') return source.citation.id;
	if (source.kind === 'essay') return source.parentBookId;
	return null;
}

/** Catalog identity for set exclude / import. Articles are not set members. */
export function paperSourceCatalog(source: PaperSourceView): {
	bookId: string | null;
	essayId: string | null;
	articleId: string | null;
} {
	if (source.kind === 'essay') return { bookId: null, essayId: source.essayId, articleId: null };
	if (source.kind === 'article') {
		return { bookId: null, essayId: null, articleId: source.articleId };
	}
	return { bookId: source.citation.id, essayId: null, articleId: null };
}

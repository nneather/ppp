/**
 * Warn before a second live paper covers the same work.
 * Exact titles match. A long title that is a prefix of another matches
 * ("Open Your Mouth…" vs the annotated Proverbs 31 title).
 * Passages match on Bible book + chapter, and on verse when both name one.
 */
import { normalizeTitleKey } from '$lib/library/not-owned-queue';
import { parsePassageDisplay } from '$lib/sermons/passage-parse';

const MIN_PREFIX = 24;

export type PaperPassageKey = {
	bibleBook: string;
	chapter: number | null;
	verseStart: number | null;
};

export type LivePaperRef = {
	id: string;
	title: string;
	passageDisplay: string | null;
	/** Structured primary passage when `paper_passages` has one. */
	primary: PaperPassageKey | null;
};

export type PaperDuplicate = {
	id: string;
	title: string;
	reason: 'title' | 'passage';
};

export function titlesNearlyMatch(a: string, b: string): boolean {
	const na = stripArticle(normalizeTitleKey(a));
	const nb = stripArticle(normalizeTitleKey(b));
	if (!na || !nb) return false;
	if (na === nb) return true;
	const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
	return shorter.length >= MIN_PREFIX && longer.startsWith(`${shorter} `);
}

export function passageKeyFromDisplay(display: string | null | undefined): PaperPassageKey | null {
	const first = parsePassageDisplay(display ?? '')[0];
	if (!first) return null;
	return {
		bibleBook: first.bible_book,
		chapter: first.chapter_start,
		verseStart: first.verse_start
	};
}

export function passagesOverlap(a: PaperPassageKey | null, b: PaperPassageKey | null): boolean {
	if (!a || !b) return false;
	if (a.bibleBook.toLowerCase() !== b.bibleBook.toLowerCase()) return false;
	if (a.chapter == null || b.chapter == null) return a.chapter == null && b.chapter == null;
	if (a.chapter !== b.chapter) return false;
	if (a.verseStart == null || b.verseStart == null) return true;
	return a.verseStart === b.verseStart;
}

export function findPaperDuplicate(
	candidate: { title: string; passageDisplay: string | null },
	live: LivePaperRef[]
): PaperDuplicate | null {
	const candidatePassage = passageKeyFromDisplay(candidate.passageDisplay);
	for (const paper of live) {
		if (titlesNearlyMatch(candidate.title, paper.title)) {
			return { id: paper.id, title: paper.title, reason: 'title' };
		}
	}
	for (const paper of live) {
		const theirs = paper.primary ?? passageKeyFromDisplay(paper.passageDisplay);
		if (passagesOverlap(candidatePassage, theirs)) {
			return { id: paper.id, title: paper.title, reason: 'passage' };
		}
	}
	return null;
}

function stripArticle(title: string): string {
	return title.replace(/^(a|an|the)\s+/, '');
}

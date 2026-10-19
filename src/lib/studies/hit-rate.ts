/**
 * Hit rate per commentary per Bible book ([243]).
 *
 * Denominator: expository studies (`topical` false) with a primary passage on
 * that Bible book, dated on or after `books.acquired_on`.
 * Numerator: those studies where the commentary was consulted or cited.
 * Secondary passages are omitted by the caller (they are not in `primaryBooks`).
 * A null `acquired_on` yields no opportunities.
 *
 * Paper date is `due_date` when set, otherwise `created_at`'s civil date.
 * Sermon date is `preached_on`.
 */

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export type HitRateStudy = {
	id: string;
	topical: boolean;
	/** Civil date YYYY-MM-DD. */
	on: string;
	primaryBooks: string[];
	/** Catalog books consulted or cited. An essay source counts as its parent book. */
	usedBookIds: string[];
};

export type HitRateBook = {
	bookId: string;
	acquiredOn: string | null;
	bibleBooks: string[];
};

export type HitRate = {
	bookId: string;
	bibleBook: string;
	used: number;
	opportunities: number;
};

export function paperStudyDate(dueDate: string | null | undefined, createdAt: string): string {
	if (dueDate && YMD_RE.test(dueDate)) return dueDate;
	return createdAt.slice(0, 10);
}

export function formatHitRate(rate: Pick<HitRate, 'used' | 'opportunities'>): string {
	return `${rate.used}/${rate.opportunities}`;
}

export function hitRateKey(bookId: string, bibleBook: string): string {
	return `${bookId}\0${bibleBook}`;
}

/** One row per commentary × Bible book that has at least one opportunity. */
export function computeHitRates(studies: HitRateStudy[], books: HitRateBook[]): HitRate[] {
	const out: HitRate[] = [];
	for (const book of books) {
		if (!book.acquiredOn || !YMD_RE.test(book.acquiredOn)) continue;
		const acquired = book.acquiredOn;
		const seenBooks = new Set<string>();
		for (const bibleBook of book.bibleBooks) {
			if (!bibleBook || seenBooks.has(bibleBook)) continue;
			seenBooks.add(bibleBook);
			let opportunities = 0;
			let used = 0;
			const seenStudies = new Set<string>();
			for (const study of studies) {
				if (seenStudies.has(study.id)) continue;
				if (study.topical) continue;
				if (!YMD_RE.test(study.on) || study.on < acquired) continue;
				if (!study.primaryBooks.includes(bibleBook)) continue;
				seenStudies.add(study.id);
				opportunities += 1;
				if (study.usedBookIds.includes(book.bookId)) used += 1;
			}
			if (opportunities === 0) continue;
			out.push({ bookId: book.bookId, bibleBook, used, opportunities });
		}
	}
	return out;
}

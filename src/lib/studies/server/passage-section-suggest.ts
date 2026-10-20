/**
 * Overlapping `book_passage_sections` for a study passage.
 *
 * Two extra round trips when the study has a passage (sections + coverage),
 * same class as search-passage's band merge. Skipped when there is no range.
 * Index rows are not loaded: they are not import candidates, and band
 * assignment does not drop a section because an index hit exists.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { effectiveSeriesAbbreviation } from '$lib/library/citation-abbreviation';
import { rangesOverlap, searchPassageAbsBounds } from '$lib/library/passage-search-bands';
import type { OverlappingSection } from '$lib/studies/passage-section-suggest';
import type { StructuredStudyPassage, StudyPassageRange } from '$lib/studies/passage-ranges';
import type { StudyParent } from '$lib/studies/study-parent';

export type PassageSectionOverlap = {
	sections: OverlappingSection[];
	coverages: { bookId: string; genre: string | null }[];
	error: string | null;
};

type SectionSeries = {
	id: string;
	abbreviation: string | null;
	deleted_at: string | null;
};

type SectionBook = {
	id: string;
	title: string | null;
	deleted_at: string | null;
	total_volumes: number | null;
	citation_abbreviation: string | null;
	series_id: string | null;
	series: SectionSeries | SectionSeries[] | null;
};

type RawSection = {
	book_id: string;
	label: string | null;
	bible_book: string;
	verse_start_abs: number | null;
	verse_end_abs: number | null;
	page_start: string;
	page_end: string | null;
	books: SectionBook | SectionBook[] | null;
};

type RawCoverage = {
	book_id: string | null;
	books:
		| { id: string; genre: string | null; deleted_at: string | null }
		| { id: string; genre: string | null; deleted_at: string | null }[]
		| null;
};

function one<T>(value: T | T[] | null): T | null {
	if (Array.isArray(value)) return value[0] ?? null;
	return value;
}

function sectionOverlaps(raw: RawSection, ranges: readonly StudyPassageRange[]): boolean {
	const start = raw.verse_start_abs ?? 0;
	const end = raw.verse_end_abs ?? 999999;
	return ranges.some((range) => {
		if (range.bibleBook !== raw.bible_book) return false;
		const bounds = searchPassageAbsBounds({
			chapter: range.chapter,
			verse: range.verse,
			chapterEnd: range.chapterEnd,
			verseEnd: range.verseEnd
		});
		return rangesOverlap(start, end, bounds.start, bounds.end);
	});
}

export async function loadPrimaryStudyPassages(
	supabase: SupabaseClient,
	parent: StudyParent
): Promise<StructuredStudyPassage[]> {
	const query =
		parent.kind === 'paper'
			? supabase
					.from('paper_passages')
					.select('bible_book, chapter_start, verse_start, chapter_end, verse_end')
					.eq('paper_id', parent.id)
					.eq('role', 'primary')
					.is('deleted_at', null)
					.order('sort_order', { ascending: true })
			: supabase
					.from('sermon_passages')
					.select('bible_book, chapter_start, verse_start, chapter_end, verse_end')
					.eq('sermon_id', parent.id)
					.eq('role', 'primary')
					.is('deleted_at', null)
					.order('sort_order', { ascending: true });

	const { data, error } = await query;
	if (error) {
		console.error('[studies] study passages', error);
		return [];
	}
	return (data ?? []) as StructuredStudyPassage[];
}

export async function loadOverlappingPassageSections(
	supabase: SupabaseClient,
	ranges: readonly StudyPassageRange[]
): Promise<PassageSectionOverlap> {
	const bibleBooks = [...new Set(ranges.map((range) => range.bibleBook))];
	if (bibleBooks.length === 0) return { sections: [], coverages: [], error: null };

	const [sectionsRes, coverageRes] = await Promise.all([
		supabase
			.from('book_passage_sections')
			.select(
				`
				book_id,
				label,
				bible_book,
				verse_start_abs,
				verse_end_abs,
				page_start,
				page_end,
				books!inner (
					id,
					title,
					deleted_at,
					total_volumes,
					citation_abbreviation,
					series_id,
					series ( id, abbreviation, deleted_at )
				)
			`
			)
			.in('bible_book', bibleBooks)
			.is('deleted_at', null)
			.order('verse_start_abs', { ascending: true }),
		supabase
			.from('book_bible_coverage')
			.select('book_id, books!inner ( id, genre, deleted_at )')
			.in('bible_book', bibleBooks)
			.not('book_id', 'is', null)
	]);

	if (sectionsRes.error) {
		console.error('[studies] passage sections', sectionsRes.error);
		return { sections: [], coverages: [], error: sectionsRes.error.message };
	}
	if (coverageRes.error) {
		console.error('[studies] passage section coverage', coverageRes.error);
		return { sections: [], coverages: [], error: coverageRes.error.message };
	}

	const sections: OverlappingSection[] = [];
	for (const raw of (sectionsRes.data ?? []) as unknown as RawSection[]) {
		if (!sectionOverlaps(raw, ranges)) continue;
		const book = one(raw.books);
		if (!book || book.deleted_at) continue;
		const series = one(book.series);
		const seriesLive = book.series_id && series && !series.deleted_at ? series : null;
		const vols = book.total_volumes;
		sections.push({
			bookId: raw.book_id,
			title: book.title?.trim() || 'Untitled',
			label: raw.label,
			pageStart: raw.page_start,
			pageEnd: raw.page_end,
			verseStartAbs: raw.verse_start_abs ?? 0,
			verseEndAbs: raw.verse_end_abs ?? 999999,
			seriesAbbreviation: effectiveSeriesAbbreviation({
				citation_abbreviation: book.citation_abbreviation,
				series_abbreviation: seriesLive?.abbreviation ?? null
			}),
			volumeCount: typeof vols === 'number' && vols > 0 ? vols : null
		});
	}

	const coverages: { bookId: string; genre: string | null }[] = [];
	for (const raw of (coverageRes.data ?? []) as unknown as RawCoverage[]) {
		const book = one(raw.books);
		if (!book || book.deleted_at || !raw.book_id) continue;
		coverages.push({ bookId: raw.book_id, genre: book.genre });
	}

	return { sections, coverages, error: null };
}

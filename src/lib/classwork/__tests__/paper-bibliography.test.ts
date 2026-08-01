import { describe, expect, it } from 'vitest';
import type { BookAuthorAssignment } from '$lib/types/library';
import type { BookCitationInput } from '$lib/library/turabian';
import {
	compilePaperBibliography,
	formatPaperBibliographyEntries
} from '../paper-bibliography';
import type {
	PaperBookSourceView,
	PaperEssaySourceView,
	PaperSourceView
} from '../paper-sources';

function author(last: string, first = 'Test', role: BookAuthorAssignment['role'] = 'author') {
	return {
		person_id: `p-${last.toLowerCase()}`,
		person_label: `${first} ${last}`,
		first_name: first,
		middle_name: null,
		last_name: last,
		suffix: null,
		role,
		sort_order: 0
	} satisfies BookAuthorAssignment;
}

function book(id: string, title: string, authors: BookAuthorAssignment[], year = 2001) {
	return {
		id,
		title,
		subtitle: null,
		publisher: 'Test Press',
		publisher_location: 'Chicago',
		year,
		edition: null,
		total_volumes: null,
		original_year: null,
		reprint_publisher: null,
		reprint_location: null,
		reprint_year: null,
		series_name: null,
		series_abbreviation: null,
		volume_number: null,
		genre: null,
		work_type: 'monograph',
		language: 'english',
		authors
	} satisfies BookCitationInput;
}

function bookSource(id: string, title: string, last: string, year = 2001): PaperBookSourceView {
	return {
		kind: 'book',
		sourceId: `src-${id}`,
		groupId: null,
		notes: null,
		citation: book(id, title, [author(last)], year),
		owned: true,
		authorsLabel: last
	};
}

function essaySource(
	essayTitle: string,
	essayAuthors: BookAuthorAssignment[],
	volumeTitle = 'Collected Studies'
): PaperEssaySourceView {
	const volume = {
		...book('vol-1', volumeTitle, [author('Editor', 'Vera', 'editor')], 1998),
		work_type: 'edited_volume' as const
	};
	return {
		kind: 'essay',
		sourceId: `src-essay-${essayTitle}`,
		groupId: null,
		notes: null,
		essayId: `essay-${essayTitle}`,
		essay: {
			essay_title: essayTitle,
			page_start: 10,
			page_end: 25,
			authors: essayAuthors.length > 0 ? essayAuthors : undefined
		},
		volume,
		parentBookId: 'vol-1',
		parentOwned: true,
		authorsLabel: essayAuthors[0]?.last_name ?? null
	};
}

describe('formatPaperBibliographyEntries', () => {
	it('merges books and essays into one alpha-sorted flat list', () => {
		const sources: PaperSourceView[] = [
			bookSource('b1', 'Zeta Studies', 'Zimmerman'),
			essaySource('A Reading of Ruth', [author('Miller', 'Mary')]),
			bookSource('b2', 'Alpha Themes', 'Adams')
		];
		const entries = formatPaperBibliographyEntries(sources);
		expect(entries).toHaveLength(3);
		expect(entries[0]!.plain).toMatch(/^Adams/);
		expect(entries[1]!.plain).toMatch(/^Miller/);
		expect(entries[2]!.plain).toMatch(/^Zimmerman/);
	});

	it('drops unsigned essays (empty bibliography entries)', () => {
		const sources: PaperSourceView[] = [
			bookSource('b1', 'Alpha Themes', 'Adams'),
			essaySource('agape', [])
		];
		const entries = formatPaperBibliographyEntries(sources);
		expect(entries).toHaveLength(1);
		expect(entries[0]!.plain).toMatch(/^Adams/);
	});

	it('keeps a book and an essay from the same volume as separate entries', () => {
		const essay = essaySource('A Reading of Ruth', [author('Miller', 'Mary')]);
		const volumeAsBook: PaperBookSourceView = {
			kind: 'book',
			sourceId: 'src-vol',
			groupId: null,
			notes: null,
			citation: essay.volume,
			owned: true,
			authorsLabel: 'Editor'
		};
		const entries = formatPaperBibliographyEntries([essay, volumeAsBook]);
		expect(entries).toHaveLength(2);
	});
});

describe('compilePaperBibliography', () => {
	it('joins plain with blank lines and html with <p> blocks', () => {
		const compiled = compilePaperBibliography([
			bookSource('b1', 'Alpha Themes', 'Adams'),
			bookSource('b2', 'Zeta Studies', 'Zimmerman')
		]);
		expect(compiled.plain.split('\n\n')).toHaveLength(2);
		expect(compiled.html.match(/<p>/g)).toHaveLength(2);
		expect(compiled.plain.indexOf('Adams')).toBeLessThan(compiled.plain.indexOf('Zimmerman'));
	});

	it('returns empty strings for no sources', () => {
		const compiled = compilePaperBibliography([]);
		expect(compiled.plain).toBe('');
		expect(compiled.html).toBe('');
	});
});

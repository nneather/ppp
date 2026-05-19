import { describe, expect, it } from 'vitest';
import { formatEssayFootnote } from '../article';
import { formatBibliography, formatFootnote } from '../format';
import { resolveCitationSourceType } from '../dispatch';
import type { BookCitationInput } from '../types';

function book(overrides: Partial<BookCitationInput>): BookCitationInput {
	return {
		id: '00000000-0000-0000-0000-000000000001',
		title: 'Title',
		subtitle: null,
		publisher: 'Publisher',
		publisher_location: 'Grand Rapids, MI',
		year: 1994,
		edition: null,
		total_volumes: null,
		original_year: null,
		reprint_publisher: null,
		reprint_location: null,
		reprint_year: null,
		series_name: null,
		series_abbreviation: null,
		volume_number: null,
		genre: 'Theology',
		work_type: 'monograph',
		language: 'english',
		authors: [
			{
				person_id: 'p1',
				person_label: 'V. Philips Long',
				role: 'author',
				sort_order: 0
			}
		],
		...overrides
	};
}

describe('resolveCitationSourceType', () => {
	it('dispatches bible genre', () => {
		expect(resolveCitationSourceType(book({ genre: 'Bibles' }))).toBe('bible');
	});

	it('dispatches work_type reference_work', () => {
		expect(
			resolveCitationSourceType(
				book({
					work_type: 'reference_work',
					genre: 'Biblical Reference',
					authors: [
						{
							person_id: 'e1',
							person_label: 'D. A. Carson',
							role: 'editor',
							sort_order: 0
						}
					]
				})
			)
		).toBe('reference-work-edited');
	});

	it('dispatches work_type edited_volume', () => {
		expect(
			resolveCitationSourceType(
				book({
					work_type: 'edited_volume',
					authors: [
						{
							person_id: 'e1',
							person_label: 'William S. Barker',
							role: 'editor',
							sort_order: 0
						}
					]
				})
			)
		).toBe('edited-volume');
	});

	it('dispatches commentary in series', () => {
		expect(
			resolveCitationSourceType(
				book({
					genre: 'Commentary',
					series_name: 'Word Biblical Commentary',
					series_abbreviation: 'WBC'
				})
			)
		).toBe('commentary-in-series');
	});

	it('dispatches edited volume when only editors', () => {
		expect(
			resolveCitationSourceType(
				book({
					authors: [
						{
							person_id: 'e1',
							person_label: 'William S. Barker',
							role: 'editor',
							sort_order: 0
						}
					]
				})
			)
		).toBe('edited-volume');
	});

	it('dispatches translator book', () => {
		expect(
			resolveCitationSourceType(
				book({
					authors: [
						{
							person_id: 'a1',
							person_label: 'Gerhard Maier',
							role: 'author',
							sort_order: 0
						},
						{
							person_id: 't1',
							person_label: 'Robert W. Yarbrough',
							role: 'translator',
							sort_order: 1
						}
					]
				})
			)
		).toBe('book-with-translator');
	});

	it('dispatches book with editor', () => {
		expect(
			resolveCitationSourceType(
				book({
					authors: [
						{
							person_id: 'a1',
							person_label: 'C. S. Lewis',
							role: 'author',
							sort_order: 0
						},
						{
							person_id: 'e1',
							person_label: 'Walter Hooper',
							role: 'editor',
							sort_order: 1
						}
					]
				})
			)
		).toBe('book-with-editor');
	});
});

describe('formatFootnote', () => {
	it('formats single-author book (Covenant §17.1.1)', () => {
		const b = book({
			title: 'The Art of Biblical History',
			authors: [
				{
					person_id: 'p1',
					person_label: 'V. Philips Long',
					role: 'author',
					sort_order: 0
				}
			],
			publisher: 'Zondervan',
			year: 1994
		});
		expect(formatFootnote(b, { page: '123' }).plain).toBe(
			'V. Philips Long, The Art of Biblical History (Grand Rapids, MI: Zondervan, 1994), 123.'
		);
	});

	it('formats two-author book', () => {
		const b = book({
			title: 'Churches, Cutures & Leadership: A Practical Theology of Congregations and Ethnicities',
			authors: [
				{
					person_id: 'a1',
					person_label: 'Mark Lau Branson',
					role: 'author',
					sort_order: 0
				},
				{
					person_id: 'a2',
					person_label: 'Juan F. Martínez',
					role: 'author',
					sort_order: 1
				}
			],
			publisher: 'IVP Academic',
			publisher_location: 'Downers Grove, IL',
			year: 2011
		});
		expect(formatFootnote(b, { page: '160' }).plain).toBe(
			'Mark Lau Branson and Juan F. Martínez, Churches, Cutures & Leadership: A Practical Theology of Congregations and Ethnicities (Downers Grove, IL: IVP Academic, 2011), 160.'
		);
	});

	it('formats four-author book with et al. in note', () => {
		const b = book({
			title: 'Dancing in the Dark',
			authors: [
				{ person_id: '1', person_label: 'Quentin J. Schultze', role: 'author', sort_order: 0 },
				{ person_id: '2', person_label: 'Roy M. Anker', role: 'author', sort_order: 1 },
				{ person_id: '3', person_label: 'James D. Bratt', role: 'author', sort_order: 2 },
				{ person_id: '4', person_label: 'William D. Romanowski', role: 'author', sort_order: 3 }
			],
			publisher: 'William B. Eerdmans',
			publisher_location: 'Grand Rapids, MI',
			year: 1991
		});
		expect(formatFootnote(b, { page: '189' }).plain).toBe(
			'Quentin J. Schultze et al., Dancing in the Dark (Grand Rapids, MI: William B. Eerdmans, 1991), 189.'
		);
	});

	it('formats book with editor as author', () => {
		const b = book({
			title: 'Sermons that Shaped America',
			work_type: 'edited_volume',
			authors: [
				{
					person_id: 'e1',
					person_label: 'William S. Barker',
					role: 'editor',
					sort_order: 0
				},
				{
					person_id: 'e2',
					person_label: 'Samuel T. Long',
					role: 'editor',
					sort_order: 1
				}
			],
			publisher: 'P&R Publishing',
			publisher_location: 'Phillipsburg, NJ',
			year: 2004
		});
		expect(formatFootnote(b, { page: '79' }).plain).toBe(
			'William S. Barker and Samuel T. Long, eds., Sermons that Shaped America (Phillipsburg, NJ: P&R Publishing, 2004), 79.'
		);
	});

	it('formats book with author and translator', () => {
		const b = book({
			title: 'Biblical Hermeneutics',
			authors: [
				{
					person_id: 'a1',
					person_label: 'Gerhard Maier',
					role: 'author',
					sort_order: 0
				},
				{
					person_id: 't1',
					person_label: 'Robert W. Yarbrough',
					role: 'translator',
					sort_order: 1
				}
			],
			publisher: 'Crossway Books',
			publisher_location: 'Wheaton, IL',
			year: 1994
		});
		expect(formatFootnote(b, { page: '17' }).plain).toBe(
			'Gerhard Maier, Biblical Hermeneutics, trans. Robert W. Yarbrough (Wheaton, IL: Crossway Books, 1994), 17.'
		);
	});

	it('formats book with author and editor (Lewis)', () => {
		const b = book({
			title: 'Christian Reflections',
			authors: [
				{
					person_id: 'a1',
					person_label: 'C. S. Lewis',
					role: 'author',
					sort_order: 0
				},
				{
					person_id: 'e1',
					person_label: 'Walter Hooper',
					role: 'editor',
					sort_order: 1
				}
			],
			publisher: 'William B. Eerdmans',
			publisher_location: 'Grand Rapids, MI',
			year: 1967
		});
		expect(formatFootnote(b, { page: '83' }).plain).toBe(
			'C. S. Lewis, Christian Reflections, ed. Walter Hooper (Grand Rapids, MI: William B. Eerdmans, 1967), 83.'
		);
	});

	it('formats revised edition in note', () => {
		const b = book({
			title: 'Christ-Centered Preaching: Redeeming the Expository Sermon',
			authors: [{ person_id: 'a1', person_label: 'Bryan Chapell', role: 'author', sort_order: 0 }],
			edition: '2nd ed.',
			publisher: 'Baker Academic',
			publisher_location: 'Grand Rapids, MI',
			year: 2005
		});
		expect(formatFootnote(b, { page: '22' }).plain).toBe(
			'Bryan Chapell, Christ-Centered Preaching: Redeeming the Expository Sermon, 2nd ed. (Grand Rapids, MI: Baker Academic, 2005), 22.'
		);
	});

	it('formats reprint', () => {
		const b = book({
			title: 'Sermons for Christian Families',
			authors: [
				{
					person_id: 'p1',
					person_label: 'Edward Payson',
					role: 'author',
					sort_order: 0
				}
			],
			original_year: 1832,
			reprint_location: 'Birmingham, AL',
			reprint_publisher: 'Solid Ground Christian Books',
			reprint_year: 2009,
			year: 2009
		});
		expect(formatFootnote(b, { page: '55' }).plain).toBe(
			'Edward Payson, Sermons for Christian Families (1832; repr., Birmingham, AL: Solid Ground Christian Books, 2009), 55.'
		);
	});

	it('formats multi-volume with vol:page', () => {
		const b = book({
			title: 'Systematic Theology',
			authors: [{ person_id: 'a1', person_label: 'Charles Hodge', role: 'author', sort_order: 0 }],
			volume_number: '2',
			publisher: 'Eerdmans',
			publisher_location: 'Grand Rapids, MI',
			year: 1946
		});
		expect(formatFootnote(b, { page: '257' }).plain).toBe(
			'Charles Hodge, Systematic Theology (Grand Rapids, MI: Eerdmans, 1946), 2:257.'
		);
	});

	it('formats book in series', () => {
		const b = book({
			title: '1, 2, 3 John',
			authors: [{ person_id: 'a1', person_label: 'Stephen S. Smalley', role: 'author', sort_order: 0 }],
			series_name: 'Word Biblical Commentary',
			series_abbreviation: 'WBC',
			publisher: 'Word Books',
			publisher_location: 'Waco, TX',
			year: 1984
		});
		expect(formatFootnote(b, { page: '82' }).plain).toBe(
			'Stephen S. Smalley, 1, 2, 3 John, WBC (Waco, TX: Word Books, 1984), 82.'
		);
	});

	it('formats bible footnote only', () => {
		const fn = formatFootnote(book({ genre: 'Bibles' }), {
			page: 'Gen. 1:1',
			bibleVersion: 'English Standard Version'
		});
		expect(fn.plain).toBe('Gen. 1:1 (English Standard Version).');
		expect(formatBibliography(book({ genre: 'Bibles' })).plain).toBe('');
	});

	it('formats ibid short footnote', () => {
		const b = book({
			title: 'The Art of Biblical History',
			authors: [
				{ person_id: 'p1', person_label: 'V. Philips Long', role: 'author', sort_order: 0 }
			]
		});
		expect(formatFootnote(b, { shortForm: 'ibid', page: '42' }).plain).toBe('Ibid., 42.');
	});

	it('formats author-title short footnote', () => {
		const b = book({
			title: 'The Art of Biblical History',
			authors: [
				{ person_id: 'p1', person_label: 'V. Philips Long', role: 'author', sort_order: 0 }
			]
		});
		expect(formatFootnote(b, { shortForm: 'short', page: '42' }).plain).toBe(
			'long, The Art of Biblical History, 42.'
		);
	});

	it('formats author+editor+translator footnote', () => {
		const b = book({
			title: 'Biblical Hermeneutics',
			authors: [
				{ person_id: 'a1', person_label: 'Gerhard Maier', role: 'author', sort_order: 0 },
				{ person_id: 'e1', person_label: 'J. P. Lange', role: 'editor', sort_order: 1 },
				{ person_id: 't1', person_label: 'Robert W. Yarbrough', role: 'translator', sort_order: 2 }
			],
			publisher: 'Crossway Books',
			year: 1994
		});
		const fn = formatFootnote(b, { page: '12' });
		expect(fn.plain).toContain('Gerhard Maier');
		expect(fn.plain).toContain('trans. Robert W. Yarbrough');
		expect(fn.html).toContain('<i>');
	});
});

describe('formatBibliography', () => {
	it('formats single-author bibliography entry', () => {
		const b = book({
			title: 'The Art of Biblical History',
			authors: [
				{
					person_id: 'p1',
					person_label: 'V. Philips Long',
					role: 'author',
					sort_order: 0
				}
			],
			publisher: 'Zondervan',
			year: 1994
		});
		expect(formatBibliography(b).plain).toBe(
			'Long, V. Philips. The Art of Biblical History. Grand Rapids, MI: Zondervan, 1994.'
		);
	});

	it('formats three-author bibliography with and before last name', () => {
		const b = book({
			title: 'Introduction to Biblical Interpretation',
			authors: [
				{ person_id: '1', person_label: 'William W. Klein', role: 'author', sort_order: 0 },
				{
					person_id: '2',
					person_label: 'Robert L. Hubbard Jr.',
					last_name: 'Hubbard',
					first_name: 'Robert L.',
					suffix: 'Jr.',
					role: 'author',
					sort_order: 1
				},
				{ person_id: '3', person_label: 'Craig L. Blomberg', role: 'author', sort_order: 2 }
			],
			publisher: 'Word Books',
			publisher_location: 'Dallas',
			year: 1993
		});
		expect(formatBibliography(b).plain).toBe(
			'Klein, William W., Robert L. Hubbard Jr., and Craig L. Blomberg. Introduction to Biblical Interpretation. Dallas: Word Books, 1993.'
		);
	});

	it('includes translator in bibliography', () => {
		const b = book({
			title: 'Biblical Hermeneutics',
			authors: [
				{
					person_id: 'a1',
					person_label: 'Gerhard Maier',
					role: 'author',
					sort_order: 0
				},
				{
					person_id: 't1',
					person_label: 'Robert W. Yarbrough',
					role: 'translator',
					sort_order: 1
				}
			],
			publisher: 'Crossway Books',
			publisher_location: 'Wheaton, IL',
			year: 1994
		});
		expect(formatBibliography(b).plain).toBe(
			'Maier, Gerhard. Biblical Hermeneutics. Translated by Robert W. Yarbrough. Wheaton, IL: Crossway Books, 1994.'
		);
	});

	it('formats author with editor in bibliography', () => {
		const b = book({
			title: 'Christian Reflections',
			authors: [
				{
					person_id: 'a1',
					person_label: 'C. S. Lewis',
					role: 'author',
					sort_order: 0
				},
				{
					person_id: 'e1',
					person_label: 'Walter Hooper',
					role: 'editor',
					sort_order: 1
				}
			],
			publisher: 'William B. Eerdmans',
			publisher_location: 'Grand Rapids, MI',
			year: 1967
		});
		expect(formatBibliography(b).plain).toBe(
			'Lewis, C. S. Christian Reflections. Edited by Walter Hooper. Grand Rapids, MI: William B. Eerdmans, 1967.'
		);
	});

	it('capitalizes edition in bibliography', () => {
		const b = book({
			title: 'Christ-Centered Preaching: Redeeming the Expository Sermon',
			authors: [{ person_id: 'a1', person_label: 'Bryan Chapell', role: 'author', sort_order: 0 }],
			edition: '2nd ed.',
			publisher: 'Baker Academic',
			publisher_location: 'Grand Rapids, MI',
			year: 2005
		});
		expect(formatBibliography(b).plain).toBe(
			'Chapell, Bryan. Christ-Centered Preaching: Redeeming the Expository Sermon. 2nd ed. Grand Rapids, MI: Baker Academic, 2005.'
		);
	});

	it('formats commentary in series bibliography with edition and volumes', () => {
		const b = book({
			genre: 'Commentary',
			title:
				'Theological and Homiletical Commentary on the Acts of the Apostles: Specially Designed and Adapted for the Use of Ministers and Students',
			authors: [
				{ person_id: 'a1', person_label: 'G. V. Lechler', role: 'author', sort_order: 0 },
				{ person_id: 'a2', person_label: 'K. Gerok', role: 'author', sort_order: 1 },
				{ person_id: 'e1', person_label: 'J. P. Lange', role: 'editor', sort_order: 2 },
				{ person_id: 't1', person_label: 'Paton J. Gloag', role: 'translator', sort_order: 3 }
			],
			edition: '2nd ed.',
			total_volumes: 2,
			series_name: "Clark's Foreign Theological Library",
			publisher: 'T. & T. Clark',
			publisher_location: 'Edinburgh',
			year: 1869
		});
		const bib = formatBibliography(b).plain;
		expect(bib).toContain('Lechler, G. V., and K. Gerok.');
		expect(bib).toContain('Edited by J. P. Lange.');
		expect(bib).toContain('Translated by Paton J. Gloag.');
		expect(bib).toContain('2nd ed.');
		expect(bib).toContain('2 vols.');
		expect(bib).toContain("Clark's Foreign Theological Library.");
		expect(bib).toContain('Edinburgh: T. & T. Clark, 1869.');
	});

	it('formats four-author bibliography with all names', () => {
		const b = book({
			title: 'Communicating for Life',
			authors: [
				{ person_id: '1', person_label: 'Quentin J. Schultze', role: 'author', sort_order: 0 },
				{ person_id: '2', person_label: 'Roy M. Anker', role: 'author', sort_order: 1 },
				{ person_id: '3', person_label: 'James D. Bratt', role: 'author', sort_order: 2 },
				{ person_id: '4', person_label: 'William D. Romanowski', role: 'author', sort_order: 3 }
			],
			publisher: 'Baker Academic',
			year: 2000
		});
		const bib = formatBibliography(b).plain;
		expect(bib).toContain('Schultze, Quentin J.');
		expect(bib).toContain('Romanowski');
	});

	it('formats multi-volume standalone bibliography', () => {
		const b = book({
			title: 'Church Dogmatics',
			authors: [{ person_id: 'a1', person_label: 'Karl Barth', role: 'author', sort_order: 0 }],
			total_volumes: 14,
			publisher: 'T. & T. Clark',
			year: 1936
		});
		expect(formatBibliography(b).plain).toContain('14 vols.');
	});

	it('formats edited_volume with only editors', () => {
		const b = book({
			work_type: 'edited_volume',
			title: 'Dictionary of Paul and His Letters',
			authors: [
				{ person_id: 'e1', person_label: 'Gerald F. Hawthorne', role: 'editor', sort_order: 0 },
				{ person_id: 'e2', person_label: 'Ralph P. Martin', role: 'editor', sort_order: 1 }
			],
			publisher: 'InterVarsity Press',
			year: 1993
		});
		const bib = formatBibliography(b).plain;
		expect(bib).toContain('Hawthorne, Gerald F., and Ralph P. Martin, eds.');
	});

	it('formats dictionary essay s.v. footnote', () => {
		const volume = book({
			work_type: 'reference_work',
			title: 'Anchor Bible Dictionary',
			authors: [
				{ person_id: 'e1', person_label: 'David Noel Freedman', role: 'editor', sort_order: 0 }
			],
			publisher: 'Doubleday',
			year: 1992
		});
		const fn = formatEssayFootnote(
			{ essay_title: 'Abraham', page_start: 35 },
			volume,
			{ page: '35' }
		);
		expect(fn.plain).toContain('s.v. "Abraham,"');
		expect(fn.plain).toContain('Anchor Bible Dictionary');
	});
});

describe('publisher resolution in citations', () => {
	it('uses City: Publisher when location is provided', () => {
		const fn = formatFootnote(
			book({
				publisher: 'IVP Academic',
				publisher_location: 'Downers Grove, IL',
				year: 2010
			})
		).plain;
		expect(fn).toContain('(Downers Grove, IL: IVP Academic, 2010)');
	});

	it('omits city when location is absent', () => {
		const fn = formatFootnote(
			book({
				publisher: 'Zondervan',
				publisher_location: null,
				year: 1994
			})
		).plain;
		expect(fn).toContain('(Zondervan, 1994)');
		expect(fn).not.toContain(': Zondervan');
	});

	it('per-book location overrides registry default semantics via input', () => {
		const fn = formatFootnote(
			book({
				publisher: 'Eerdmans',
				publisher_location: 'London',
				year: 2001
			})
		).plain;
		expect(fn).toContain('(London: Eerdmans, 2001)');
	});
});

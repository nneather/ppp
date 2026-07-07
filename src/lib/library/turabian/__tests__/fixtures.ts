import type { EssayCitationInput } from '../article';
import type { BookCitationInput } from '../types';

/** Shared book builder for Wave 2 QA rows (see docs/library-turabian-fixtures.md). */
export function book(overrides: Partial<BookCitationInput>): BookCitationInput {
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

export type Wave2FixtureRow = {
	id: number;
	slug: string;
	label: string;
	sourceType: string;
	/** pass = formatter matches expected today; fail = gap (it.fails until Session 1+) */
	status: 'pass' | 'fail';
	book: BookCitationInput;
	page?: string;
	essay?: EssayCitationInput;
	expectedFootnote?: string;
	expectedBibliography?: string;
	shortForm?: { kind: 'ibid' | 'short'; page: string; expected: string };
};

export const WAVE2_FIXTURES: Wave2FixtureRow[] = [
	{
		id: 1,
		slug: 'single-author',
		label: 'Single-author monograph (Long)',
		sourceType: 'single-author-book',
		status: 'pass',
		book: book({
			title: 'The Art of Biblical History',
			authors: [
				{ person_id: 'p1', person_label: 'V. Philips Long', role: 'author', sort_order: 0 }
			],
			publisher: 'Zondervan',
			year: 1994
		}),
		page: '123',
		expectedFootnote:
			'V. Philips Long, The Art of Biblical History (Grand Rapids, MI: Zondervan, 1994), 123.',
		expectedBibliography:
			'Long, V. Philips. The Art of Biblical History. Grand Rapids, MI: Zondervan, 1994.'
	},
	{
		id: 2,
		slug: 'two-author',
		label: 'Two-author monograph (Branson / Martínez)',
		sourceType: 'single-author-book',
		status: 'pass',
		book: book({
			title: 'Churches, Cutures & Leadership: A Practical Theology of Congregations and Ethnicities',
			authors: [
				{ person_id: 'a1', person_label: 'Mark Lau Branson', role: 'author', sort_order: 0 },
				{ person_id: 'a2', person_label: 'Juan F. Martínez', role: 'author', sort_order: 1 }
			],
			publisher: 'IVP Academic',
			publisher_location: 'Downers Grove, IL',
			year: 2011
		}),
		page: '160',
		expectedFootnote:
			'Mark Lau Branson and Juan F. Martínez, Churches, Cutures & Leadership: A Practical Theology of Congregations and Ethnicities (Downers Grove, IL: IVP Academic, 2011), 160.',
		expectedBibliography:
			'Branson, Mark Lau, and Juan F. Martínez. Churches, Cutures & Leadership: A Practical Theology of Congregations and Ethnicities. Downers Grove, IL: IVP Academic, 2011.'
	},
	{
		id: 3,
		slug: 'three-author-jr',
		label: 'Three-author monograph with Jr. suffix (Klein / Hubbard / Blomberg)',
		sourceType: 'single-author-book',
		status: 'pass',
		book: book({
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
		}),
		page: '88',
		expectedFootnote:
			'William W. Klein, Robert L. Hubbard Jr., and Craig L. Blomberg, Introduction to Biblical Interpretation (Dallas: Word Books, 1993), 88.',
		expectedBibliography:
			'Klein, William W., Robert L. Hubbard Jr., and Craig L. Blomberg. Introduction to Biblical Interpretation. Dallas: Word Books, 1993.'
	},
	{
		id: 4,
		slug: 'four-plus-authors',
		label: 'Four+ authors — et al. note, all names in bibliography',
		sourceType: 'single-author-book',
		status: 'pass',
		book: book({
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
		}),
		page: '189',
		expectedFootnote:
			'Quentin J. Schultze et al., Dancing in the Dark (Grand Rapids, MI: William B. Eerdmans, 1991), 189.',
		expectedBibliography:
			'Schultze, Quentin J., Roy M. Anker, James D. Bratt, and William D. Romanowski. Dancing in the Dark. Grand Rapids, MI: William B. Eerdmans, 1991.'
	},
	{
		id: 5,
		slug: 'edited-volume',
		label: 'Edited volume — editors lead (Barker / Long)',
		sourceType: 'edited-volume',
		status: 'pass',
		book: book({
			title: 'Sermons that Shaped America',
			work_type: 'edited_volume',
			authors: [
				{ person_id: 'e1', person_label: 'William S. Barker', role: 'editor', sort_order: 0 },
				{ person_id: 'e2', person_label: 'Samuel T. Long', role: 'editor', sort_order: 1 }
			],
			publisher: 'P&R Publishing',
			publisher_location: 'Phillipsburg, NJ',
			year: 2004
		}),
		page: '79',
		expectedFootnote:
			'William S. Barker and Samuel T. Long, eds., Sermons that Shaped America (Phillipsburg, NJ: P&R Publishing, 2004), 79.',
		expectedBibliography:
			'Barker, William S., and Samuel T. Long, eds. Sermons that Shaped America. Phillipsburg, NJ: P&R Publishing, 2004.'
	},
	{
		id: 6,
		slug: 'author-editor',
		label: 'Author + editor (Lewis / Hooper)',
		sourceType: 'book-with-editor',
		status: 'pass',
		book: book({
			title: 'Christian Reflections',
			authors: [
				{ person_id: 'a1', person_label: 'C. S. Lewis', role: 'author', sort_order: 0 },
				{ person_id: 'e1', person_label: 'Walter Hooper', role: 'editor', sort_order: 1 }
			],
			publisher: 'William B. Eerdmans',
			publisher_location: 'Grand Rapids, MI',
			year: 1967
		}),
		page: '83',
		expectedFootnote:
			'C. S. Lewis, Christian Reflections, ed. Walter Hooper (Grand Rapids, MI: William B. Eerdmans, 1967), 83.',
		expectedBibliography:
			'Lewis, C. S. Christian Reflections. Edited by Walter Hooper. Grand Rapids, MI: William B. Eerdmans, 1967.'
	},
	{
		id: 7,
		slug: 'author-translator',
		label: 'Author + translator (Maier / Yarbrough)',
		sourceType: 'book-with-translator',
		status: 'pass',
		book: book({
			title: 'Biblical Hermeneutics',
			authors: [
				{ person_id: 'a1', person_label: 'Gerhard Maier', role: 'author', sort_order: 0 },
				{ person_id: 't1', person_label: 'Robert W. Yarbrough', role: 'translator', sort_order: 1 }
			],
			publisher: 'Crossway Books',
			publisher_location: 'Wheaton, IL',
			year: 1994
		}),
		page: '17',
		expectedFootnote:
			'Gerhard Maier, Biblical Hermeneutics, trans. Robert W. Yarbrough (Wheaton, IL: Crossway Books, 1994), 17.',
		expectedBibliography:
			'Maier, Gerhard. Biblical Hermeneutics. Translated by Robert W. Yarbrough. Wheaton, IL: Crossway Books, 1994.'
	},
	{
		id: 8,
		slug: 'author-editor-translator',
		label: 'Author + editor + translator (Lange commentary pattern)',
		sourceType: 'commentary-in-series',
		status: 'pass',
		book: book({
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
		}),
		page: '44',
		expectedFootnote:
			"G. V. Lechler and K. Gerok, Theological and Homiletical Commentary on the Acts of the Apostles: Specially Designed and Adapted for the Use of Ministers and Students, ed. J. P. Lange, trans. Paton J. Gloag, 2nd ed., Clark's Foreign Theological Library (Edinburgh: T. & T. Clark, 1869), 44.",
		expectedBibliography:
			"Lechler, G. V., and K. Gerok. Theological and Homiletical Commentary on the Acts of the Apostles: Specially Designed and Adapted for the Use of Ministers and Students. Edited by J. P. Lange. Translated by Paton J. Gloag. 2nd ed. 2 vols. Clark's Foreign Theological Library. Edinburgh: T. & T. Clark, 1869."
	},
	{
		id: 9,
		slug: 'revised-edition',
		label: 'Revised edition (Chapell)',
		sourceType: 'single-author-book',
		status: 'pass',
		book: book({
			title: 'Christ-Centered Preaching: Redeeming the Expository Sermon',
			authors: [{ person_id: 'a1', person_label: 'Bryan Chapell', role: 'author', sort_order: 0 }],
			edition: '2nd ed.',
			publisher: 'Baker Academic',
			publisher_location: 'Grand Rapids, MI',
			year: 2005
		}),
		page: '22',
		expectedFootnote:
			'Bryan Chapell, Christ-Centered Preaching: Redeeming the Expository Sermon, 2nd ed. (Grand Rapids, MI: Baker Academic, 2005), 22.',
		expectedBibliography:
			'Chapell, Bryan. Christ-Centered Preaching: Redeeming the Expository Sermon. 2nd ed. Grand Rapids, MI: Baker Academic, 2005.'
	},
	{
		id: 10,
		slug: 'reprint',
		label: 'Reprint — footnote + bibliography (Payson)',
		sourceType: 'single-author-book',
		status: 'pass',
		book: book({
			title: 'Sermons for Christian Families',
			authors: [
				{ person_id: 'p1', person_label: 'Edward Payson', role: 'author', sort_order: 0 }
			],
			publisher: null,
			publisher_location: null,
			year: 2009,
			original_year: 1832,
			reprint_location: 'Birmingham, AL',
			reprint_publisher: 'Solid Ground Christian Books',
			reprint_year: 2009
		}),
		page: '55',
		expectedFootnote:
			'Edward Payson, Sermons for Christian Families (1832; repr., Birmingham, AL: Solid Ground Christian Books, 2009), 55.',
		expectedBibliography:
			'Payson, Edward. Sermons for Christian Families. 1832. Reprint, Birmingham, AL: Solid Ground Christian Books, 2009.'
	},
	{
		id: 11,
		slug: 'multi-volume-page',
		label: 'Multi-volume — vol:page (Hodge vol. 2)',
		sourceType: 'multi-volume',
		status: 'pass',
		book: book({
			title: 'Systematic Theology',
			authors: [{ person_id: 'a1', person_label: 'Charles Hodge', role: 'author', sort_order: 0 }],
			volume_number: '2',
			publisher: 'Eerdmans',
			publisher_location: 'Grand Rapids, MI',
			year: 1946
		}),
		page: '257',
		expectedFootnote:
			'Charles Hodge, Systematic Theology (Grand Rapids, MI: Eerdmans, 1946), 2:257.',
		expectedBibliography:
			'Hodge, Charles. Systematic Theology. Vol. 2. Grand Rapids, MI: Eerdmans, 1946.'
	},
	{
		id: 12,
		slug: 'multi-volume-set',
		label: 'Multi-volume set — total_volumes in bibliography (Barth)',
		sourceType: 'multi-volume',
		status: 'pass',
		book: book({
			title: 'Church Dogmatics',
			authors: [{ person_id: 'a1', person_label: 'Karl Barth', role: 'author', sort_order: 0 }],
			total_volumes: 14,
			publisher: 'T. & T. Clark',
			publisher_location: 'Edinburgh',
			year: 1936
		}),
		page: '12',
		expectedFootnote: 'Karl Barth, Church Dogmatics (Edinburgh: T. & T. Clark, 1936), 12.',
		expectedBibliography:
			'Barth, Karl. Church Dogmatics. 14 vols. Edinburgh: T. & T. Clark, 1936.'
	},
	{
		id: 13,
		slug: 'commentary-in-series',
		label: 'Commentary in series — abbreviated series in note (Smalley / WBC)',
		sourceType: 'commentary-in-series',
		status: 'pass',
		book: book({
			genre: 'Commentary',
			title: '1, 2, 3 John',
			authors: [{ person_id: 'a1', person_label: 'Stephen S. Smalley', role: 'author', sort_order: 0 }],
			series_name: 'Word Biblical Commentary',
			series_abbreviation: 'WBC',
			publisher: 'Word Books',
			publisher_location: 'Waco, TX',
			year: 1984
		}),
		page: '82',
		expectedFootnote:
			'Stephen S. Smalley, 1, 2, 3 John, WBC (Waco, TX: Word Books, 1984), 82.',
		expectedBibliography:
			'Smalley, Stephen S. 1, 2, 3 John. Word Biblical Commentary. Waco, TX: Word Books, 1984.'
	},
	{
		id: 14,
		slug: 'german-reprint',
		label: 'German commentary + reprint (Barth Römerbrief)',
		sourceType: 'standalone-commentary',
		status: 'pass',
		book: book({
			genre: 'Commentary',
			title: 'Der Römerbrief',
			language: 'german',
			authors: [{ person_id: 'a1', person_label: 'Karl Barth', role: 'author', sort_order: 0 }],
			year: 2008,
			original_year: 1922,
			publisher: 'Theologischer Verlag Zürich',
			publisher_location: 'Zürich',
			reprint_location: 'Zürich',
			reprint_publisher: 'Theologischer Verlag Zürich',
			reprint_year: 2008
		}),
		page: '12',
		expectedFootnote:
			'Karl Barth, Der Römerbrief (1922; repr., Zürich: Theologischer Verlag Zürich, 2008), 12.',
		expectedBibliography:
			'Barth, Karl. Der Römerbrief. 1922. Reprint, Zürich: Theologischer Verlag Zürich, 2008.'
	},
	{
		id: 15,
		slug: 'bible',
		label: 'Bible — footnote only, empty bibliography',
		sourceType: 'bible',
		status: 'pass',
		book: book({ genre: 'Bibles', title: 'English Standard Version', authors: [] }),
		page: 'Gen. 1:1',
		expectedFootnote: 'Gen. 1:1 (English Standard Version).',
		expectedBibliography: ''
	},
	{
		id: 16,
		slug: 'unsigned-sv-lexicon',
		label: 'Unsigned lexicon s.v. (BDAG)',
		sourceType: 'reference-work-single-author',
		status: 'fail',
		book: book({
			work_type: 'reference_work',
			genre: 'Greek Language Tools',
			title: 'A Greek-English Lexicon of the New Testament and Other Early Christian Literature',
			authors: [
				{
					person_id: 'a1',
					person_label: 'Walter Bauer',
					role: 'author',
					sort_order: 0
				},
				{
					person_id: 'a2',
					person_label: 'Frederick William Danker',
					role: 'author',
					sort_order: 1
				}
			],
			edition: '3rd ed.',
			publisher: 'University of Chicago Press',
			publisher_location: 'Chicago',
			year: 2000
		}),
		essay: { essay_title: 'ἀγάπη', page_start: 12 },
		page: '12',
		expectedFootnote: 'BDAG, s.v. "ἀγάπη," 12.'
	},
	{
		id: 17,
		slug: 'signed-dictionary-article',
		label: 'Signed dictionary article (ABD — Sanders on Canon)',
		sourceType: 'article-in-reference-work',
		status: 'fail',
		book: book({
			work_type: 'reference_work',
			genre: 'Biblical Reference',
			title: 'Anchor Bible Dictionary',
			volume_number: '1',
			total_volumes: 6,
			authors: [
				{ person_id: 'e1', person_label: 'David Noel Freedman', role: 'editor', sort_order: 0 }
			],
			publisher: 'Doubleday',
			publisher_location: 'New York',
			year: 1992
		}),
		essay: {
			essay_title: 'Canon',
			page_start: 835,
			authors: [
				{
					person_id: 'a1',
					person_label: 'James A. Sanders',
					role: 'author',
					sort_order: 0
				}
			]
		},
		page: '835',
		expectedFootnote:
			'James A. Sanders, "Canon," in David Noel Freedman, ed., Anchor Bible Dictionary (New York: Doubleday, 1992), s.v. "Canon," 835.',
		expectedBibliography:
			'Sanders, James A. "Canon." In Anchor Bible Dictionary, edited by David Noel Freedman. New York: Doubleday, 1992.'
	},
	{
		id: 18,
		slug: 'tdnt-signed-article',
		label: 'TDNT signed article — abbreviated series vol:page (Kittel)',
		sourceType: 'article-in-reference-work',
		status: 'fail',
		book: book({
			work_type: 'reference_work',
			genre: 'Biblical Reference',
			title: 'Theological Dictionary of the New Testament',
			series_abbreviation: 'TDNT',
			volume_number: '4',
			total_volumes: 10,
			authors: [
				{ person_id: 'e1', person_label: 'Gerhard Kittel', role: 'editor', sort_order: 0 },
				{ person_id: 't1', person_label: 'Geoffrey W. Bromiley', role: 'translator', sort_order: 1 }
			],
			publisher: 'William B. Eerdmans',
			publisher_location: 'Grand Rapids, MI',
			year: 1967
		}),
		essay: {
			essay_title: 'λέγω',
			page_start: 100,
			authors: [
				{ person_id: 'a1', person_label: 'Gerhard Kittel', role: 'author', sort_order: 0 }
			]
		},
		page: '100',
		expectedFootnote: 'Gerhard Kittel, "λέγω," TDNT 4:100.'
	},
	{
		id: 19,
		slug: 'chapter-edited-volume',
		label: 'Chapter in edited volume (§17.1.8 — Piper in Peterson/Wells)',
		sourceType: 'chapter-in-edited-volume',
		status: 'fail',
		book: book({
			work_type: 'edited_volume',
			title: 'The Glory of the Atonement',
			authors: [
				{ person_id: 'e1', person_label: 'David G. Peterson', role: 'editor', sort_order: 0 },
				{ person_id: 'e2', person_label: 'David F. Wells', role: 'editor', sort_order: 1 }
			],
			publisher: 'Baker Academic',
			publisher_location: 'Grand Rapids, MI',
			year: 2004
		}),
		essay: {
			essay_title: 'The Perseverance of the Saints',
			page_start: 123,
			authors: [
				{ person_id: 'a1', person_label: 'John Piper', role: 'author', sort_order: 0 }
			]
		},
		page: '123',
		expectedFootnote:
			'John Piper, "The Perseverance of the Saints," in David G. Peterson and David F. Wells, eds., The Glory of the Atonement (Grand Rapids, MI: Baker Academic, 2004), 123.',
		expectedBibliography:
			'Piper, John. "The Perseverance of the Saints." In The Glory of the Atonement, edited by David G. Peterson and David F. Wells, 123. Grand Rapids, MI: Baker Academic, 2004.'
	},
	{
		id: 20,
		slug: 'short-footnote',
		label: 'Short footnote — capitalized last name + shortened title',
		sourceType: 'single-author-book',
		status: 'fail',
		book: book({
			title: 'The Art of Biblical History',
			authors: [
				{ person_id: 'p1', person_label: 'V. Philips Long', role: 'author', sort_order: 0 }
			],
			publisher: 'Zondervan',
			year: 1994
		}),
		shortForm: {
			kind: 'short',
			page: '42',
			expected: 'Long, Art of Biblical History, 42.'
		}
	}
];

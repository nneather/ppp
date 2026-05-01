/**
 * Migration overrides — transcribed from
 * `docs/Library_Migration_Notes.md` (also at
 * `scripts/library-import/data/Library_Migration_Notes.md` for local dev).
 *
 * Why hand-transcribed rather than parsed from markdown:
 *   1. The notes' `#N` index numbers reference subset positions that aren't
 *      algorithmically reproducible (verified during planning — see plan
 *      `library-session-4-pass1`). Matching by (subject, author_surname,
 *      title_prefix) is more robust anyway.
 *   2. The markdown shapes are heterogeneous (per-book corrections, group
 *      standardizations, ESVEC patterns, deletions, additions). A general
 *      parser would be larger and more bug-prone than the data itself.
 *   3. Spot-checking against the notes is easier with a flat TS literal than
 *      with a parser + intermediate AST.
 *
 * Structure:
 *   - GLOBAL_RULES: applied row-by-row during normalization (status case,
 *     deRoos notes detection, edition-suffix extraction).
 *   - GROUP_OVERRIDES: bulk rules for whole subject groups (ABD all 6 vols,
 *     TDNT all 10 vols, TWOT both vols, Brockhaus groups).
 *   - PER_BOOK_OVERRIDES: explicit per-row corrections matched by
 *     (subject, author_surname, title_prefix).
 *   - DELETIONS: source rows the importer drops entirely (NICNT Acts merge).
 *   - ADDITIONS: rows to INSERT that aren't in the source CSV (BDAG).
 *
 * Override application order: GLOBAL_RULES → GROUP_OVERRIDES → PER_BOOK_OVERRIDES.
 * Later writes win.
 */

import type { AuthorRole, Genre, Language, ReadingStatus } from '$lib/types/library';

// ---------------------------------------------------------------------------
// Override types
// ---------------------------------------------------------------------------

/** Author input as it lands on the importer's `findOrCreatePerson` call. */
export type OverrideAuthor = {
	last_name: string;
	first_name?: string;
	middle_name?: string;
	suffix?: string;
	role: AuthorRole;
	sort_order: number;
};

/** Subject codes from the spreadsheet's Subject column. */
export type SubjectCode =
	| 'CMT' // Commentaries
	| 'BBL' // Bibles
	| 'REF' // Reference (single-volume theological)
	| 'ABD' // Anchor Bible Dictionary
	| 'TDNT' // Theological Dictionary of the New Testament
	| 'TWOT' // Theological Wordbook of the OT
	| 'LGK' // Greek Language Tools
	| 'LHB' // Hebrew Language Tools
	| 'BH'; // Brockhaus (German Reference)

/** What an override can change about a book. */
export type BookEdit = {
	title?: string;
	subtitle?: string;
	edition?: string;
	series_abbrev?: string | null;
	volume_number?: string | null;
	language?: Language;
	reading_status?: ReadingStatus;
	genre?: Genre | null;
	year?: number;
	publisher?: string;
	publisher_location?: string;
	original_year?: number;
	reprint_publisher?: string;
	reprint_location?: string;
	reprint_year?: number;
	personal_notes?: string; // overrides whatever the source row has
	personal_notes_append?: string; // appended below
	needs_review?: boolean;
	needs_review_note?: string;
	authors?: OverrideAuthor[]; // replaces source-parsed authors entirely
	clear_borrowed_to?: boolean;
};

/**
 * Match shape for per-book overrides. Every set field MUST match; unset
 * fields are wildcards. At least one of subject/series/author_surname/
 * title_contains must be set, or the override is too broad.
 *
 * `subject` matches the source's Subject column (CMT/BBL/REF/LHB/LGK/...) —
 * note that Brockhaus rows have Subject=REF (BH is the *series*, not the
 * subject), and ABD/TDNT rows have Subject=null in source.
 */
export type PerBookMatch = {
	subject?: string;
	series?: string; // matches source Series column
	author_surname?: string; // matches against ANY parsed author's last_name (contains, normalized)
	/** Matches against the raw source `author` column (case-insensitive, normalized).
	 *  Use this when the spreadsheet has a missing comma (e.g. "Edwards James R.")
	 *  that breaks parseTypedName's last/first detection. */
	author_raw_contains?: string;
	title_contains?: string;
	/** Word-boundary variant — useful for "Vol I" vs "Vol II/III" disambiguation. */
	title_matches?: RegExp;
	title_excludes?: string;
};

export type PerBookOverride = {
	match: PerBookMatch;
	edit: BookEdit;
	/** Hand-set notes-row reference for traceability. */
	source_ref: string;
};

export type DeletionRule = {
	match: PerBookMatch;
	source_ref: string;
	reason: string;
};

export type AdditionRule = {
	source_ref: string;
	subject: SubjectCode;
	row: BookEdit & {
		title: string;
		authors: OverrideAuthor[];
		isbn?: string;
		page_count?: number;
	};
};

// ---------------------------------------------------------------------------
// GLOBAL_RULES (applied to every row pre-override)
// ---------------------------------------------------------------------------

export const GLOBAL_RULES = {
	/** Spreadsheet status casing → schema enum. */
	statusMap: {
		'in progress': 'in_progress',
		'in_progress': 'in_progress',
		'read': 'read',
		'unread': 'unread',
		'reference': 'reference',
		'n/a': 'n_a',
		'na': 'n_a'
	} as Record<string, ReadingStatus>,

	/**
	 * Title suffix patterns to strip and lift into the `edition` field.
	 * Order matters — longer matches first to avoid partial-strip bugs.
	 */
	editionSuffixes: [
		{ regex: /:?\s*Revised Edition\.?$/i, edition: 'Revised' },
		{ regex: /:?\s*Second Edition\.?$/i, edition: 'Second' },
		{ regex: /:?\s*Third Edition\.?$/i, edition: 'Third' },
		{ regex: /:?\s*Fourth Edition\.?$/i, edition: 'Fourth' },
		{ regex: /:?\s*Seventh Edition\.?$/i, edition: 'Seventh' },
		{ regex: /,?\s*\d+(st|nd|rd|th)\s*ed\.?$/i, edition: '__from_match' }, // 2nd ed. → "2nd"
		{ regex: /,?\s*\d+\.?\s*Auflage\.?$/i, edition: '__from_match' } // 4. Auflage → "4."
	] as { regex: RegExp; edition: string }[],

	/** Detection rule for the "Received from Rob deRoos" pattern in Notes. */
	deRoosNoteRegex: /deRoos,?\s*Rob/i,
	deRoosCanonicalNote: 'Received from Rob deRoos.'
} as const;

// ---------------------------------------------------------------------------
// Subject → Genre mapping (drives the genre column post-override)
// ---------------------------------------------------------------------------

export const SUBJECT_TO_GENRE: Record<string, Genre | null> = {
	CMT: 'Commentary',
	BBL: 'Bibles',
	BRF: 'Biblical Reference',
	REF: 'Biblical Reference', // single-vol theological reference, per notes
	ABD: 'Biblical Reference', // per notes' "Subject (all vols): BRF" rule
	TDNT: 'Biblical Reference',
	TWOT: 'Biblical Reference', // per notes' LHB → BRF reclassification
	LGK: 'Greek Language Tools',
	LHB: 'Hebrew Language Tools',
	LL: 'Latin Language Tools',
	LG: 'German Language Tools',
	LCH: 'Chinese Language Tools',
	BH: 'Biblical Reference', // Brockhaus is general reference; closest of the 12 closed genres
	THE: 'Theology',
	HIS: 'Church History',
	PAS: 'Pastoral',
	GEN: 'General',
	// Lowercase variants
	cmt: 'Commentary',
	bbl: 'Bibles',
	brf: 'Biblical Reference',
	ref: 'Biblical Reference',
	lgk: 'Greek Language Tools',
	lhb: 'Hebrew Language Tools',
	the: 'Theology',
	his: 'Church History',
	pas: 'Pastoral',
	gen: 'General'
};

// ---------------------------------------------------------------------------
// Genre → primary_category slug (resolved against `categories.slug` at runtime)
// ---------------------------------------------------------------------------

export const GENRE_TO_CATEGORY_SLUG: Record<string, string | null> = {
	Commentary: 'biblical-studies',
	Bibles: 'biblical-studies',
	'Biblical Reference': 'biblical-studies',
	'Greek Language Tools': 'languages-reference',
	'Hebrew Language Tools': 'languages-reference',
	'Latin Language Tools': 'languages-reference',
	'German Language Tools': 'languages-reference',
	'Chinese Language Tools': 'languages-reference',
	Theology: 'theology',
	'Church History': 'church-history',
	Pastoral: 'pastoral-practical',
	General: 'general-trade'
};

// ---------------------------------------------------------------------------
// GROUP_OVERRIDES — bulk rules for whole sub-corpora
// ---------------------------------------------------------------------------

/**
 * Helper builders for ABD / TDNT / TWOT volume-by-volume overrides. The notes
 * specify uniform `title`, `genre`, `series`, plus per-vol editor + volume
 * number. Reduces typing.
 */
function abdVol(vol: number, sourceTitleSubstr: string): PerBookOverride {
	return {
		// Source: series='ABD', subject=null, title='The Anchor Bible Dictionary: Volume N <letters>'
		match: { series: 'ABD', title_contains: sourceTitleSubstr },
		edit: {
			title: 'The Anchor Bible Dictionary',
			series_abbrev: 'ABD',
			volume_number: String(vol),
			genre: 'Biblical Reference',
			language: 'english',
			needs_review: false,
			personal_notes:
				'Multi-contributor reference work. Contains approximately 6,000 signed articles by ~800 biblical scholars and archaeologists.',
			authors: [
				{ last_name: 'Freedman', first_name: 'David', middle_name: 'Noel', role: 'editor', sort_order: 1 }
			]
		},
		source_ref: `ABD vol ${vol} (${sourceTitleSubstr})`
	};
}

function tdntVol(vol: number, editor: 'Kittel' | 'Friedrich', sourceTitleSubstr: string): PerBookOverride {
	const editorRow: OverrideAuthor =
		editor === 'Kittel'
			? { last_name: 'Kittel', first_name: 'Gerhard', role: 'editor', sort_order: 1 }
			: { last_name: 'Friedrich', first_name: 'Gerhard', role: 'editor', sort_order: 1 };
	return {
		// Source: series='TDNT', subject=null, title=letter range only ("Α-Γ", "Register", etc.)
		match: { series: 'TDNT', author_surname: editor, title_contains: sourceTitleSubstr },
		edit: {
			title: 'Theological Dictionary of the New Testament',
			series_abbrev: 'TDNT',
			volume_number: String(vol),
			genre: 'Biblical Reference',
			language: 'english',
			needs_review: false,
			personal_notes:
				'Multi-contributor theological dictionary. Translated from German by Geoffrey W. Bromiley. Contains ~400 Greek word studies by ~100 contributors.',
			authors: [editorRow]
		},
		source_ref: `TDNT vol ${vol} (${sourceTitleSubstr})`
	};
}

// ---------------------------------------------------------------------------
// PER_BOOK_OVERRIDES — explicit per-row corrections
// ---------------------------------------------------------------------------

export const PER_BOOK_OVERRIDES: PerBookOverride[] = [
	// =======================================================================
	// CMT — Commentaries
	// =======================================================================

	// CMT #7 Wray Beal — source has author "Beal, Lissa M. Wray" → fix to compound surname
	{
		match: { subject: 'CMT', author_surname: 'Beal', title_contains: '1 & 2 Kings' },
		edit: {
			authors: [
				{ last_name: 'Wray Beal', first_name: 'Lissa', middle_name: 'M.', role: 'author', sort_order: 1 }
			]
		},
		source_ref: 'CMT #7 Wray Beal'
	},
	// CMT #20 Calvin — title typo "Matthey" → "Matthew"
	{
		match: { author_surname: 'Calvin', title_contains: 'harmony of Matthey' },
		edit: { title: 'Commentary on a Harmony of Matthew, Mark, Luke; John 1-11' },
		source_ref: 'CMT #20 Calvin Matthey typo'
	},
	// CMT #21 Calvin — "Commentaties" → "Harmony of …"
	{
		match: { author_surname: 'Calvin', title_contains: 'Commentaties on the Harmony' },
		edit: { title: 'Harmony of Exodus, Leviticus, Numbers and Deuteronomy' },
		source_ref: 'CMT #21 Calvin Commentaties typo'
	},
	// CMT #42 Collins — Genesis 1-4 capitalization fix
	{
		match: { author_surname: 'Collins', title_contains: 'Genesis 1-4: A linguistic' },
		edit: { title: 'Genesis 1-4: A Linguistic, Literary, and Theological Commentary' },
		source_ref: 'CMT #42 Collins capitalization'
	},
	// CMT #54 Hodge — typo "Frist" → "First" (already corrected in source xlsx;
	// kept so v2 spreadsheets that re-introduce the typo still get caught)
	{
		match: { author_surname: 'Hodge', title_contains: 'Frist Epistle' },
		edit: { title: 'The First Epistle to the Corinthians', edition: 'Revised' },
		source_ref: 'CMT #54 Hodge Frist typo (defensive)'
	},
	// CMT #104 Luther — Galations → Galatians
	{
		match: { author_surname: 'Luther', title_contains: 'Galations' },
		edit: { title: 'Commentary on the Epistle to the Galatians' },
		source_ref: 'CMT #104 Luther Galations typo'
	},
	// CMT #115 typo: Collosians → Colossians
	{
		match: { title_contains: 'Ephesians, Collosians' },
		edit: { title: 'Ephesians, Colossians, Philemon' },
		source_ref: 'CMT #115 Collosians typo'
	},
	// CMT #139 Von Rad — Genesis revised + OTL series
	{
		// Source author "von Rad, Gerhard" → parsed last_name = "von Rad" (parser keeps the prefix)
		match: { subject: 'CMT', author_surname: 'Rad', title_contains: 'Genesis' },
		edit: { title: 'Genesis', edition: 'Revised', series_abbrev: 'OTL' },
		source_ref: 'CMT #139 Von Rad'
	},

	// CMT — Author corrections (surname matches the SOURCE — typo'd form, replaces with corrected)
	// Edwards #48: source is "Edwards James R." (no comma) → parsed last="R." not "Edwards".
	// Match the raw author string instead.
	{
		match: { subject: 'CMT', author_raw_contains: 'Edwards James R.' },
		edit: {
			authors: [{ last_name: 'Edwards', first_name: 'James', middle_name: 'R.', role: 'author', sort_order: 1 }]
		},
		source_ref: 'CMT #48 Edwards (missing comma)'
	},
	{
		match: { subject: 'CMT', author_surname: 'Hawthorne' },
		edit: {
			authors: [{ last_name: 'Hawthorne', first_name: 'Gerald', middle_name: 'F.', role: 'author', sort_order: 1 }]
		},
		source_ref: 'CMT #67 Hawthorne (duplicated last name)'
	},
	{
		match: { subject: 'CMT', author_surname: 'Hendricksen' },
		edit: {
			authors: [{ last_name: 'Hendriksen', first_name: 'William', role: 'author', sort_order: 1 }]
		},
		source_ref: 'CMT #69 Hendriksen spelling'
	},
	{
		match: { subject: 'CMT', author_surname: 'Murchpy' },
		edit: {
			authors: [{ last_name: 'Murphy', first_name: 'Roland', middle_name: 'E.', role: 'author', sort_order: 1 }]
		},
		source_ref: 'CMT #113 Murphy spelling'
	},
	{
		match: { subject: 'CMT', author_surname: 'Sards' },
		edit: {
			authors: [{ last_name: 'Soards', first_name: 'Marion', middle_name: 'L.', role: 'author', sort_order: 1 }]
		},
		source_ref: 'CMT #121 Soards spelling'
	},
	{
		// Source has "Williams David J." (no comma — parser puts last="J.")
		match: { subject: 'CMT', author_raw_contains: 'Williams David J.' },
		edit: {
			authors: [{ last_name: 'Williams', first_name: 'David', middle_name: 'J.', role: 'author', sort_order: 1 }]
		},
		source_ref: 'CMT #147 Williams missing comma'
	},
	// CMT #152 Cristopher → Christopher: typo already corrected in source xlsx (Wright
	// rows now spell "Christopher" properly). Kept as defensive guard for v2 spreadsheet.
	{
		match: { subject: 'CMT', author_raw_contains: 'Cristopher' },
		edit: {
			authors: [
				{ last_name: 'Wright', first_name: 'Christopher', middle_name: 'J. H.', role: 'author', sort_order: 1 }
			]
		},
		source_ref: 'CMT #152 Cristopher typo (defensive)'
	},
	// CMT #86 Walton et al. — wrong author originally listed (Keener)
	{
		match: { subject: 'CMT', author_surname: 'Keener', title_contains: 'IVP Bible Background' },
		edit: {
			authors: [
				{ last_name: 'Walton', first_name: 'John', middle_name: 'H.', role: 'author', sort_order: 1 },
				{ last_name: 'Matthews', first_name: 'Victor', middle_name: 'H.', role: 'author', sort_order: 2 },
				{ last_name: 'Chavalas', first_name: 'Mark', middle_name: 'W.', role: 'author', sort_order: 3 }
			]
		},
		source_ref: 'CMT #86 Keener→Walton (OT vol)'
	},

	// CMT — Status corrections
	{
		match: { subject: 'CMT', author_surname: 'Alexander', title_contains: 'Prophecies of Isaiah' },
		edit: { reading_status: 'reference' },
		source_ref: 'CMT #2 Alexander status'
	},
	{
		match: { subject: 'CMT', author_surname: 'Pink', title_contains: 'Gleanings from Elisha' },
		edit: { reading_status: 'reference' },
		source_ref: 'CMT #116 Pink Elisha status'
	},
	{
		match: { subject: 'CMT', author_surname: 'Pink', title_contains: 'Gleanings in Genesis' },
		edit: { reading_status: 'reference' },
		source_ref: 'CMT #117 Pink Genesis status'
	},

	// CMT — Multi-author splits
	{
		match: { subject: 'CMT', author_surname: 'Boda', title_contains: 'Judges' },
		edit: {
			authors: [
				{ last_name: 'Boda', first_name: 'Mark', middle_name: 'J.', role: 'author', sort_order: 1 },
				{ last_name: 'Conway', first_name: 'Mary', middle_name: 'L.', role: 'author', sort_order: 2 }
			]
		},
		source_ref: 'CMT #10 Boda multi-author'
	},
	// CMT #113 Murphy + Huwiler — match by raw author "Huwiler" since the source
	// formats as "Murphy, Roland and Elizabeth Huwiler" (parser handles fine but
	// Huwiler is unique enough to be the matcher).
	{
		match: { subject: 'CMT', author_raw_contains: 'Huwiler' },
		edit: {
			authors: [
				{ last_name: 'Murphy', first_name: 'Roland', middle_name: 'E.', role: 'author', sort_order: 1 },
				{ last_name: 'Huwiler', first_name: 'Elizabeth', role: 'author', sort_order: 2 }
			]
		},
		source_ref: 'CMT #113 Murphy + Huwiler'
	},

	// CMT — New series assignments
	{
		match: { subject: 'CMT', author_surname: 'Burton', title_contains: 'Galatians' },
		edit: { series_abbrev: 'ICC' },
		source_ref: 'CMT #16 Burton ICC'
	},
	// CMT #69 series — match by title only (covers both Hendriksen + Hendricksen typo)
	{
		match: { subject: 'CMT', title_contains: 'Galatians and Ephesians' },
		edit: { series_abbrev: 'NTC' },
		source_ref: 'CMT #69 Hendriksen NTC'
	},
	{
		match: { subject: 'CMT', author_surname: 'Schrage', title_contains: 'Korinther' },
		edit: { series_abbrev: 'EKK', volume_number: '3' },
		source_ref: 'CMT #124 Schrage EKK + vol'
	},

	// CMT — ESVEC pattern (multi-contributor)
	// Source row 400: author='ESV', series='ESVEC', title='Genesis - Numbers'.
	// Match by series, not by Duguid surname.
	{
		match: { series: 'ESVEC', title_contains: 'Genesis - Numbers' },
		edit: {
			series_abbrev: 'ESVEC',
			volume_number: '1',
			needs_review: false,
			personal_notes:
				'Contributors: Duguid (Genesis), Sklar (Leviticus), T. Desmond Alexander (Exodus), L. Michael Morales (Numbers).',
			authors: [
				{ last_name: 'Duguid', first_name: 'Iain', middle_name: 'M.', role: 'editor', sort_order: 1 },
				{ last_name: 'Hamilton', first_name: 'James', middle_name: 'M.', suffix: 'Jr.', role: 'editor', sort_order: 2 },
				{ last_name: 'Sklar', first_name: 'Jay', role: 'editor', sort_order: 3 }
			]
		},
		source_ref: 'CMT #47 ESVEC vol 1'
	},
	{
		match: { subject: 'CMT', author_surname: 'Keck', title_contains: "New Interpreter's Bible" },
		edit: {
			series_abbrev: 'NIB',
			volume_number: '10',
			needs_review: false,
			personal_notes:
				'Contributors: M. Eugene Boring (Acts), Robert Wall (Epistolary Literature intro), N. T. Wright (Romans), J. Paul Sampley (1 Corinthians).',
			authors: [
				{ last_name: 'Keck', first_name: 'Leander', middle_name: 'E.', role: 'editor', sort_order: 1 }
			]
		},
		source_ref: 'CMT #85 NIB vol 10'
	},

	// =======================================================================
	// CMT — Keil & Delitzsch (10 vols, COT)
	// =======================================================================
	...(() => {
		const KD: OverrideAuthor[] = [
			{ last_name: 'Keil', first_name: 'Carl', middle_name: 'Friedrich', role: 'author', sort_order: 1 },
			{ last_name: 'Delitzsch', first_name: 'Franz', role: 'author', sort_order: 2 }
		];
		const vols: { vol: string; titleContains: string }[] = [
			{ vol: '1', titleContains: 'Pentateuch' },
			{ vol: '2', titleContains: 'Joshua, Judges, Ruth' },
			{ vol: '3', titleContains: '1 & 2 Kings, 1 & 2 Chronicles' },
			{ vol: '4', titleContains: 'Ezra, Nehemiah, Esther, Job' },
			{ vol: '5', titleContains: 'Psalms' },
			{ vol: '6', titleContains: 'Proverbs, Ecclesiastes, Song of Songs' },
			{ vol: '7', titleContains: 'Isaiah' },
			{ vol: '8', titleContains: 'Jeremiah, Lamentations' },
			{ vol: '9', titleContains: 'Ezekiel, Daniel' },
			{ vol: '10', titleContains: 'Minor Prophets' }
		];
		return vols.map(
			(v): PerBookOverride => ({
				// Source authors are "Keil and Delitzsch" — parsed → last_name='Keil' (and 'Delitzsch')
				match: { author_surname: 'Keil', title_contains: v.titleContains },
				edit: { series_abbrev: 'COT', volume_number: v.vol, authors: KD },
				source_ref: `CMT K&D vol ${v.vol}`
			})
		);
	})(),

	// =======================================================================
	// CMT — Matthew Henry (6 vols, MH)
	// =======================================================================
	...(() => {
		const MH: OverrideAuthor[] = [{ last_name: 'Henry', first_name: 'Matthew', role: 'author', sort_order: 1 }];
		const vols: { vol: string; titleContains: string }[] = [
			{ vol: '1', titleContains: 'Genesis to Deuteronomy' },
			{ vol: '2', titleContains: 'Joshua to Esther' },
			{ vol: '3', titleContains: 'Job to Song of Solomon' },
			{ vol: '4', titleContains: 'Isaiah to Malachi' },
			{ vol: '5', titleContains: 'Matthew to John' },
			{ vol: '6', titleContains: 'Acts to Revelation' }
		];
		return vols.map(
			(v): PerBookOverride => ({
				match: { author_surname: 'Henry', title_contains: v.titleContains },
				edit: { series_abbrev: 'MH', volume_number: v.vol, authors: MH },
				source_ref: `CMT MH vol ${v.vol}`
			})
		);
	})(),

	// =======================================================================
	// BBL — Bibles
	// =======================================================================

	// BBL #1 Aland — Synopsis Quatuor Evangeliorum (4. Auflage extracted by GLOBAL_RULES)
	{
		match: { subject: 'BBL', author_surname: 'Aland', title_contains: 'Synopsis Quatuor Evangeliorum' },
		edit: { title: 'Synopsis Quatuor Evangeliorum', edition: '4th', language: 'german' },
		source_ref: 'BBL #1 Aland Quatuor'
	},
	// BBL #2 Aland — Synopsis of the Four Gospels (Seventh Edition extracted)
	{
		match: { subject: 'BBL', author_surname: 'Aland', title_contains: 'Synopsis of the Four Gospels' },
		edit: { title: 'Synopsis of the Four Gospels', edition: 'Seventh' },
		source_ref: 'BBL #2 Aland Four Gospels'
	},
	// BBL #3-5 Alter — Hebrew Bible vols 1-3. Volume detection via end-anchored regex
	// (so "Vol I" doesn't match "Vol II"/"Vol III"). Source titles: "Hebrew Bible, The Vol I/II/III".
	{
		match: { subject: 'BBL', author_surname: 'Alter', title_matches: /Vol\s+I\s*$/i },
		edit: {
			title: 'The Hebrew Bible',
			subtitle: 'A Translation with Commentary',
			volume_number: '1',
			authors: [{ last_name: 'Alter', first_name: 'Robert', role: 'author', sort_order: 1 }]
		},
		source_ref: 'BBL #3 Alter vol 1'
	},
	{
		match: { subject: 'BBL', author_surname: 'Alter', title_matches: /Vol\s+II\s*$/i },
		edit: {
			title: 'The Hebrew Bible',
			subtitle: 'A Translation with Commentary',
			volume_number: '2',
			authors: [{ last_name: 'Alter', first_name: 'Robert', role: 'author', sort_order: 1 }]
		},
		source_ref: 'BBL #4 Alter vol 2'
	},
	{
		match: { subject: 'BBL', author_surname: 'Alter', title_matches: /Vol\s+III\s*$/i },
		edit: {
			title: 'The Hebrew Bible',
			subtitle: 'A Translation with Commentary',
			volume_number: '3',
			authors: [{ last_name: 'Alter', first_name: 'Robert', role: 'author', sort_order: 1 }]
		},
		source_ref: 'BBL #5 Alter vol 3'
	},
	// CMT Barth — Der Römerbrief 1922 (German + reprint 2008)
	{
		match: { subject: 'CMT', author_surname: 'Barth', title_contains: 'Römerbrief' },
		edit: {
			language: 'german',
			original_year: 1922,
			reprint_publisher: 'Theologischer Verlag Zürich',
			reprint_year: 2008
		},
		source_ref: 'CMT Barth Römerbrief'
	},
	// BBL #6 Berlin & Brettler — Jewish Study Bible
	{
		match: { subject: 'BBL', author_surname: 'Berlin', title_contains: 'Jewish Study Bible' },
		edit: {
			authors: [
				{ last_name: 'Berlin', first_name: 'Adele', role: 'editor', sort_order: 1 },
				{ last_name: 'Brettler', first_name: 'Mark', middle_name: 'Zvi', role: 'editor', sort_order: 2 }
			]
		},
		source_ref: 'BBL #6 Jewish Study Bible'
	},
	// BBL #8 — Heilige Shrift typo
	{
		match: { subject: 'BBL', title_contains: 'Die Heilige Shrift' },
		edit: { title: 'Die Heilige Schrift', language: 'german' },
		source_ref: 'BBL #8 Schrift typo'
	},
	// BBL #11 BHS — Elliger & Rudolph
	{
		match: { subject: 'BBL', author_surname: 'Elliger' },
		edit: {
			authors: [
				{ last_name: 'Elliger', first_name: 'K.', role: 'editor', sort_order: 1 },
				{ last_name: 'Rudolph', first_name: 'W.', role: 'editor', sort_order: 2 }
			]
		},
		source_ref: 'BBL #11 BHS Elliger+Rudolph'
	},
	// BBL #12 Goodrich et al.
	{
		match: { subject: 'BBL', author_surname: 'Goodrich' },
		edit: {
			authors: [
				{ last_name: 'Goodrich', first_name: 'Richard', middle_name: 'J.', role: 'editor', sort_order: 1 },
				{ last_name: 'Lukaszewski', first_name: 'Albert', middle_name: 'L.', role: 'editor', sort_order: 2 },
				{ last_name: 'Brown', first_name: 'A. Philip', suffix: 'II', role: 'editor', sort_order: 3 },
				{ last_name: 'Smith', first_name: 'Bryan', middle_name: 'W.', role: 'editor', sort_order: 4 }
			]
		},
		source_ref: 'BBL #12 Goodrich 4-editor'
	},
	// BBL #18 — Urbana 18 Bible (13 copies)
	{
		match: { subject: 'BBL', title_contains: 'Urbana 18 Bible' },
		edit: { title: 'Urbana 18 Bible', personal_notes: '13 copies.' },
		source_ref: 'BBL #18 Urbana'
	},
	// BBL #23 Vulgate — Weber & Gryson
	{
		match: { subject: 'BBL', author_surname: 'Weber' },
		edit: {
			authors: [
				{ last_name: 'Weber', first_name: 'Robert', role: 'editor', sort_order: 1 },
				{ last_name: 'Gryson', first_name: 'Roger', role: 'editor', sort_order: 2 }
			]
		},
		source_ref: 'BBL #23 Vulgate'
	},
	// BBL #24 Westcott & Hort
	{
		match: { subject: 'BBL', author_surname: 'Westcott' },
		edit: {
			authors: [
				{ last_name: 'Westcott', first_name: 'Brooke', middle_name: 'Foss', role: 'editor', sort_order: 1 },
				{ last_name: 'Hort', first_name: 'Fenton', middle_name: 'John Anthony', role: 'editor', sort_order: 2 }
			]
		},
		source_ref: 'BBL #24 Westcott+Hort'
	},
	// Bayer Markus — source has Subject=CMT (German commentary, not BBL)
	{
		match: { author_surname: 'Bayer', title_contains: 'Markus' },
		edit: { language: 'german' },
		source_ref: 'CMT Bayer Markus (German)'
	},

	// =======================================================================
	// Reference works (notes call this "REF" but source uses REF/BRF/None
	// inconsistently — match by author + title without subject filter, then
	// force genre = Biblical Reference via the override.
	// =======================================================================

	{
		match: { author_surname: 'Davidson', title_contains: 'New Bible Commentary' },
		edit: {
			genre: 'Biblical Reference',
			authors: [
				{ last_name: 'Davidson', first_name: 'Francis', role: 'editor', sort_order: 1 },
				{ last_name: 'Stibbs', first_name: 'Alan', middle_name: 'M.', role: 'editor', sort_order: 2 },
				{ last_name: 'Kevan', first_name: 'Ernest', middle_name: 'F.', role: 'editor', sort_order: 3 }
			]
		},
		source_ref: 'REF #1 New Bible Commentary'
	},
	{
		match: { author_surname: 'Arnold', title_contains: 'Old Testament' },
		edit: {
			genre: 'Biblical Reference',
			authors: [
				{ last_name: 'Arnold', first_name: 'Bill', middle_name: 'T.', role: 'editor', sort_order: 1 },
				{ last_name: 'Williamson', first_name: 'H.', middle_name: 'G. M.', role: 'editor', sort_order: 2 }
			]
		},
		source_ref: 'REF #4 Arnold+Williamson'
	},
	{
		match: { author_surname: 'Muller', title_contains: 'Latin and Greek' },
		edit: {
			title: 'Dictionary of Latin and Greek Theological Terms',
			subtitle: 'Drawn Principally from Protestant Scholastic Theology',
			genre: 'Biblical Reference',
			authors: [{ last_name: 'Muller', first_name: 'Richard', middle_name: 'A.', role: 'author', sort_order: 1 }]
		},
		source_ref: 'REF #3 Muller'
	},
	{
		match: { author_surname: 'Cross', title_contains: 'Oxford Dictionary' },
		edit: {
			title: 'The Oxford Dictionary of the Christian Church',
			edition: 'Third',
			genre: 'Biblical Reference',
			authors: [
				{ last_name: 'Cross', first_name: 'F.', middle_name: 'L.', role: 'editor', sort_order: 1 },
				{ last_name: 'Livingstone', first_name: 'E.', middle_name: 'A.', role: 'editor', sort_order: 2 }
			]
		},
		source_ref: 'REF #6 Cross+Livingstone'
	},
	{
		match: { author_surname: 'Davie' },
		edit: {
			genre: 'Biblical Reference',
			authors: [
				{ last_name: 'Davie', first_name: 'Martin', role: 'editor', sort_order: 1 },
				{ last_name: 'Grass', first_name: 'Tim', role: 'editor', sort_order: 2 },
				{ last_name: 'Holmes', first_name: 'Stephen', middle_name: 'R.', role: 'editor', sort_order: 3 },
				{ last_name: 'McDowell', first_name: 'John', role: 'editor', sort_order: 4 },
				{ last_name: 'Noble', first_name: 'T.', middle_name: 'A.', role: 'editor', sort_order: 5 }
			]
		},
		source_ref: 'REF #7 Davie 5-editor (Holmes typo)'
	},
	{
		match: { author_surname: 'Green', title_contains: 'Jesus' },
		edit: {
			genre: 'Biblical Reference',
			authors: [
				{ last_name: 'Green', first_name: 'Joel', middle_name: 'B.', role: 'editor', sort_order: 1 },
				{ last_name: 'McKnight', first_name: 'Scot', role: 'editor', sort_order: 2 },
				{ last_name: 'Marshall', first_name: 'I.', middle_name: 'Howard', role: 'editor', sort_order: 3 }
			]
		},
		source_ref: 'REF #9 Green/McKnight/Marshall'
	},
	{
		match: { author_surname: 'Grenz', title_contains: 'Pocket Dictionary' },
		edit: {
			title: 'Pocket Dictionary of Theological Terms',
			genre: 'Biblical Reference',
			authors: [
				{ last_name: 'Grenz', first_name: 'Stanley', middle_name: 'J.', role: 'author', sort_order: 1 },
				{ last_name: 'Guretzki', first_name: 'David', role: 'author', sort_order: 2 },
				{ last_name: 'Nordling', first_name: 'Cherith', middle_name: 'Fee', role: 'author', sort_order: 3 }
			]
		},
		source_ref: 'REF #10 Grenz Pocket Dict'
	},
	{
		match: { author_surname: 'Longman', title_contains: 'Wisdom' },
		edit: {
			genre: 'Biblical Reference',
			authors: [
				{ last_name: 'Longman', first_name: 'Tremper', suffix: 'III', role: 'editor', sort_order: 1 },
				{ last_name: 'Enns', first_name: 'Peter', role: 'editor', sort_order: 2 }
			]
		},
		source_ref: 'REF #11 Longman+Enns'
	},
	{
		match: { author_surname: 'McKnight', title_contains: 'Paul' },
		edit: {
			title: 'Dictionary of Paul and His Letters',
			edition: 'Second',
			genre: 'Biblical Reference',
			authors: [
				{ last_name: 'McKnight', first_name: 'Scot', role: 'editor', sort_order: 1 },
				{ last_name: 'Cohick', first_name: 'Lynn', middle_name: 'H.', role: 'editor', sort_order: 2 },
				{ last_name: 'Gupta', first_name: 'Nijay', middle_name: 'K.', role: 'editor', sort_order: 3 }
			]
		},
		source_ref: 'REF #12 McKnight Paul (Cohick)'
	},
	{
		match: { author_surname: 'Treier', title_contains: 'Evangelical Dictionary' },
		edit: {
			edition: '3rd',
			genre: 'Biblical Reference',
			authors: [
				{ last_name: 'Treier', first_name: 'Daniel', middle_name: 'J.', role: 'editor', sort_order: 1 }
			]
		},
		source_ref: 'REF #13 Treier'
	},

	// =======================================================================
	// ABD — Anchor Bible Dictionary (6 vols, source: series='ABD', subject=null)
	// =======================================================================
	abdVol(1, 'Volume 1'),
	abdVol(2, 'Volume 2'),
	abdVol(3, 'Volume 3'),
	abdVol(4, 'Volume 4'),
	abdVol(5, 'Volume 5'),
	abdVol(6, 'Volume 6'),

	// =======================================================================
	// TDNT — Theological Dictionary of the New Testament (10 vols, source: series='TDNT', title=letter range)
	// =======================================================================
	tdntVol(1, 'Kittel', 'Α-Γ'),
	tdntVol(2, 'Kittel', 'Δ-Η'),
	tdntVol(3, 'Kittel', 'Θ-Κ'),
	tdntVol(4, 'Kittel', 'Λ-Ν'),
	tdntVol(5, 'Friedrich', 'Ξ-Πα'),
	tdntVol(6, 'Friedrich', 'Πε-Ρ'),
	tdntVol(7, 'Friedrich', 'Σ'),
	tdntVol(8, 'Friedrich', 'Τ-Υ'),
	tdntVol(9, 'Friedrich', 'Φ-Ω'),
	tdntVol(10, 'Friedrich', 'Register'),

	// =======================================================================
	// TWOT — Theological Wordbook of the Old Testament (2 vols)
	// Source: subject=LHB, author='Harris, R. Laird, Gleason L. Archer, Jr., and Bruce K. Waltke'
	// title='Theological Wordbook of the Old Testament Vol. I'/'Vol. II.'
	// =======================================================================
	{
		match: { author_surname: 'Harris', title_contains: 'Theological Wordbook' },
		edit: {
			title: 'Theological Wordbook of the Old Testament',
			series_abbrev: 'TWOT',
			genre: 'Biblical Reference',
			needs_review: false,
			personal_notes: 'Multi-contributor Hebrew wordbook. Contains ~1,400 Old Testament Hebrew word studies.',
			authors: [
				{ last_name: 'Harris', first_name: 'R.', middle_name: 'Laird', role: 'editor', sort_order: 1 },
				{ last_name: 'Archer', first_name: 'Gleason', middle_name: 'L.', suffix: 'Jr.', role: 'editor', sort_order: 2 },
				{ last_name: 'Waltke', first_name: 'Bruce', middle_name: 'K.', role: 'editor', sort_order: 3 }
			]
		},
		source_ref: 'TWOT (vol set; per-vol number from title)'
	},

	// =======================================================================
	// LGK — Greek Language Tools
	// =======================================================================

	// LGK #4 — Köstenberger/Merkle/Plummer
	{
		match: { subject: 'LGK', author_surname: 'Köstenberger', title_contains: 'Going Deeper' },
		edit: {
			title: 'Going Deeper with New Testament Greek',
			subtitle: 'An Intermediate Study of the Grammar and Syntax of the New Testament',
			edition: 'Revised',
			authors: [
				{ last_name: 'Köstenberger', first_name: 'Andreas', middle_name: 'J.', role: 'author', sort_order: 1 },
				{ last_name: 'Merkle', first_name: 'Benjamin', middle_name: 'L.', role: 'author', sort_order: 2 },
				{ last_name: 'Plummer', first_name: 'Robert', middle_name: 'L.', role: 'author', sort_order: 3 }
			]
		},
		source_ref: 'LGK #4 Köstenberger'
	},
	// LGK #3 — Pocket Dictionary. Source xlsx already says "New Testament Greek"
	// but has the "(The IVP Pocket Reference Seriew)" parenthetical with typo.
	// Strip the parenthetical from the title.
	{
		match: { subject: 'LGK', title_contains: 'Pocket Dictionary for the Study of New Testament Greek' },
		edit: { title: 'Pocket Dictionary for the Study of New Testament Greek' },
		source_ref: 'LGK #3 Pocket Dict (parenthetical strip)'
	},
	// LGK #6 — Beginning Greek capitalization
	{
		match: { subject: 'LGK', title_contains: 'Beginning greek' },
		edit: { title: 'Beginning Greek: A Functional Approach' },
		source_ref: 'LGK #6 Beginning Greek caps'
	},
	// LGK #9 — Vocabulary Guide typo
	{
		match: { subject: 'LGK', title_contains: 'Greek New Tetsament' },
		edit: { title: 'Complete Vocabulary Guide to the Greek New Testament' },
		source_ref: 'LGK #9 Tetsament typo'
	},
	// LGK #7 — Rienecker (German)
	{
		match: { subject: 'LGK', author_surname: 'Rienecker', title_contains: 'Sprachlicher Schlüssel' },
		edit: { language: 'german' },
		source_ref: 'LGK #7 Rienecker (German)'
	},

	// =======================================================================
	// LHB — Hebrew Language Tools (excluding TWOT)
	// =======================================================================

	{
		match: { subject: 'LHB', author_raw_contains: 'Choi' },
		edit: {
			authors: [
				{ last_name: 'Arnold', first_name: 'Bill', middle_name: 'T.', role: 'author', sort_order: 1 },
				{ last_name: 'Choi', first_name: 'John', middle_name: 'H.', role: 'author', sort_order: 2 }
			]
		},
		source_ref: 'LHB #1 Arnold+Choi'
	},
	{
		match: { subject: 'LHB', author_surname: 'Brown' },
		edit: {
			authors: [
				{ last_name: 'Brown', first_name: 'Francis', role: 'author', sort_order: 1 },
				{ last_name: 'Driver', first_name: 'S.', middle_name: 'R.', role: 'author', sort_order: 2 },
				{ last_name: 'Briggs', first_name: 'Charles', middle_name: 'A.', role: 'author', sort_order: 3 }
			]
		},
		source_ref: 'LHB #2 BDB'
	},
	{
		match: { subject: 'LHB', author_raw_contains: 'Muraoka' },
		edit: {
			authors: [
				{ last_name: 'Joüon', first_name: 'Paul', role: 'author', sort_order: 1 },
				{ last_name: 'Muraoka', first_name: 'T.', role: 'author', sort_order: 2 }
			],
			personal_notes_append:
				'Translator: T. Muraoka (per Library_Migration_Notes Pre-Trip translator workaround).'
		},
		source_ref: 'LHB #7 Joüon+Muraoka'
	},
	{
		match: { subject: 'LHB', author_raw_contains: "O'Connor" },
		edit: {
			authors: [
				{ last_name: 'Waltke', first_name: 'Bruce', middle_name: 'K.', role: 'author', sort_order: 1 },
				{ last_name: "O'Connor", first_name: 'Michael', middle_name: 'Patrick', role: 'author', sort_order: 2 }
			]
		},
		source_ref: 'LHB #9 Waltke+O\'Connor'
	},
	{
		match: { subject: 'LHB', author_surname: 'Futado' },
		edit: {
			authors: [{ last_name: 'Futato', first_name: 'Mark', middle_name: 'D.', role: 'author', sort_order: 1 }]
		},
		source_ref: 'LHB #5/#6 Futato spelling'
	}
];

// ---------------------------------------------------------------------------
// Brockhaus group standardization
// ---------------------------------------------------------------------------

export const BROCKHAUS_RULES = {
	enzyklopaedie: {
		// 24-vol Enzyklopädie, 19th Edition
		titlePrefix: /Brockhaus.*Enzyklop/i,
		title: 'Brockhaus Enzyklopädie',
		series_abbrev: 'BH',
		language: 'german' as Language,
		needs_review: false,
		volumes: [
			'A-APT', 'APU-BEC', 'BED-BRN', 'BRO-COS', 'COT-DR', 'DS-EW', 'EX-FRT', 'FRU-GOS',
			'GOT-HERP', 'HERR-IS', 'IT-KIP', 'KIR-LAG', 'LAH-MAF', 'MAG-MOD', 'MOE-NOR', 'NOS-PER',
			'PES-RAG', 'RAD-RUS', 'RUT-SCH', 'SCI-SQ', 'SR-TEO', 'TEP-UR', 'US-WEJ', 'WEK-ZZ'
		]
	},
	woerterbuch: {
		titlePrefix: /Brockhaus.*W[öo]rterbuch/i,
		title: 'Brockhaus Deutsches Wörterbuch',
		series_abbrev: 'BH',
		language: 'german' as Language,
		needs_review: false,
		volumes: ['A-GLUB', 'GLUC-REG', 'REH-ZZ']
	},
	supplementary: {
		// vols 25-27: Ergänzungen, Personen Register, Wörterbuch Englisch
		titlePatterns: [
			{ regex: /ERG[ÄA]NZUNGEN/i, vol: '25', note: 'Supplements/Addenda A-Z' },
			{ regex: /PERSONEN REGISTER/i, vol: '26', note: 'Person name index' },
			{ regex: /W[ÖO]RTERBUCH ENGLISH/i, vol: '27', note: 'English dictionary' }
		],
		title: 'Brockhaus Enzyklopädie',
		series_abbrev: 'BH',
		language: 'german' as Language,
		needs_review: false
	},
	jahrbuch: {
		titlePrefix: /Brockhaus.*Jahrbuch/i,
		title: 'Brockhaus Jahrbuch 1996',
		year: 1996,
		series_abbrev: null,
		language: 'german' as Language,
		needs_review: false
	}
} as const;

// ---------------------------------------------------------------------------
// DELETIONS — source rows the importer drops entirely
// ---------------------------------------------------------------------------

export const DELETIONS: DeletionRule[] = [
	{
		match: {
			subject: 'CMT',
			author_surname: 'Bruce',
			title_contains: 'The Book of Acts',
			title_excludes: 'Revised'
		},
		source_ref: 'CMT #16 → merged into #52',
		reason: 'Original NICNT Acts merged into the Revised Edition entry.'
	}
];

// ---------------------------------------------------------------------------
// ADDITIONS — books NOT in the source spreadsheet
// ---------------------------------------------------------------------------

export const ADDITIONS: AdditionRule[] = [
	{
		source_ref: 'BDAG (missing from xlsx)',
		subject: 'LGK',
		row: {
			title: 'A Greek-English Lexicon of the New Testament and Other Early Christian Literature',
			edition: '3rd',
			publisher: 'University of Chicago Press',
			publisher_location: 'Chicago',
			year: 2000,
			language: 'english',
			reading_status: 'reference',
			needs_review: false,
			authors: [
				{ last_name: 'Bauer', first_name: 'Walter', role: 'author', sort_order: 1 },
				{ last_name: 'Danker', first_name: 'Frederick', middle_name: 'W.', role: 'editor', sort_order: 2 }
			]
		}
	}
];

// ---------------------------------------------------------------------------
// DEFERRED_SHELF_CHECK — these books land with needs_review = true
// ---------------------------------------------------------------------------

export const DEFERRED_SHELF_CHECK: { match: PerBookMatch; note: string; source_ref: string }[] = [
	{
		match: { subject: 'CMT', author_surname: 'Calvin', title_contains: 'Exodus' },
		note: 'Deferred shelf-check: confirm Calvin CC Exodus/Leviticus volume(s) present + assign volume number.',
		source_ref: 'Deferred #21/#27'
	},
	{
		match: { subject: 'CMT', author_surname: 'Hodge', title_contains: 'Corinthians' },
		note: 'Deferred shelf-check: which reprint edition? Banner of Truth (GSC) or Eerdmans (standalone)?',
		source_ref: 'Deferred Hodge'
	},
	{
		// Source rows have subject=BRF or None, not REF
		match: { author_surname: 'Douglas', title_contains: 'New Bible Dictionary' },
		note: 'Deferred shelf-check: which edition (1st 1962, 2nd 1982, or 3rd 1996)?',
		source_ref: 'Deferred Douglas NBD'
	}
];

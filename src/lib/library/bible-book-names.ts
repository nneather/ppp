/**
 * Protestant canon names in sort_order — must match `bible_books` seed
 * (`supabase/seed/library_seed.sql`) and OCR allowlist.
 */
export const BIBLE_BOOK_NAMES: readonly string[] = [
	'Genesis',
	'Exodus',
	'Leviticus',
	'Numbers',
	'Deuteronomy',
	'Joshua',
	'Judges',
	'Ruth',
	'1 Samuel',
	'2 Samuel',
	'1 Kings',
	'2 Kings',
	'1 Chronicles',
	'2 Chronicles',
	'Ezra',
	'Nehemiah',
	'Esther',
	'Job',
	'Psalms',
	'Proverbs',
	'Ecclesiastes',
	'Song of Songs',
	'Isaiah',
	'Jeremiah',
	'Lamentations',
	'Ezekiel',
	'Daniel',
	'Hosea',
	'Joel',
	'Amos',
	'Obadiah',
	'Jonah',
	'Micah',
	'Nahum',
	'Habakkuk',
	'Zephaniah',
	'Haggai',
	'Zechariah',
	'Malachi',
	'Matthew',
	'Mark',
	'Luke',
	'John',
	'Acts',
	'Romans',
	'1 Corinthians',
	'2 Corinthians',
	'Galatians',
	'Ephesians',
	'Philippians',
	'Colossians',
	'1 Thessalonians',
	'2 Thessalonians',
	'1 Timothy',
	'2 Timothy',
	'Titus',
	'Philemon',
	'Hebrews',
	'James',
	'1 Peter',
	'2 Peter',
	'1 John',
	'2 John',
	'3 John',
	'Jude',
	'Revelation'
] as const;

/**
 * NRSV Apocrypha, in NRSV order. `sort_order` 67–84 on `bible_books`.
 * Not part of the 66-book canon spine (`BIBLE_BOOK_NAMES`).
 */
export const APOCRYPHA_BOOK_NAMES: readonly string[] = [
	'Tobit',
	'Judith',
	'Additions to Esther',
	'Wisdom of Solomon',
	'Sirach',
	'Baruch',
	'Letter of Jeremiah',
	'Prayer of Azariah',
	'Susanna',
	'Bel and the Dragon',
	'1 Maccabees',
	'2 Maccabees',
	'1 Esdras',
	'Prayer of Manasseh',
	'Psalm 151',
	'3 Maccabees',
	'2 Esdras',
	'4 Maccabees'
] as const;

/** Canon, then Apocrypha. Scripture index, search-passage, and systematics MCP. */
export const ALL_BIBLE_BOOK_NAMES: readonly string[] = [
	...BIBLE_BOOK_NAMES,
	...APOCRYPHA_BOOK_NAMES
];

/**
 * Layout / scripture UI — avoids a `bible_books` round-trip on every `/library/*` nav.
 * Defaults to the 66-book canon. Pass `{ includeApocrypha: true }` for the NRSV 18 as well.
 */
export function getBibleBookNames(opts?: { includeApocrypha?: boolean }): string[] {
	if (opts?.includeApocrypha) return [...ALL_BIBLE_BOOK_NAMES];
	return [...BIBLE_BOOK_NAMES];
}

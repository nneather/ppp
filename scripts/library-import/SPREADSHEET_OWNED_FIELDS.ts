/**
 * Spreadsheet-owned fields — single source of truth for the Pass 1 / Pass 2
 * reconcilable importer. Mirrors the field-ownership table in
 * `docs/decisions/007-reconcilable-library-import.md`.
 *
 * Every field NOT in this set is user-owned (or system-owned) and the
 * importer MUST NOT touch it in update mode. The unit test
 * `__tests__/owned-fields.test.ts` enforces this invariant against a fixture
 * book: a row with `personal_notes` set, given a CSV update that only changes
 * `subtitle`, ends up with `personal_notes` byte-identical.
 */

export const SPREADSHEET_OWNED_FIELDS = [
	'title',
	'subtitle',
	'publisher',
	'publisher_location',
	'year',
	'edition',
	'total_volumes',
	'original_year',
	'reprint_publisher',
	'reprint_location',
	'reprint_year',
	'series_id',
	'volume_number',
	'genre',
	'language',
	'page_count',
	'isbn',
	'barcode',
	'primary_category_id',
	'import_match_type'
] as const;

export type SpreadsheetOwnedField = (typeof SPREADSHEET_OWNED_FIELDS)[number];

/**
 * Fields the importer MAY flip but with constraints documented in decision 007.
 * Mostly kept here as documentation; the actual logic lives in the importer.
 *
 * - `needs_review`: importer can flip to `true` based on missing fields, cannot
 *   flip a user-cleared `false` back to `true` without explicit direction.
 * - `needs_review_note`: auto-line ("Missing: …", "OL match: title-only — …")
 *   refreshed by the importer; the user-authored portion is preserved per
 *   `mergeReviewNote` shape in `src/lib/library/server/book-actions.ts`.
 */
export const MIXED_OWNED_FIELDS = ['needs_review', 'needs_review_note'] as const;

/**
 * User-owned (NEVER touched in update mode). Listed for documentation; the
 * unit test verifies these by exclusion (anything outside SPREADSHEET_OWNED
 * + MIXED_OWNED + system fields stays untouched).
 */
export const USER_OWNED_FIELDS = [
	'personal_notes',
	'reading_status',
	'rating',
	'borrowed_to',
	'shelving_location',
	'deleted_at'
] as const;

export const SYSTEM_FIELDS = ['id', 'created_at', 'created_by', 'updated_at'] as const;

/**
 * Pick only the spreadsheet-owned subset from a candidate record. Used by the
 * importer's UPDATE path so the `.update()` payload literally cannot contain
 * a user-owned field.
 */
export function pickSpreadsheetOwned<T extends Partial<Record<SpreadsheetOwnedField, unknown>>>(
	candidate: T
): Pick<T, SpreadsheetOwnedField> {
	const out = {} as Pick<T, SpreadsheetOwnedField>;
	for (const k of SPREADSHEET_OWNED_FIELDS) {
		if (k in candidate) {
			(out as Record<string, unknown>)[k] = (candidate as Record<string, unknown>)[k];
		}
	}
	return out;
}

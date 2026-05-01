/**
 * Shared URL-param helpers for library list + review-queue pages.
 *
 * Per `.cursor/rules/library-module.mdc` (Session 3 — URL-param-as-source-of-
 * truth pattern): server `load` parses URL into a typed filter shape; the
 * page renders against `data.filters`; toggles call `pushFilters(next)` which
 * builds a new URL and `goto(target, { keepFocus: true, noScroll: true })`.
 *
 * Originally lived inline at `src/routes/library/+page.server.ts`; lifted here
 * Session 5.5 so `/library/review/+page.server.ts` could reuse the same parser
 * for `?genre=`, `?language=`, `?series_id=`, etc.
 */

/**
 * Parse repeated/CSV URL params into a deduped string list. Accepts both
 * `?genre=Commentary&genre=Theology` and `?genre=Commentary,Theology` for
 * deep-link friendliness; the page's `pushFilters` always emits the repeated
 * form on round-trip.
 */
export function multiParam(url: URL, key: string): string[] {
	const all = url.searchParams.getAll(key).flatMap((v) => v.split(','));
	const trimmed = all.map((s) => s.trim()).filter((s) => s.length > 0);
	return Array.from(new Set(trimmed));
}

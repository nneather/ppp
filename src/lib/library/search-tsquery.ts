/**
 * Build a Postgres `to_tsquery('simple', …)` string for library keyword search.
 *
 * `books.search_vector` is maintained with `to_tsvector('simple', …)` (title,
 * subtitle, author_display, publisher). Exact-token websearch misses partial
 * last names ("piot" does not match "Piotrowski"); each token gets a prefix
 * `:*` so typing into `/library` behaves like progressive author/title find.
 *
 * Terms are single-quoted (`'piot':*`) so PostgREST does not treat `*` as
 * filter-DSL syntax. Returns null when nothing searchable remains.
 */
export function toLibrarySearchTsQuery(raw: string): string | null {
	const tokens = raw
		.trim()
		.toLowerCase()
		.split(/[^a-z0-9\u00c0-\u024f]+/i)
		.filter((t) => t.length > 0);

	if (tokens.length === 0) return null;
	// Quoted lexemes: PostgREST filter DSL + to_tsquery prefix operator.
	return tokens.map((t) => `'${t}':*`).join(' & ');
}

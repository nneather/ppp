/**
 * Effective series abbreviation for Turabian / list chips.
 * Per-book `citation_abbreviation` overrides `series.abbreviation` when set.
 */

export function effectiveSeriesAbbreviation(opts: {
	citation_abbreviation?: string | null;
	series_abbreviation?: string | null;
}): string | null {
	const override = (opts.citation_abbreviation ?? '').trim();
	if (override.length > 0) return override;
	const series = (opts.series_abbreviation ?? '').trim();
	return series.length > 0 ? series : null;
}

/** Blank → null; trim; reject empty after trim. Caller enforces max length. */
export function normalizeCitationAbbreviationOrNull(raw: string | null | undefined): string | null {
	const t = (raw ?? '').trim();
	return t.length > 0 ? t : null;
}

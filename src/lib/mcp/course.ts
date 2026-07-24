/**
 * Resolve a user-typed course name/code to a live courses row.
 * Pattern mirrors bible-book.ts (exact → unique prefix → unique substring).
 */

export type CourseResolveInput = {
	id: string;
	name: string;
	code: string | null;
};

function normalizeKey(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/\./g, '')
		.replace(/\s+/g, ' ');
}

function courseLabel(c: CourseResolveInput): string {
	return c.code ? `${c.name} (${c.code})` : c.name;
}

/**
 * Exact / unique-prefix / unique-substring match on name or code.
 * Returns null when unknown or ambiguous.
 */
export function resolveCourse(
	raw: string,
	courses: readonly CourseResolveInput[]
): CourseResolveInput | null {
	const key = normalizeKey(raw);
	if (!key || courses.length === 0) return null;

	const byCodeExact = courses.filter(
		(c) => c.code != null && normalizeKey(c.code) === key
	);
	if (byCodeExact.length === 1) return byCodeExact[0]!;
	if (byCodeExact.length > 1) return null;

	const byNameExact = courses.filter((c) => normalizeKey(c.name) === key);
	if (byNameExact.length === 1) return byNameExact[0]!;
	if (byNameExact.length > 1) return null;

	const prefixHits = courses.filter((c) => {
		const nameKey = normalizeKey(c.name);
		const codeKey = c.code != null ? normalizeKey(c.code) : '';
		return nameKey.startsWith(key) || (codeKey.length > 0 && codeKey.startsWith(key));
	});
	if (prefixHits.length === 1) return prefixHits[0]!;
	if (prefixHits.length > 1) return null;

	const substringHits = courses.filter((c) => {
		const nameKey = normalizeKey(c.name);
		const codeKey = c.code != null ? normalizeKey(c.code) : '';
		return nameKey.includes(key) || (codeKey.length > 0 && codeKey.includes(key));
	});
	if (substringHits.length === 1) return substringHits[0]!;

	return null;
}

export function courseSuggestions(
	raw: string,
	courses: readonly CourseResolveInput[],
	limit = 8
): string[] {
	const key = normalizeKey(raw);
	const ranked = key
		? courses.filter((c) => {
				const nameKey = normalizeKey(c.name);
				const codeKey = c.code != null ? normalizeKey(c.code) : '';
				return nameKey.includes(key) || (codeKey.length > 0 && codeKey.includes(key));
			})
		: [...courses];
	return ranked.slice(0, limit).map(courseLabel);
}

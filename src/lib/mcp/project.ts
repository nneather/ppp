/**
 * Resolve a user-typed project id or name for MCP list_project_health root filter.
 * Pattern mirrors course.ts (exact → unique prefix → unique substring).
 */

export type ProjectResolveInput = {
	id: string;
	name: string;
};

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeKey(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/\./g, '')
		.replace(/\s+/g, ' ');
}

/**
 * Exact UUID, or exact / unique-prefix / unique-substring match on name.
 * Returns null when unknown or ambiguous.
 */
export function resolveProject(
	raw: string,
	projects: readonly ProjectResolveInput[]
): ProjectResolveInput | null {
	const trimmed = raw.trim();
	if (!trimmed || projects.length === 0) return null;

	if (UUID_RE.test(trimmed)) {
		return projects.find((p) => p.id === trimmed) ?? null;
	}

	const key = normalizeKey(trimmed);

	const byNameExact = projects.filter((p) => normalizeKey(p.name) === key);
	if (byNameExact.length === 1) return byNameExact[0]!;
	if (byNameExact.length > 1) return null;

	const prefixHits = projects.filter((p) => normalizeKey(p.name).startsWith(key));
	if (prefixHits.length === 1) return prefixHits[0]!;
	if (prefixHits.length > 1) return null;

	const substringHits = projects.filter((p) => normalizeKey(p.name).includes(key));
	if (substringHits.length === 1) return substringHits[0]!;

	return null;
}

export function projectSuggestions(
	raw: string,
	projects: readonly ProjectResolveInput[],
	limit = 8
): string[] {
	const key = normalizeKey(raw);
	const ranked = key
		? projects.filter((p) => normalizeKey(p.name).includes(key))
		: [...projects];
	return ranked.slice(0, limit).map((p) => p.name);
}

/** Week-over-week health change (both sides present and unequal). */
export function healthChangedThisWeek(
	healthStatus: string | null,
	previousHealth: string | null
): boolean {
	return healthStatus != null && previousHealth != null && healthStatus !== previousHealth;
}

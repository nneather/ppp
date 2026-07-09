/** Curated domain color palette — static Tailwind class maps (no dynamic arbitrary values). */

export const PROJECT_COLOR_KEYS = [
	'ocean',
	'sky',
	'teal',
	'emerald',
	'lime',
	'amber',
	'orange',
	'rose',
	'violet',
	'indigo',
	'slate',
	'stone'
] as const;

export type ProjectColorKey = (typeof PROJECT_COLOR_KEYS)[number];

export const PROJECT_COLOR_LABELS: Record<ProjectColorKey, string> = {
	ocean: 'Ocean',
	sky: 'Sky',
	teal: 'Teal',
	emerald: 'Emerald',
	lime: 'Lime',
	amber: 'Amber',
	orange: 'Orange',
	rose: 'Rose',
	violet: 'Violet',
	indigo: 'Indigo',
	slate: 'Slate',
	stone: 'Stone'
};

/** Solid swatch / color-dot backgrounds. */
export const PROJECT_COLOR_DOT_CLASS: Record<ProjectColorKey, string> = {
	ocean: 'bg-blue-600 dark:bg-blue-500',
	sky: 'bg-sky-500 dark:bg-sky-400',
	teal: 'bg-teal-600 dark:bg-teal-500',
	emerald: 'bg-emerald-600 dark:bg-emerald-500',
	lime: 'bg-lime-500 dark:bg-lime-400',
	amber: 'bg-amber-500 dark:bg-amber-400',
	orange: 'bg-orange-500 dark:bg-orange-400',
	rose: 'bg-rose-500 dark:bg-rose-400',
	violet: 'bg-violet-600 dark:bg-violet-500',
	indigo: 'bg-indigo-600 dark:bg-indigo-500',
	slate: 'bg-slate-500 dark:bg-slate-400',
	stone: 'bg-stone-500 dark:bg-stone-400'
};

/** Left accent rail for child rows under a colored domain. */
export const PROJECT_COLOR_RAIL_CLASS: Record<ProjectColorKey, string> = {
	ocean: 'border-l-4 border-l-blue-600 dark:border-l-blue-500',
	sky: 'border-l-4 border-l-sky-500 dark:border-l-sky-400',
	teal: 'border-l-4 border-l-teal-600 dark:border-l-teal-500',
	emerald: 'border-l-4 border-l-emerald-600 dark:border-l-emerald-500',
	lime: 'border-l-4 border-l-lime-500 dark:border-l-lime-400',
	amber: 'border-l-4 border-l-amber-500 dark:border-l-amber-400',
	orange: 'border-l-4 border-l-orange-500 dark:border-l-orange-400',
	rose: 'border-l-4 border-l-rose-500 dark:border-l-rose-400',
	violet: 'border-l-4 border-l-violet-600 dark:border-l-violet-500',
	indigo: 'border-l-4 border-l-indigo-600 dark:border-l-indigo-500',
	slate: 'border-l-4 border-l-slate-500 dark:border-l-slate-400',
	stone: 'border-l-4 border-l-stone-500 dark:border-l-stone-400'
};

/** Subtle depth-0 row tint. */
export const PROJECT_COLOR_ROW_TINT_CLASS: Record<ProjectColorKey, string> = {
	ocean: 'bg-blue-500/10 dark:bg-blue-500/15',
	sky: 'bg-sky-500/10 dark:bg-sky-500/15',
	teal: 'bg-teal-500/10 dark:bg-teal-500/15',
	emerald: 'bg-emerald-500/10 dark:bg-emerald-500/15',
	lime: 'bg-lime-500/10 dark:bg-lime-500/15',
	amber: 'bg-amber-500/10 dark:bg-amber-500/15',
	orange: 'bg-orange-500/10 dark:bg-orange-500/15',
	rose: 'bg-rose-500/10 dark:bg-rose-500/15',
	violet: 'bg-violet-500/10 dark:bg-violet-500/15',
	indigo: 'bg-indigo-500/10 dark:bg-indigo-500/15',
	slate: 'bg-slate-500/10 dark:bg-slate-500/15',
	stone: 'bg-stone-500/10 dark:bg-stone-500/15'
};

const COLOR_SET: ReadonlySet<string> = new Set(PROJECT_COLOR_KEYS);

export function parseProjectColorKey(raw: string | null | undefined): ProjectColorKey | null {
	const t = String(raw ?? '').trim();
	if (!t) return null;
	return COLOR_SET.has(t) ? (t as ProjectColorKey) : null;
}

export function isProjectColorKey(v: string): v is ProjectColorKey {
	return COLOR_SET.has(v);
}

/**
 * Map every project id → its root domain's palette key (walk parent_id to root).
 * Roots with no color (and orphans) map to null.
 */
export function buildDomainColorByProjectId(
	rows: readonly { id: string; parent_id: string | null; color: string | null }[]
): Record<string, ProjectColorKey | null> {
	const byId = new Map(rows.map((r) => [r.id, r]));
	const cache = new Map<string, ProjectColorKey | null>();

	function domainColor(id: string): ProjectColorKey | null {
		const hit = cache.get(id);
		if (hit !== undefined) return hit;

		const seen = new Set<string>();
		let cur: string | null = id;
		while (cur) {
			if (seen.has(cur)) break;
			seen.add(cur);
			const row = byId.get(cur);
			if (!row) break;
			if (row.parent_id == null) {
				const key = parseProjectColorKey(row.color);
				cache.set(id, key);
				return key;
			}
			cur = row.parent_id;
		}
		cache.set(id, null);
		return null;
	}

	const out: Record<string, ProjectColorKey | null> = {};
	for (const r of rows) {
		out[r.id] = domainColor(r.id);
	}
	return out;
}

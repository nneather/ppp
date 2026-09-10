import type { SportsStandingRow } from '$lib/types/sports';

export function leagueTeamKey(league: string, espnTeamId: string): string {
	return `${league}:${espnTeamId}`;
}

/** Division / conference table order: wins, then fewer losses, then win%, then name. */

/** Division / conference table order: wins, then fewer losses, then win%, then name. */
export function compareStandingRows(
	a: Pick<SportsStandingRow, 'wins' | 'losses' | 'win_percent' | 'team_name'>,
	b: Pick<SportsStandingRow, 'wins' | 'losses' | 'win_percent' | 'team_name'>
): number {
	if (b.wins !== a.wins) return b.wins - a.wins;
	if (a.losses !== b.losses) return a.losses - b.losses;
	const ap = a.win_percent;
	const bp = b.win_percent;
	if (ap != null && bp != null && ap !== bp) return bp - ap;
	if (ap != null && bp == null) return -1;
	if (ap == null && bp != null) return 1;
	return a.team_name.localeCompare(b.team_name);
}

export function groupStandings<T extends { group_name: string | null }>(
	rows: T[]
): [string, T[]][] {
	const map = new Map<string, T[]>();
	for (const s of rows) {
		const key = s.group_name ?? 'Standings';
		const list = map.get(key) ?? [];
		list.push(s);
		map.set(key, list);
	}
	const groups = [...map.entries()];
	groups.sort(([a], [b]) => a.localeCompare(b));
	return groups;
}

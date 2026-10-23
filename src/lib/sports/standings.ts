import {
	CFB_SUBDIVISIONS,
	CFB_SUBDIVISION_LABELS,
	isCfbSubdivision,
	SPORTS_LEAGUE_LABELS,
	SPORTS_LEAGUES,
	type SportsLeague,
	type SportsStandingRow
} from '$lib/types/sports';

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

export type StandingOrgFields = {
	league: SportsLeague;
	espn_team_id: string;
	group_name: string | null;
	subdivision: string | null;
	conference: string | null;
};

export type SportsOrgSelectId = 'league' | 'subdivision' | 'conference' | 'division';

export type SportsOrgSelect = {
	id: SportsOrgSelectId;
	label: string;
	value: string;
	options: { value: string; label: string }[];
};

export type ResolvedSportsOrg = {
	league: SportsLeague;
	/** True when subdivision and conference are still empty (pre-sync). */
	fallback: boolean;
	selects: SportsOrgSelect[];
	subdivision: string | null;
	conference: string | null;
	/** Leaf `group_name` for the one table, or the team-list filter. */
	division: string | null;
};

const NFL_CONFERENCE_ORDER = ['American Football Conference', 'National Football Conference'] as const;
const NFL_CONFERENCE_LABEL: Record<string, string> = {
	'American Football Conference': 'AFC',
	'National Football Conference': 'NFC'
};
const NFL_DIVISION_ORDER = [
	'AFC East',
	'AFC North',
	'AFC South',
	'AFC West',
	'NFC East',
	'NFC North',
	'NFC South',
	'NFC West'
] as const;

const MLB_CONFERENCE_ORDER = ['American League', 'National League'] as const;
const MLB_CONFERENCE_LABEL: Record<string, string> = {
	'American League': 'AL',
	'National League': 'NL'
};
const MLB_DIVISION_ORDER = [
	'American League East',
	'American League Central',
	'American League West',
	'National League East',
	'National League Central',
	'National League West'
] as const;

function uniqueNames(values: (string | null)[]): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const v of values) {
		if (v == null || seen.has(v)) continue;
		seen.add(v);
		out.push(v);
	}
	return out;
}

function orderNames(names: string[], preferred: readonly string[]): string[] {
	const set = new Set(names);
	const head = preferred.filter((n) => set.has(n));
	const rest = names.filter((n) => !preferred.includes(n)).sort((a, b) => a.localeCompare(b));
	return [...head, ...rest];
}

export function conferenceSelectLabel(league: SportsLeague, conference: string): string {
	if (league === 'nfl') return NFL_CONFERENCE_LABEL[conference] ?? conference;
	if (league === 'mlb') return MLB_CONFERENCE_LABEL[conference] ?? conference;
	return conference;
}

function divisionOrder(league: SportsLeague): readonly string[] {
	if (league === 'nfl') return NFL_DIVISION_ORDER;
	if (league === 'mlb') return MLB_DIVISION_ORDER;
	return [];
}

function conferenceOrder(league: SportsLeague): readonly string[] {
	if (league === 'nfl') return NFL_CONFERENCE_ORDER;
	if (league === 'mlb') return MLB_CONFERENCE_ORDER;
	return [];
}

export function parseOrgLeagueParam(raw: string | null): SportsLeague | null {
	if (raw == null) return null;
	return (SPORTS_LEAGUES as readonly string[]).includes(raw) ? (raw as SportsLeague) : null;
}

export function sportsOrgHasParents(rows: StandingOrgFields[]): boolean {
	return rows.some((r) => r.subdivision != null || r.conference != null);
}

function pickName(url: string | null, allowed: string[], preferred: string | null): string | null {
	if (url && allowed.includes(url)) return url;
	if (preferred && allowed.includes(preferred)) return preferred;
	return allowed[0] ?? null;
}

function followedRowIn(
	rows: StandingOrgFields[],
	league: SportsLeague,
	followed: { league: SportsLeague; espn_team_id: string }[]
): StandingOrgFields | null {
	for (const f of followed) {
		if (f.league !== league) continue;
		const row = rows.find((r) => r.league === f.league && r.espn_team_id === f.espn_team_id);
		if (row) return row;
	}
	return null;
}

export function resolveSportsOrg(
	rows: StandingOrgFields[],
	opts: {
		league: SportsLeague | 'all';
		orgLeague: SportsLeague | null;
		sub: string | null;
		conf: string | null;
		div: string | null;
		followed: { league: SportsLeague; espn_team_id: string }[];
	}
): ResolvedSportsOrg {
	const leaguesWithRows = SPORTS_LEAGUES.filter((l) => rows.some((r) => r.league === l));
	let league: SportsLeague;
	if (opts.league !== 'all') {
		league = opts.league;
	} else if (opts.orgLeague && leaguesWithRows.includes(opts.orgLeague)) {
		league = opts.orgLeague;
	} else {
		const fromFollow = opts.followed.find((f) => leaguesWithRows.includes(f.league));
		league = fromFollow?.league ?? leaguesWithRows[0] ?? 'nfl';
	}

	const leagueRows = rows.filter((r) => r.league === league);
	const followedRow = followedRowIn(rows, league, opts.followed);
	const leagueSelect: SportsOrgSelect | null =
		opts.league === 'all' && leaguesWithRows.length > 0
			? {
					id: 'league',
					label: 'League',
					value: league,
					options: leaguesWithRows.map((l) => ({ value: l, label: SPORTS_LEAGUE_LABELS[l] }))
				}
			: null;

	if (leagueRows.length === 0 || !sportsOrgHasParents(leagueRows)) {
		const leaves = orderNames(
			uniqueNames(leagueRows.map((r) => r.group_name)),
			divisionOrder(league)
		);
		const division = pickName(opts.div, leaves, followedRow?.group_name ?? null);
		const selects: SportsOrgSelect[] = [];
		if (leagueSelect) selects.push(leagueSelect);
		if (division) {
			selects.push({
				id: 'division',
				label: league === 'college-football' ? 'Conference' : 'Division',
				value: division,
				options: leaves.map((name) => ({
					value: name,
					label: name
				}))
			});
		}
		return {
			league,
			fallback: true,
			selects,
			subdivision: null,
			conference: null,
			division
		};
	}

	if (league === 'college-football') {
		const present = leagueRows.some((r) => isCfbSubdivision(r.subdivision));
		const subAllowed = present ? [...CFB_SUBDIVISIONS] : uniqueNames(leagueRows.map((r) => r.subdivision));
		const followedSub = isCfbSubdivision(followedRow?.subdivision) ? followedRow.subdivision : null;
		const subdivision = pickName(
			isCfbSubdivision(opts.sub) ? opts.sub : null,
			subAllowed,
			followedSub ?? subAllowed.find((s) => isCfbSubdivision(s)) ?? null
		);
		const confNames = orderNames(
			uniqueNames(
				leagueRows.filter((r) => r.subdivision === subdivision).map((r) => r.conference)
			),
			[]
		);
		const conference = pickName(
			opts.conf,
			confNames,
			followedRow?.subdivision === subdivision ? (followedRow.conference ?? null) : null
		);
		const leaves = orderNames(
			uniqueNames(
				leagueRows
					.filter((r) => r.subdivision === subdivision && r.conference === conference)
					.map((r) => r.group_name)
			),
			[]
		);
		const division =
			leaves.length > 1
				? pickName(
						opts.div,
						leaves,
						followedRow?.conference === conference ? (followedRow.group_name ?? null) : null
					)
				: (leaves[0] ?? null);
		const selects: SportsOrgSelect[] = [];
		if (leagueSelect) selects.push(leagueSelect);
		if (subdivision) {
			selects.push({
				id: 'subdivision',
				label: 'Subdivision',
				value: subdivision,
				options: subAllowed.map((s) => ({
					value: s,
					label: isCfbSubdivision(s) ? CFB_SUBDIVISION_LABELS[s] : s
				}))
			});
		}
		if (conference) {
			selects.push({
				id: 'conference',
				label: 'Conference',
				value: conference,
				options: confNames.map((name) => ({ value: name, label: name }))
			});
		}
		if (leaves.length > 1 && division) {
			selects.push({
				id: 'division',
				label: 'Division',
				value: division,
				options: leaves.map((name) => ({ value: name, label: name }))
			});
		}
		return {
			league,
			fallback: false,
			selects,
			subdivision,
			conference,
			division
		};
	}

	const confNames = orderNames(
		uniqueNames(leagueRows.map((r) => r.conference)),
		conferenceOrder(league)
	);
	const conference = pickName(opts.conf, confNames, followedRow?.conference ?? null);
	const leaves = orderNames(
		uniqueNames(leagueRows.filter((r) => r.conference === conference).map((r) => r.group_name)),
		divisionOrder(league)
	);
	const division =
		leaves.length > 1
			? pickName(
					opts.div,
					leaves,
					followedRow?.conference === conference ? (followedRow.group_name ?? null) : null
				)
			: (leaves[0] ?? null);
	const selects: SportsOrgSelect[] = [];
	if (leagueSelect) selects.push(leagueSelect);
	if (conference) {
		selects.push({
			id: 'conference',
			label: league === 'mlb' ? 'League' : 'Conference',
			value: conference,
			options: confNames.map((name) => ({
				value: name,
				label: conferenceSelectLabel(league, name)
			}))
		});
	}
	if (leaves.length > 1 && division) {
		selects.push({
			id: 'division',
			label: 'Division',
			value: division,
			options: leaves.map((name) => ({ value: name, label: name }))
		});
	}
	return {
		league,
		fallback: false,
		selects,
		subdivision: null,
		conference,
		division
	};
}

export function standingsInOrg<T extends StandingOrgFields>(
	rows: T[],
	org: ResolvedSportsOrg
): T[] {
	return rows.filter((s) => {
		if (s.league !== org.league) return false;
		if (org.division == null || s.group_name !== org.division) return false;
		if (!org.fallback && org.conference != null && s.conference !== org.conference) return false;
		if (!org.fallback && org.subdivision != null && s.subdivision !== org.subdivision) return false;
		return true;
	});
}

export function filterTeamsForOrg<
	T extends {
		league: SportsLeague;
		espn_team_id: string;
		display_name: string;
		abbreviation: string | null;
	}
>(teams: T[], standings: StandingOrgFields[], org: ResolvedSportsOrg, query: string): T[] {
	const q = query.trim().toLowerCase();
	const byKey = new Map(standings.map((s) => [leagueTeamKey(s.league, s.espn_team_id), s]));
	return teams.filter((t) => {
		if (t.league !== org.league) return false;
		if (q) {
			return (
				t.display_name.toLowerCase().includes(q) ||
				(t.abbreviation?.toLowerCase().includes(q) ?? false)
			);
		}
		const standing = byKey.get(leagueTeamKey(t.league, t.espn_team_id));
		if (!standing || org.division == null || standing.group_name !== org.division) return false;
		if (!org.fallback && org.conference != null && standing.conference !== org.conference) return false;
		if (!org.fallback && org.subdivision != null && standing.subdivision !== org.subdivision)
			return false;
		return true;
	});
}

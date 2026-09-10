/**
 * ESPN unofficial site API — fetch + normalize for the sports sync cache.
 *
 * Hosted endpoints are undocumented and may 403; we try site.web.api first
 * (site.api often 403s), and every field access is defensive.
 */
import { LEAGUE_SPORT, type GameState, type SportsLeague, type SportsSport } from '../types/sports';

export const ESPN_USER_AGENT = 'ppp-sports-sync/1.0';

/** site.api often 403s; try site.web.api first so cron/CLI don't burn the timeout. */
const ESPN_HOSTS = ['https://site.web.api.espn.com', 'https://site.api.espn.com'] as const;

export type EspnLeagueConfig = {
	league: SportsLeague;
	sport: SportsSport;
	/** Path segment after /sports/{sport}/ */
	espnLeague: string;
};

export const ESPN_LEAGUES: EspnLeagueConfig[] = [
	{ league: 'nfl', sport: 'football', espnLeague: 'nfl' },
	{ league: 'mlb', sport: 'baseball', espnLeague: 'mlb' },
	{ league: 'college-football', sport: 'football', espnLeague: 'college-football' }
];

export type NormalizedTeam = {
	league: SportsLeague;
	sport: SportsSport;
	espn_team_id: string;
	display_name: string;
	abbreviation: string | null;
	logo_url: string | null;
	color: string | null;
};

export type NormalizedGame = {
	league: SportsLeague;
	espn_event_id: string;
	start_time: string;
	state: GameState;
	status_detail: string | null;
	period: number | null;
	display_clock: string | null;
	home_espn_team_id: string | null;
	home_name: string | null;
	home_score: number | null;
	home_record: string | null;
	away_espn_team_id: string | null;
	away_name: string | null;
	away_score: number | null;
	away_record: string | null;
	broadcast: string | null;
	venue: string | null;
};

export type NormalizedStanding = {
	league: SportsLeague;
	season_year: number;
	espn_team_id: string;
	team_name: string;
	group_name: string | null;
	wins: number;
	losses: number;
	ties: number | null;
	win_percent: number | null;
	games_behind: number | null;
	streak: string | null;
	rank: number | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
	if (typeof v === 'string' && v.trim() !== '') return v;
	if (typeof v === 'number' && Number.isFinite(v)) return String(v);
	return null;
}

function asNumber(v: unknown): number | null {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v === 'string' && v.trim() !== '') {
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

function asInt(v: unknown): number | null {
	const n = asNumber(v);
	return n == null ? null : Math.trunc(n);
}

/** Season year for standings — never omit `season` (ESPN jumps ahead off-season). */
export function seasonYearForLeague(league: SportsLeague, now: Date = new Date()): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Chicago',
		year: 'numeric',
		month: 'numeric'
	}).formatToParts(now);
	let year = 0;
	let month = 0;
	for (const p of parts) {
		if (p.type === 'year') year = Number(p.value);
		if (p.type === 'month') month = Number(p.value);
	}
	if (league === 'mlb') {
		return month >= 3 ? year : year - 1;
	}
	return month >= 8 ? year : year - 1;
}

/** Civil YYYYMMDD for an instant in America/Chicago. */
export function ymdCompactChicago(instant: Date = new Date()): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Chicago',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(instant);
	let y = '';
	let m = '';
	let d = '';
	for (const p of parts) {
		if (p.type === 'year') y = p.value;
		else if (p.type === 'month') m = p.value;
		else if (p.type === 'day') d = p.value;
	}
	return `${y}${m}${d}`;
}

/** Yesterday → tomorrow compact range for scoreboard queries. */
export function scoreboardDatesParam(now: Date = new Date()): string {
	const today = ymdCompactChicago(now);
	const y = Number(today.slice(0, 4));
	const mo = Number(today.slice(4, 6));
	const d = Number(today.slice(6, 8));
	const noon = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
	const yest = new Date(noon);
	yest.setUTCDate(yest.getUTCDate() - 1);
	const tom = new Date(noon);
	tom.setUTCDate(tom.getUTCDate() + 1);
	const fmt = (dt: Date) => {
		const yy = dt.getUTCFullYear();
		const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
		const dd = String(dt.getUTCDate()).padStart(2, '0');
		return `${yy}${mm}${dd}`;
	};
	return `${fmt(yest)}-${fmt(tom)}`;
}

export async function espnFetchJson(pathAndQuery: string): Promise<unknown> {
	let lastErr: Error | null = null;
	for (const host of ESPN_HOSTS) {
		const url = `${host}${pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`}`;
		try {
			const res = await fetch(url, {
				headers: {
					'User-Agent': ESPN_USER_AGENT,
					Accept: 'application/json'
				}
			});
			if (!res.ok) {
				lastErr = new Error(`ESPN ${res.status} from ${host}`);
				continue;
			}
			return await res.json();
		} catch (e) {
			lastErr = e instanceof Error ? e : new Error(String(e));
		}
	}
	throw lastErr ?? new Error('ESPN fetch failed');
}

function pickLogo(team: Record<string, unknown>): string | null {
	const logos = team.logos;
	if (Array.isArray(logos) && logos.length > 0 && isRecord(logos[0])) {
		return asString(logos[0].href);
	}
	return asString(team.logo);
}

function competitorSide(
	comp: Record<string, unknown>,
	side: 'home' | 'away'
): {
	espn_team_id: string | null;
	name: string | null;
	score: number | null;
	record: string | null;
} {
	const competitors = comp.competitors;
	if (!Array.isArray(competitors)) {
		return { espn_team_id: null, name: null, score: null, record: null };
	}
	for (const c of competitors) {
		if (!isRecord(c)) continue;
		if (asString(c.homeAway) !== side) continue;
		const team = isRecord(c.team) ? c.team : {};
		let record: string | null = null;
		const records = c.records;
		if (Array.isArray(records)) {
			const total = records.find((r) => isRecord(r) && asString(r.type) === 'total');
			if (isRecord(total)) record = asString(total.summary);
			else if (isRecord(records[0])) record = asString(records[0].summary);
		}
		return {
			espn_team_id: asString(team.id) ?? asString(c.id),
			name: asString(team.displayName) ?? asString(team.name),
			score: asInt(c.score),
			record
		};
	}
	return { espn_team_id: null, name: null, score: null, record: null };
}

/** National broadcast name, else first geoBroadcast shortName. */
export function pickBroadcast(competition: Record<string, unknown>): string | null {
	const broadcasts = competition.broadcasts;
	if (Array.isArray(broadcasts)) {
		for (const b of broadcasts) {
			if (!isRecord(b)) continue;
			if (asString(b.market) === 'national') {
				const names = b.names;
				if (Array.isArray(names) && typeof names[0] === 'string') return names[0];
			}
		}
		for (const b of broadcasts) {
			if (!isRecord(b)) continue;
			const names = b.names;
			if (Array.isArray(names) && typeof names[0] === 'string') return names[0];
		}
	}
	const geos = competition.geoBroadcasts;
	if (Array.isArray(geos) && geos.length > 0 && isRecord(geos[0])) {
		const media = geos[0].media;
		if (isRecord(media)) return asString(media.shortName);
	}
	return asString(competition.broadcast);
}

function mapState(raw: string | null): GameState {
	if (raw === 'in' || raw === 'post' || raw === 'pre') return raw;
	return 'pre';
}

export function normalizeScoreboard(league: SportsLeague, payload: unknown): NormalizedGame[] {
	if (!isRecord(payload)) return [];
	const events = payload.events;
	if (!Array.isArray(events)) return [];
	const out: NormalizedGame[] = [];
	for (const ev of events) {
		if (!isRecord(ev)) continue;
		const eventId = asString(ev.id);
		if (!eventId) continue;
		const competitions = ev.competitions;
		const comp =
			Array.isArray(competitions) && competitions.length > 0 && isRecord(competitions[0])
				? competitions[0]
				: null;
		const status = isRecord(ev.status)
			? ev.status
			: comp && isRecord(comp.status)
				? comp.status
				: null;
		const statusType = status && isRecord(status.type) ? status.type : null;
		const home = comp ? competitorSide(comp, 'home') : null;
		const away = comp ? competitorSide(comp, 'away') : null;
		const venue = comp && isRecord(comp.venue) ? asString(comp.venue.fullName) : null;
		const start =
			asString(ev.date) ?? (comp ? (asString(comp.date) ?? asString(comp.startDate)) : null);
		if (!start) continue;
		out.push({
			league,
			espn_event_id: eventId,
			start_time: start,
			state: mapState(statusType ? asString(statusType.state) : null),
			status_detail:
				(statusType ? (asString(statusType.detail) ?? asString(statusType.shortDetail)) : null) ??
				null,
			period: status ? asInt(status.period) : null,
			display_clock: status ? asString(status.displayClock) : null,
			home_espn_team_id: home?.espn_team_id ?? null,
			home_name: home?.name ?? null,
			home_score: home?.score ?? null,
			home_record: home?.record ?? null,
			away_espn_team_id: away?.espn_team_id ?? null,
			away_name: away?.name ?? null,
			away_score: away?.score ?? null,
			away_record: away?.record ?? null,
			broadcast: comp ? pickBroadcast(comp) : null,
			venue
		});
	}
	return out;
}

export function normalizeTeams(league: SportsLeague, payload: unknown): NormalizedTeam[] {
	const sport = LEAGUE_SPORT[league];
	if (!isRecord(payload)) return [];
	const sports = payload.sports;
	if (!Array.isArray(sports) || !isRecord(sports[0])) return [];
	const leagues = sports[0].leagues;
	if (!Array.isArray(leagues) || !isRecord(leagues[0])) return [];
	const teams = leagues[0].teams;
	if (!Array.isArray(teams)) return [];
	const out: NormalizedTeam[] = [];
	for (const wrap of teams) {
		if (!isRecord(wrap)) continue;
		const team = isRecord(wrap.team) ? wrap.team : wrap;
		const id = asString(team.id);
		const name = asString(team.displayName) ?? asString(team.name);
		if (!id || !name) continue;
		out.push({
			league,
			sport,
			espn_team_id: id,
			display_name: name,
			abbreviation: asString(team.abbreviation),
			logo_url: pickLogo(team),
			color: asString(team.color)
		});
	}
	return out;
}

function statMap(stats: unknown): Map<string, { value: number | null; display: string | null }> {
	const map = new Map<string, { value: number | null; display: string | null }>();
	if (!Array.isArray(stats)) return map;
	for (const s of stats) {
		if (!isRecord(s)) continue;
		const name = asString(s.name);
		if (!name) continue;
		map.set(name, {
			value: asNumber(s.value),
			display: asString(s.displayValue) ?? asString(s.display)
		});
	}
	return map;
}

/** Parse `"12-5"` / `"12-5-1"` overall display into wins/losses/ties. */
export function parseOverallRecord(display: string | null | undefined): {
	wins: number;
	losses: number;
	ties: number | null;
} | null {
	if (!display) return null;
	const m = /^(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?/.exec(display.trim());
	if (!m) return null;
	return {
		wins: Number(m[1]),
		losses: Number(m[2]),
		ties: m[3] != null ? Number(m[3]) : null
	};
}

function gamesBehindValue(
	stat: { value: number | null; display: string | null } | undefined
): number | null {
	if (!stat) return null;
	if (stat.display === '-' || stat.display === '—' || stat.display === '') return null;
	return stat.value;
}

function standingFromEntry(
	league: SportsLeague,
	seasonYear: number,
	groupName: string | null,
	entry: Record<string, unknown>
): NormalizedStanding | null {
	const team = isRecord(entry.team) ? entry.team : {};
	const espnId = asString(team.id);
	const teamName = asString(team.displayName) ?? asString(team.name);
	if (!espnId || !teamName) return null;
	const stats = statMap(entry.stats);
	const overall = parseOverallRecord(stats.get('overall')?.display);
	const wins = asInt(stats.get('wins')?.value) ?? overall?.wins ?? 0;
	let losses = asInt(stats.get('losses')?.value);
	if (losses == null) losses = overall?.losses ?? 0;
	const ties =
		asInt(stats.get('ties')?.value) ?? asInt(stats.get('otLosses')?.value) ?? overall?.ties ?? null;
	return {
		league,
		season_year: seasonYear,
		espn_team_id: espnId,
		team_name: teamName,
		group_name: groupName,
		wins,
		losses,
		ties,
		win_percent: stats.get('winPercent')?.value ?? null,
		games_behind: gamesBehindValue(stats.get('gamesBehind')),
		streak: stats.get('streak')?.display ?? null,
		rank: asInt(stats.get('playoffSeed')?.value)
	};
}

/**
 * Walk standings `children` recursively; only leaf groups (no further children)
 * contribute rows so conference+division nesting does not double-insert a team.
 */
export function normalizeStandings(
	league: SportsLeague,
	seasonYear: number,
	payload: unknown
): NormalizedStanding[] {
	if (!isRecord(payload)) return [];
	const out: NormalizedStanding[] = [];
	const seen = new Set<string>();

	function walk(node: Record<string, unknown>, parentPath: string[]) {
		const name = asString(node.name);
		const path = name ? [...parentPath, name] : parentPath;
		const children = node.children;
		if (Array.isArray(children) && children.length > 0) {
			for (const child of children) {
				if (isRecord(child)) walk(child, path);
			}
			return;
		}
		const standings = node.standings;
		const entries =
			isRecord(standings) && Array.isArray(standings.entries) ? standings.entries : null;
		if (!entries) return;
		const groupName = path.length > 0 ? path.join(' / ') : name;
		for (const entry of entries) {
			if (!isRecord(entry)) continue;
			const row = standingFromEntry(league, seasonYear, groupName, entry);
			if (!row) continue;
			const key = `${row.league}:${row.season_year}:${row.espn_team_id}`;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(row);
		}
	}

	walk(payload, []);
	return out;
}

export async function fetchScoreboard(
	cfg: EspnLeagueConfig,
	dates: string
): Promise<NormalizedGame[]> {
	const qs = new URLSearchParams({ dates, limit: '200' });
	if (cfg.league === 'college-football') {
		qs.set('groups', '80');
	}
	const path = `/apis/site/v2/sports/${cfg.sport}/${cfg.espnLeague}/scoreboard?${qs}`;
	const json = await espnFetchJson(path);
	return normalizeScoreboard(cfg.league, json);
}

export async function fetchTeams(cfg: EspnLeagueConfig): Promise<NormalizedTeam[]> {
	const path = `/apis/site/v2/sports/${cfg.sport}/${cfg.espnLeague}/teams?limit=500`;
	const json = await espnFetchJson(path);
	return normalizeTeams(cfg.league, json);
}

export async function fetchStandings(
	cfg: EspnLeagueConfig,
	seasonYear: number
): Promise<NormalizedStanding[]> {
	const path = `/apis/v2/sports/${cfg.sport}/${cfg.espnLeague}/standings?season=${seasonYear}`;
	const json = await espnFetchJson(path);
	return normalizeStandings(cfg.league, seasonYear, json);
}

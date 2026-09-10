import type { SupabaseClient } from '@supabase/supabase-js';
import { addDaysYmd, ymdInChicago } from '$lib/invoicing/chicago-date';
import {
	SPORTS_LEAGUES,
	type GameState,
	type SportsGlanceGame,
	type SportsGameRow,
	type SportsLeague,
	type SportsStandingRow,
	type SportsTeamRow
} from '$lib/types/sports';

export type SportsPageData = {
	league: SportsLeague | 'all';
	games: SportsGameRow[];
	standings: SportsStandingRow[];
	teams: SportsTeamRow[];
	followedCount: number;
	isOwner: boolean;
	lastSyncedAt: string | null;
	loadError: string | null;
};

function isLeague(v: string | null): v is SportsLeague {
	return v != null && (SPORTS_LEAGUES as readonly string[]).includes(v);
}

export function parseSportsLeagueParam(raw: string | null): SportsLeague | 'all' {
	if (!raw || raw === 'all') return 'all';
	return isLeague(raw) ? raw : 'all';
}

function mapGame(row: Record<string, unknown>): SportsGameRow {
	return {
		id: String(row.id),
		league: row.league as SportsLeague,
		espn_event_id: String(row.espn_event_id),
		start_time: String(row.start_time),
		state: row.state as GameState,
		status_detail: (row.status_detail as string | null) ?? null,
		period: (row.period as number | null) ?? null,
		display_clock: (row.display_clock as string | null) ?? null,
		home_espn_team_id: (row.home_espn_team_id as string | null) ?? null,
		home_name: (row.home_name as string | null) ?? null,
		home_score: (row.home_score as number | null) ?? null,
		home_record: (row.home_record as string | null) ?? null,
		away_espn_team_id: (row.away_espn_team_id as string | null) ?? null,
		away_name: (row.away_name as string | null) ?? null,
		away_score: (row.away_score as number | null) ?? null,
		away_record: (row.away_record as string | null) ?? null,
		broadcast: (row.broadcast as string | null) ?? null,
		venue: (row.venue as string | null) ?? null,
		synced_at: String(row.synced_at)
	};
}

function mapTeam(row: Record<string, unknown>): SportsTeamRow {
	return {
		id: String(row.id),
		league: row.league as SportsLeague,
		sport: row.sport as SportsTeamRow['sport'],
		espn_team_id: String(row.espn_team_id),
		display_name: String(row.display_name),
		abbreviation: (row.abbreviation as string | null) ?? null,
		logo_url: (row.logo_url as string | null) ?? null,
		color: (row.color as string | null) ?? null,
		is_followed: Boolean(row.is_followed)
	};
}

function mapStanding(row: Record<string, unknown>): SportsStandingRow {
	return {
		id: String(row.id),
		league: row.league as SportsLeague,
		season_year: Number(row.season_year),
		espn_team_id: String(row.espn_team_id),
		team_name: String(row.team_name),
		group_name: (row.group_name as string | null) ?? null,
		wins: Number(row.wins ?? 0),
		losses: Number(row.losses ?? 0),
		ties: (row.ties as number | null) ?? null,
		win_percent: (row.win_percent as number | null) ?? null,
		games_behind: (row.games_behind as number | null) ?? null,
		streak: (row.streak as string | null) ?? null,
		rank: (row.rank as number | null) ?? null,
		synced_at: String(row.synced_at)
	};
}

export async function loadSportsPage(
	supabase: SupabaseClient,
	opts: { league: SportsLeague | 'all'; isOwner: boolean }
): Promise<SportsPageData> {
	const league = opts.league;

	let teamsQ = supabase
		.from('sports_teams')
		.select(
			'id, league, sport, espn_team_id, display_name, abbreviation, logo_url, color, is_followed'
		)
		.is('deleted_at', null)
		.order('display_name');
	if (league !== 'all') teamsQ = teamsQ.eq('league', league);

	const teamsRes = await teamsQ;
	if (teamsRes.error) {
		return {
			league,
			games: [],
			standings: [],
			teams: [],
			followedCount: 0,
			isOwner: opts.isOwner,
			lastSyncedAt: null,
			loadError: teamsRes.error.message
		};
	}
	const teams = (teamsRes.data ?? []).map((r) => mapTeam(r as Record<string, unknown>));
	const followed = teams.filter((t) => t.is_followed);
	const followedCount = followed.length;
	const followedEspnIds = new Set(followed.map((t) => t.espn_team_id));
	const followedGroups = new Set<string>();

	const today = ymdInChicago();
	const gamesFrom = addDaysYmd(today, -2) ?? today;
	const gamesTo = addDaysYmd(today, 8) ?? today;

	let gamesQ = supabase
		.from('sports_games')
		.select(
			'id, league, espn_event_id, start_time, state, status_detail, period, display_clock, home_espn_team_id, home_name, home_score, home_record, away_espn_team_id, away_name, away_score, away_record, broadcast, venue, synced_at'
		)
		.is('deleted_at', null)
		.gte('start_time', `${gamesFrom}T00:00:00`)
		.lt('start_time', `${gamesTo}T00:00:00`)
		.order('start_time', { ascending: true })
		.limit(400);
	if (league !== 'all') gamesQ = gamesQ.eq('league', league);

	let standingsQ = supabase
		.from('sports_standings')
		.select(
			'id, league, season_year, espn_team_id, team_name, group_name, wins, losses, ties, win_percent, games_behind, streak, rank, synced_at'
		)
		.is('deleted_at', null)
		.order('rank', { ascending: true, nullsFirst: false })
		.limit(1200);
	if (league !== 'all') standingsQ = standingsQ.eq('league', league);

	const [gamesRes, standingsRes] = await Promise.all([gamesQ, standingsQ]);
	if (gamesRes.error || standingsRes.error) {
		return {
			league,
			games: [],
			standings: [],
			teams,
			followedCount,
			isOwner: opts.isOwner,
			lastSyncedAt: null,
			loadError: gamesRes.error?.message ?? standingsRes.error?.message ?? 'Load failed'
		};
	}

	let games = (gamesRes.data ?? []).map((r) => mapGame(r as Record<string, unknown>));
	let standings = (standingsRes.data ?? []).map((r) => mapStanding(r as Record<string, unknown>));

	let lastSyncedAt: string | null = null;
	for (const g of games) {
		if (!lastSyncedAt || g.synced_at > lastSyncedAt) lastSyncedAt = g.synced_at;
	}
	for (const s of standings) {
		if (!lastSyncedAt || s.synced_at > lastSyncedAt) lastSyncedAt = s.synced_at;
	}

	if (followedCount > 0) {
		games = games.filter(
			(g) =>
				(g.home_espn_team_id != null && followedEspnIds.has(g.home_espn_team_id)) ||
				(g.away_espn_team_id != null && followedEspnIds.has(g.away_espn_team_id))
		);
		for (const s of standings) {
			if (followedEspnIds.has(s.espn_team_id) && s.group_name) followedGroups.add(s.group_name);
		}
		if (followedGroups.size > 0) {
			standings = standings.filter((s) => s.group_name != null && followedGroups.has(s.group_name));
		} else {
			standings = standings.filter((s) => followedEspnIds.has(s.espn_team_id));
		}
	} else {
		// No follows yet — hide the CFB wall; show NFL + MLB only.
		games = games.filter((g) => g.league === 'nfl' || g.league === 'mlb');
		standings = standings.filter((s) => s.league === 'nfl' || s.league === 'mlb');
	}

	return {
		league,
		games,
		standings,
		teams,
		followedCount,
		isOwner: opts.isOwner,
		lastSyncedAt,
		loadError: null
	};
}

/** Yesterday + today followed-team games; else next upcoming followed games. */
export async function loadFollowedSportsGlance(
	supabase: SupabaseClient
): Promise<{ games: SportsGlanceGame[]; error: string | null }> {
	const today = ymdInChicago();
	const yesterday = addDaysYmd(today, -1) ?? today;
	const dayAfter = addDaysYmd(today, 2) ?? today;

	const { data: followed, error: followedErr } = await supabase
		.from('sports_teams')
		.select('espn_team_id')
		.eq('is_followed', true)
		.is('deleted_at', null);

	if (followedErr) return { games: [], error: followedErr.message };
	const ids = (followed ?? []).map((t) => String(t.espn_team_id));
	if (ids.length === 0) return { games: [], error: null };

	const idSet = new Set(ids);

	const { data, error } = await supabase
		.from('sports_games')
		.select(
			'id, league, start_time, state, status_detail, home_name, home_score, away_name, away_score, broadcast, home_espn_team_id, away_espn_team_id'
		)
		.is('deleted_at', null)
		.gte('start_time', `${yesterday}T00:00:00`)
		.lt('start_time', `${dayAfter}T00:00:00`)
		.order('start_time', { ascending: true })
		.limit(40);

	if (error) return { games: [], error: error.message };

	const toGlance = (g: Record<string, unknown>): SportsGlanceGame => ({
		id: String(g.id),
		league: g.league as SportsLeague,
		start_time: String(g.start_time),
		state: g.state as GameState,
		status_detail: (g.status_detail as string | null) ?? null,
		home_name: (g.home_name as string | null) ?? null,
		home_score: (g.home_score as number | null) ?? null,
		away_name: (g.away_name as string | null) ?? null,
		away_score: (g.away_score as number | null) ?? null,
		broadcast: (g.broadcast as string | null) ?? null
	});

	const involvesFollowed = (g: Record<string, unknown>) => {
		const home = g.home_espn_team_id != null ? String(g.home_espn_team_id) : null;
		const away = g.away_espn_team_id != null ? String(g.away_espn_team_id) : null;
		return (home != null && idSet.has(home)) || (away != null && idSet.has(away));
	};

	let games = (data ?? [])
		.filter((g) => involvesFollowed(g as Record<string, unknown>))
		.map((g) => toGlance(g as Record<string, unknown>));

	if (games.length === 0) {
		const { data: next, error: nextErr } = await supabase
			.from('sports_games')
			.select(
				'id, league, start_time, state, status_detail, home_name, home_score, away_name, away_score, broadcast, home_espn_team_id, away_espn_team_id'
			)
			.is('deleted_at', null)
			.eq('state', 'pre')
			.gte('start_time', `${today}T00:00:00`)
			.order('start_time', { ascending: true })
			.limit(30);
		if (nextErr) return { games: [], error: nextErr.message };
		games = (next ?? [])
			.filter((g) => involvesFollowed(g as Record<string, unknown>))
			.slice(0, 3)
			.map((g) => toGlance(g as Record<string, unknown>));
	}

	return { games, error: null };
}

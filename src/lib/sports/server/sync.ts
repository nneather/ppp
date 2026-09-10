import type { SupabaseClient } from '@supabase/supabase-js';
import {
	ESPN_LEAGUES,
	fetchScoreboard,
	fetchStandings,
	fetchTeams,
	scoreboardDatesParam,
	scoreboardDaysAhead,
	seasonYearForLeague,
	type EspnLeagueConfig,
	type NormalizedGame,
	type NormalizedStanding,
	type NormalizedTeam
} from '$lib/sports/espn';

export type LeagueSyncResult = {
	league: string;
	ok: boolean;
	gamesUpserted?: number;
	standingsUpserted?: number;
	teamsUpserted?: number;
	error?: string;
};

export type SyncResult = {
	ok: boolean;
	dates: string;
	includeStandings: boolean;
	leagues: LeagueSyncResult[];
};

const UPSERT_CHUNK = 200;

async function upsertChunks(
	admin: SupabaseClient,
	table: 'sports_games' | 'sports_teams' | 'sports_standings',
	onConflict: string,
	rows: Record<string, unknown>[]
): Promise<number> {
	if (rows.length === 0) return 0;
	for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
		const chunk = rows.slice(i, i + UPSERT_CHUNK);
		const { error } = await admin.from(table).upsert(chunk, { onConflict });
		if (error) throw new Error(error.message);
	}
	return rows.length;
}

async function upsertGames(admin: SupabaseClient, games: NormalizedGame[]): Promise<number> {
	if (games.length === 0) return 0;
	const syncedAt = new Date().toISOString();
	const rows = games.map((g) => ({
		league: g.league,
		espn_event_id: g.espn_event_id,
		start_time: g.start_time,
		state: g.state,
		status_detail: g.status_detail,
		period: g.period,
		display_clock: g.display_clock,
		home_espn_team_id: g.home_espn_team_id,
		home_name: g.home_name,
		home_score: g.home_score,
		home_record: g.home_record,
		away_espn_team_id: g.away_espn_team_id,
		away_name: g.away_name,
		away_score: g.away_score,
		away_record: g.away_record,
		broadcast: g.broadcast,
		venue: g.venue,
		synced_at: syncedAt,
		deleted_at: null
	}));
	return upsertChunks(admin, 'sports_games', 'league,espn_event_id', rows);
}

/** Upsert teams without clobbering is_followed. */
async function upsertTeams(admin: SupabaseClient, teams: NormalizedTeam[]): Promise<number> {
	if (teams.length === 0) return 0;
	const rows = teams.map((t) => ({
		league: t.league,
		sport: t.sport,
		espn_team_id: t.espn_team_id,
		display_name: t.display_name,
		abbreviation: t.abbreviation,
		logo_url: t.logo_url,
		color: t.color,
		deleted_at: null
	}));
	return upsertChunks(admin, 'sports_teams', 'league,espn_team_id', rows);
}

async function upsertStandings(
	admin: SupabaseClient,
	standings: NormalizedStanding[]
): Promise<number> {
	if (standings.length === 0) return 0;
	const syncedAt = new Date().toISOString();
	const rows = standings.map((s) => ({
		league: s.league,
		season_year: s.season_year,
		espn_team_id: s.espn_team_id,
		team_name: s.team_name,
		group_name: s.group_name,
		wins: s.wins,
		losses: s.losses,
		ties: s.ties,
		win_percent: s.win_percent,
		games_behind: s.games_behind,
		streak: s.streak,
		rank: s.rank,
		synced_at: syncedAt,
		deleted_at: null
	}));
	return upsertChunks(admin, 'sports_standings', 'league,season_year,espn_team_id', rows);
}

async function syncLeague(
	admin: SupabaseClient,
	cfg: EspnLeagueConfig,
	now: Date,
	includeStandings: boolean
): Promise<LeagueSyncResult> {
	const dates = scoreboardDatesParam(now, scoreboardDaysAhead(cfg.league));
	try {
		const games = await fetchScoreboard(cfg, dates);
		const gamesUpserted = await upsertGames(admin, games);
		let teamsUpserted = 0;
		let standingsUpserted = 0;
		if (includeStandings) {
			const seasonYear = seasonYearForLeague(cfg.league);
			const [teams, standings] = await Promise.all([
				fetchTeams(cfg),
				fetchStandings(cfg, seasonYear)
			]);
			teamsUpserted = await upsertTeams(admin, teams);
			standingsUpserted = await upsertStandings(admin, standings);
		}
		return {
			league: cfg.league,
			ok: true,
			gamesUpserted: gamesUpserted,
			teamsUpserted: includeStandings ? teamsUpserted : undefined,
			standingsUpserted: includeStandings ? standingsUpserted : undefined
		};
	} catch (e) {
		return {
			league: cfg.league,
			ok: false,
			error: e instanceof Error ? e.message : String(e)
		};
	}
}

/** Upsert scoreboards (and optionally teams + standings) for all configured leagues. */
export async function runSportsSync(
	admin: SupabaseClient,
	opts: { includeStandings?: boolean; now?: Date } = {}
): Promise<SyncResult> {
	const includeStandings = opts.includeStandings === true;
	const now = opts.now ?? new Date();
	const dates = scoreboardDatesParam(now, 6);
	const settled = await Promise.allSettled(
		ESPN_LEAGUES.map((cfg) => syncLeague(admin, cfg, now, includeStandings))
	);
	const leagues: LeagueSyncResult[] = settled.map((r, i) => {
		if (r.status === 'fulfilled') return r.value;
		return {
			league: ESPN_LEAGUES[i]?.league ?? 'unknown',
			ok: false,
			error: r.reason instanceof Error ? r.reason.message : String(r.reason)
		};
	});
	return {
		ok: leagues.every((l) => l.ok),
		dates,
		includeStandings,
		leagues
	};
}

/**
 * ESPN → sports_* cache (CLI / GitHub Actions). No $lib aliases — Node/tsx friendly.
 *
 *   npm run sports:sync
 *   npm run sports:sync -- --standings
 *
 * Env: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env + .env.local).
 * GHA sets the same vars as secrets; dotenv files are optional there.
 */
import { config } from 'dotenv';
import {
	ESPN_LEAGUES,
	fetchScoreboard,
	fetchStandings,
	fetchTeams,
	scoreboardDatesParam,
	seasonYearForLeague,
	type NormalizedGame,
	type NormalizedStanding,
	type NormalizedTeam
} from '../src/lib/sports/espn.ts';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const INCLUDE_STANDINGS = process.argv.includes('--standings');

const url = process.env.PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
	console.error('Need PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
	process.exit(1);
}

const restBase = `${url.replace(/\/$/, '')}/rest/v1`;

function gameRows(games: NormalizedGame[]) {
	const syncedAt = new Date().toISOString();
	return games.map((g) => ({
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
}

function teamRows(teams: NormalizedTeam[]) {
	return teams.map((t) => ({
		league: t.league,
		sport: t.sport,
		espn_team_id: t.espn_team_id,
		display_name: t.display_name,
		abbreviation: t.abbreviation,
		logo_url: t.logo_url,
		color: t.color,
		deleted_at: null
	}));
}

function standingRows(standings: NormalizedStanding[]) {
	const syncedAt = new Date().toISOString();
	return standings.map((s) => ({
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
}

async function upsert(
	table: string,
	onConflict: string,
	rows: Record<string, unknown>[]
): Promise<number> {
	if (rows.length === 0) return 0;
	const endpoint = `${restBase}/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
	const res = await fetch(endpoint, {
		method: 'POST',
		headers: {
			apikey: key!,
			Authorization: `Bearer ${key}`,
			'Content-Type': 'application/json',
			Prefer: 'resolution=merge-duplicates,return=minimal'
		},
		body: JSON.stringify(rows)
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`${table} upsert ${res.status}: ${body.slice(0, 500)}`);
	}
	return rows.length;
}

async function syncLeague(dates: string, includeStandings: boolean) {
	const results: { league: string; ok: boolean; error?: string; [k: string]: unknown }[] = [];
	for (const cfg of ESPN_LEAGUES) {
		try {
			const games = await fetchScoreboard(cfg, dates);
			const gamesUpserted = await upsert('sports_games', 'league,espn_event_id', gameRows(games));
			let teamsUpserted = 0;
			let standingsUpserted = 0;
			if (includeStandings) {
				const seasonYear = seasonYearForLeague(cfg.league);
				const [teams, standings] = await Promise.all([
					fetchTeams(cfg),
					fetchStandings(cfg, seasonYear)
				]);
				teamsUpserted = await upsert('sports_teams', 'league,espn_team_id', teamRows(teams));
				standingsUpserted = await upsert(
					'sports_standings',
					'league,season_year,espn_team_id',
					standingRows(standings)
				);
			}
			results.push({
				league: cfg.league,
				ok: true,
				gamesUpserted,
				teamsUpserted: includeStandings ? teamsUpserted : undefined,
				standingsUpserted: includeStandings ? standingsUpserted : undefined
			});
		} catch (e) {
			results.push({
				league: cfg.league,
				ok: false,
				error: e instanceof Error ? e.message : String(e)
			});
		}
	}
	return results;
}

const dates = scoreboardDatesParam(new Date());
const leagues = await syncLeague(dates, INCLUDE_STANDINGS);
const ok = leagues.every((l) => l.ok);
const payload = { ok, dates, includeStandings: INCLUDE_STANDINGS, leagues };
console.log(JSON.stringify(payload, null, 2));
if (!ok) process.exit(1);

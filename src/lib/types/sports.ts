/** Closed league / sport enums for the sports sync cache. */

export const SPORTS_LEAGUES = ['nfl', 'mlb', 'college-football'] as const;
export type SportsLeague = (typeof SPORTS_LEAGUES)[number];

export const SPORTS_LEAGUE_LABELS: Record<SportsLeague, string> = {
	nfl: 'NFL',
	mlb: 'MLB',
	'college-football': 'College football'
};

export type SportsSport = 'football' | 'baseball';

export const LEAGUE_SPORT: Record<SportsLeague, SportsSport> = {
	nfl: 'football',
	mlb: 'baseball',
	'college-football': 'football'
};

export const GAME_STATES = ['pre', 'in', 'post'] as const;
export type GameState = (typeof GAME_STATES)[number];

export type SportsTeamRow = {
	id: string;
	league: SportsLeague;
	sport: SportsSport;
	espn_team_id: string;
	display_name: string;
	abbreviation: string | null;
	logo_url: string | null;
	color: string | null;
	is_followed: boolean;
};

export type SportsGameRow = {
	id: string;
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
	synced_at: string;
};

export type SportsStandingRow = {
	id: string;
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
	synced_at: string;
};

export type SportsGlanceGame = {
	id: string;
	league: SportsLeague;
	start_time: string;
	state: GameState;
	status_detail: string | null;
	home_name: string | null;
	home_score: number | null;
	away_name: string | null;
	away_score: number | null;
	broadcast: string | null;
};

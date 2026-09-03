import { describe, expect, it } from 'vitest';
import {
	normalizeScoreboard,
	normalizeStandings,
	normalizeTeams,
	parseOverallRecord,
	pickBroadcast,
	scoreboardDatesParam,
	seasonYearForLeague
} from '../espn';

describe('seasonYearForLeague', () => {
	it('uses calendar year for NFL/CFB from August onward', () => {
		expect(seasonYearForLeague('nfl', new Date('2026-09-02T12:00:00Z'))).toBe(2026);
		expect(seasonYearForLeague('college-football', new Date('2026-09-02T12:00:00Z'))).toBe(2026);
	});

	it('uses prior calendar year for NFL/CFB before August', () => {
		expect(seasonYearForLeague('nfl', new Date('2026-02-01T12:00:00Z'))).toBe(2025);
	});

	it('uses calendar year for MLB from March onward (never omit season)', () => {
		expect(seasonYearForLeague('mlb', new Date('2026-09-02T12:00:00Z'))).toBe(2026);
		expect(seasonYearForLeague('mlb', new Date('2026-02-01T12:00:00Z'))).toBe(2025);
	});
});

describe('scoreboardDatesParam', () => {
	it('returns a yesterday-through-tomorrow YYYYMMDD range', () => {
		const param = scoreboardDatesParam(new Date('2026-09-02T17:00:00Z'));
		expect(param).toMatch(/^\d{8}-\d{8}$/);
		const [start, end] = param.split('-');
		expect(Number(end)).toBeGreaterThan(Number(start));
	});
});

describe('parseOverallRecord', () => {
	it('parses W-L and W-L-T displays', () => {
		expect(parseOverallRecord('12-5')).toEqual({ wins: 12, losses: 5, ties: null });
		expect(parseOverallRecord('1-0-1')).toEqual({ wins: 1, losses: 0, ties: 1 });
	});

	it('returns null for empty/garbage', () => {
		expect(parseOverallRecord(null)).toBeNull();
		expect(parseOverallRecord('n/a')).toBeNull();
	});
});

describe('pickBroadcast', () => {
	it('prefers national broadcasts, else geo shortName', () => {
		expect(
			pickBroadcast({
				broadcasts: [
					{ market: 'local', names: ['ABC'] },
					{ market: 'national', names: ['NBC'] }
				]
			})
		).toBe('NBC');

		expect(
			pickBroadcast({
				geoBroadcasts: [{ media: { shortName: 'ESPN' } }]
			})
		).toBe('ESPN');
	});
});

describe('normalizeScoreboard', () => {
	it('maps events defensively including TV', () => {
		const games = normalizeScoreboard('nfl', {
			events: [
				{
					id: '401',
					date: '2026-09-07T17:00:00Z',
					status: { type: { state: 'pre', detail: 'Scheduled' }, period: 0, displayClock: '0:00' },
					competitions: [
						{
							competitors: [
								{
									homeAway: 'home',
									score: '0',
									team: { id: '12', displayName: 'Chiefs' },
									records: [{ type: 'total', summary: '0-0' }]
								},
								{
									homeAway: 'away',
									score: '0',
									team: { id: '9', displayName: 'Ravens' },
									records: [{ type: 'total', summary: '0-0' }]
								}
							],
							broadcasts: [{ market: 'national', names: ['NBC'] }],
							venue: { fullName: 'Arrowhead' }
						}
					]
				}
			]
		});
		expect(games).toHaveLength(1);
		expect(games[0]).toMatchObject({
			league: 'nfl',
			espn_event_id: '401',
			state: 'pre',
			home_name: 'Chiefs',
			away_name: 'Ravens',
			broadcast: 'NBC',
			venue: 'Arrowhead'
		});
	});
});

describe('normalizeTeams', () => {
	it('reads nested sports/leagues/teams', () => {
		const teams = normalizeTeams('mlb', {
			sports: [
				{
					leagues: [
						{
							teams: [
								{
									team: {
										id: '10',
										displayName: 'Yankees',
										abbreviation: 'NYY',
										color: '132448',
										logos: [{ href: 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png' }]
									}
								}
							]
						}
					]
				}
			]
		});
		expect(teams).toEqual([
			{
				league: 'mlb',
				sport: 'baseball',
				espn_team_id: '10',
				display_name: 'Yankees',
				abbreviation: 'NYY',
				logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png',
				color: '132448'
			}
		]);
	});
});

describe('normalizeStandings', () => {
	it('walks leaf groups only and dedupes teams', () => {
		const rows = normalizeStandings('nfl', 2026, {
			name: 'NFL',
			children: [
				{
					name: 'AFC',
					children: [
						{
							name: 'West',
							standings: {
								entries: [
									{
										team: { id: '12', displayName: 'Chiefs' },
										stats: [
											{ name: 'wins', value: 1 },
											{ name: 'losses', value: 0 },
											{ name: 'playoffSeed', value: 1 },
											{ name: 'streak', displayValue: 'W1' },
											{ name: 'gamesBehind', value: 0, displayValue: '-' }
										]
									}
								]
							}
						}
					]
				},
				{
					name: 'AFC duplicate parent',
					children: [
						{
							name: 'West again',
							standings: {
								entries: [
									{
										team: { id: '12', displayName: 'Chiefs' },
										stats: [
											{ name: 'wins', value: 1 },
											{ name: 'losses', value: 0 }
										]
									}
								]
							}
						}
					]
				}
			]
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			league: 'nfl',
			season_year: 2026,
			espn_team_id: '12',
			team_name: 'Chiefs',
			group_name: 'NFL / AFC / West',
			wins: 1,
			losses: 0,
			rank: 1,
			games_behind: null,
			streak: 'W1'
		});
	});

	it('parses CFB overall display when losses stat is missing', () => {
		const rows = normalizeStandings('college-football', 2026, {
			name: 'FBS',
			standings: {
				entries: [
					{
						team: { id: '99', displayName: 'Sample U' },
						stats: [
							{ name: 'wins', value: 1 },
							{ name: 'overall', displayValue: '1-0' },
							{ name: 'playoffSeed', value: 8 }
						]
					}
				]
			}
		});
		expect(rows[0]).toMatchObject({ wins: 1, losses: 0, rank: 8 });
	});
});

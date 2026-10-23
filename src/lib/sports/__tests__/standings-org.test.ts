import { describe, expect, it } from 'vitest';
import {
	filterTeamsForOrg,
	resolveSportsOrg,
	standingsInOrg,
	type StandingOrgFields
} from '../standings';

function orgRow(partial: Partial<StandingOrgFields> & Pick<StandingOrgFields, 'league' | 'group_name'>): StandingOrgFields {
	return {
		espn_team_id: partial.espn_team_id ?? partial.group_name ?? '1',
		subdivision: null,
		conference: null,
		...partial
	};
}

const nfl = [
	orgRow({
		league: 'nfl',
		espn_team_id: '2',
		group_name: 'AFC East',
		conference: 'American Football Conference'
	}),
	orgRow({
		league: 'nfl',
		espn_team_id: '12',
		group_name: 'AFC West',
		conference: 'American Football Conference'
	}),
	orgRow({
		league: 'nfl',
		espn_team_id: '8',
		group_name: 'NFC West',
		conference: 'National Football Conference'
	})
];

const none = { league: 'nfl' as const, orgLeague: null, sub: null, conf: null, div: null, followed: [] };

describe('resolveSportsOrg', () => {
	it('defaults NFL to AFC then AFC East, with short conference labels', () => {
		const org = resolveSportsOrg(nfl, none);
		expect(org.fallback).toBe(false);
		expect(org.conference).toBe('American Football Conference');
		expect(org.division).toBe('AFC East');
		expect(org.selects.map((s) => s.id)).toEqual(['conference', 'division']);
		expect(org.selects[0]?.options.map((o) => o.label)).toEqual(['AFC', 'NFC']);
		expect(org.selects[1]?.options.map((o) => o.value)).toEqual(['AFC East', 'AFC West']);
	});

	it('defaults to a followed team’s conference and division', () => {
		const org = resolveSportsOrg(nfl, {
			...none,
			followed: [{ league: 'nfl', espn_team_id: '8' }]
		});
		expect(org.conference).toBe('National Football Conference');
		expect(org.division).toBe('NFC West');
	});

	it('keeps a valid URL conference over the followed team', () => {
		const org = resolveSportsOrg(nfl, {
			...none,
			conf: 'American Football Conference',
			div: 'AFC West',
			followed: [{ league: 'nfl', espn_team_id: '8' }]
		});
		expect(org.division).toBe('AFC West');
	});

	it('drops a division that is not in the chosen conference', () => {
		const org = resolveSportsOrg(nfl, {
			...none,
			conf: 'American Football Conference',
			div: 'NFC West'
		});
		expect(org.division).toBe('AFC East');
	});

	it('uses one leaf dropdown when conference columns are still empty', () => {
		const rows = [
			orgRow({ league: 'nfl', group_name: 'AFC West' }),
			orgRow({ league: 'nfl', espn_team_id: '2', group_name: 'AFC East' })
		];
		const org = resolveSportsOrg(rows, none);
		expect(org.fallback).toBe(true);
		expect(org.division).toBe('AFC East');
		expect(org.selects.map((s) => s.id)).toEqual(['division']);
	});

	it('nests college football as subdivision then conference, and division only when split', () => {
		const rows = [
			orgRow({
				league: 'college-football',
				espn_team_id: '333',
				group_name: 'Southeastern Conference',
				conference: 'Southeastern Conference',
				subdivision: 'fbs'
			}),
			orgRow({
				league: 'college-football',
				espn_team_id: '1',
				group_name: 'American Conference',
				conference: 'American Conference',
				subdivision: 'fbs'
			}),
			orgRow({
				league: 'college-football',
				espn_team_id: '9',
				group_name: 'Northern Sun - South',
				conference: 'Northern Sun',
				subdivision: 'd2'
			}),
			orgRow({
				league: 'college-football',
				espn_team_id: '10',
				group_name: 'Northern Sun - North',
				conference: 'Northern Sun',
				subdivision: 'd2'
			})
		];
		const fbs = resolveSportsOrg(rows, {
			...none,
			league: 'college-football'
		});
		expect(fbs.subdivision).toBe('fbs');
		expect(fbs.selects.find((s) => s.id === 'subdivision')?.options.map((o) => o.label)).toEqual([
			'FBS',
			'FCS',
			'Division II',
			'Division III',
			'NAIA'
		]);
		expect(fbs.conference).toBe('American Conference');
		expect(fbs.selects.map((s) => s.id)).toEqual(['subdivision', 'conference']);
		expect(fbs.division).toBe('American Conference');

		const north = resolveSportsOrg(rows, {
			...none,
			league: 'college-football',
			sub: 'd2',
			conf: 'Northern Sun'
		});
		expect(north.selects.map((s) => s.id)).toEqual(['subdivision', 'conference', 'division']);
		expect(north.division).toBe('Northern Sun - North');
		expect(standingsInOrg(rows, north).map((r) => r.espn_team_id)).toEqual(['10']);
	});

	it('on All, a followed team picks the league until org= overrides it', () => {
		const rows = [
			...nfl,
			orgRow({
				league: 'mlb',
				espn_team_id: '16',
				group_name: 'National League Central',
				conference: 'National League'
			})
		];
		const fromFollow = resolveSportsOrg(rows, {
			...none,
			league: 'all',
			followed: [{ league: 'mlb', espn_team_id: '16' }]
		});
		expect(fromFollow.league).toBe('mlb');
		expect(fromFollow.selects[0]?.label).toBe('League');
		expect(fromFollow.selects[1]?.options.map((o) => o.label)).toEqual(['NL']);
		expect(fromFollow.division).toBe('National League Central');

		const pinned = resolveSportsOrg(rows, {
			...none,
			league: 'all',
			orgLeague: 'nfl',
			followed: [{ league: 'mlb', espn_team_id: '16' }]
		});
		expect(pinned.league).toBe('nfl');
		expect(pinned.division).toBe('AFC East');
	});
});

describe('filterTeamsForOrg', () => {
	const teams = [
		{
			league: 'nfl' as const,
			espn_team_id: '2',
			display_name: 'Buffalo Bills',
			abbreviation: 'BUF'
		},
		{
			league: 'nfl' as const,
			espn_team_id: '8',
			display_name: 'San Francisco 49ers',
			abbreviation: 'SF'
		},
		{
			league: 'college-football' as const,
			espn_team_id: '99',
			display_name: 'Ouachita Baptist',
			abbreviation: null
		}
	];

	it('narrows to the selected division when the search box is empty', () => {
		const org = resolveSportsOrg(nfl, none);
		expect(filterTeamsForOrg(teams, nfl, org, '').map((t) => t.espn_team_id)).toEqual(['2']);
	});

	it('searches the whole league once the box has text', () => {
		const org = resolveSportsOrg(nfl, none);
		expect(filterTeamsForOrg(teams, nfl, org, 'san').map((t) => t.display_name)).toEqual([
			'San Francisco 49ers'
		]);
	});
});

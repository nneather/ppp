import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runSportsSync, type SyncResult } from '$lib/sports/server/sync';

export type ToggleFollowedResult = {
	kind: 'toggleFollowed';
	success?: boolean;
	message?: string;
	teamId?: string;
	isFollowed?: boolean;
};

export async function toggleFollowedAction(
	supabase: SupabaseClient,
	formData: FormData
): Promise<ToggleFollowedResult | ReturnType<typeof fail>> {
	const teamId = String(formData.get('team_id') ?? '').trim();
	const nextRaw = String(formData.get('is_followed') ?? '').trim();
	if (!teamId) {
		return fail(400, {
			kind: 'toggleFollowed' as const,
			message: 'Missing team.'
		});
	}
	const isFollowed = nextRaw === 'true' || nextRaw === '1' || nextRaw === 'on';

	const { error } = await supabase
		.from('sports_teams')
		.update({ is_followed: isFollowed })
		.eq('id', teamId)
		.is('deleted_at', null);

	if (error) {
		return fail(500, {
			kind: 'toggleFollowed' as const,
			teamId,
			message: error.message
		});
	}

	return {
		kind: 'toggleFollowed',
		success: true,
		teamId,
		isFollowed
	};
}

export type SyncNowResult = {
	kind: 'syncNow';
	success?: boolean;
	message?: string;
	dates?: string;
	leagues?: SyncResult['leagues'];
};

/** Owner-triggered ESPN upsert. Uses the caller's JWT (owner RLS write). */
export async function syncNowAction(supabase: SupabaseClient): Promise<SyncNowResult> {
	const result = await runSportsSync(supabase, { includeStandings: true });
	if (!result.ok) {
		const failed = result.leagues.filter((l) => !l.ok);
		const detail = failed.map((l) => `${l.league}: ${l.error ?? 'failed'}`).join('; ');
		return {
			kind: 'syncNow',
			success: false,
			message: detail || 'Sync failed.',
			dates: result.dates,
			leagues: result.leagues
		};
	}
	const games = result.leagues.reduce((n, l) => n + (l.gamesUpserted ?? 0), 0);
	const teams = result.leagues.reduce((n, l) => n + (l.teamsUpserted ?? 0), 0);
	return {
		kind: 'syncNow',
		success: true,
		message: `Updated ${games} games and ${teams} teams.`,
		dates: result.dates,
		leagues: result.leagues
	};
}

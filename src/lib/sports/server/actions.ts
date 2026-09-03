import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

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

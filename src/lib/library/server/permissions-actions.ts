import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadProfileRole } from '$lib/library/server/people-settings-actions';

export type PermissionsActionKind = 'upsertPermission';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACCESS_LEVELS = new Set(['none', 'read', 'write']);

export async function upsertUserPermissionAction(
	supabase: SupabaseClient,
	ownerUserId: string,
	fd: FormData
) {
	const role = await loadProfileRole(supabase, ownerUserId);
	if (role !== 'owner') {
		return fail(403, {
			kind: 'upsertPermission' as const,
			message: 'Only the workspace owner can change permissions.'
		});
	}

	const user_id = String(fd.get('user_id') ?? '').trim();
	const module = String(fd.get('module') ?? '').trim();
	const access_level = String(fd.get('access_level') ?? '').trim();

	if (!UUID_RE.test(user_id)) {
		return fail(400, {
			kind: 'upsertPermission' as const,
			message: 'Invalid user id.'
		});
	}
	if (!module || module.length > 64) {
		return fail(400, {
			kind: 'upsertPermission' as const,
			message: 'Invalid module.'
		});
	}
	if (!ACCESS_LEVELS.has(access_level)) {
		return fail(400, {
			kind: 'upsertPermission' as const,
			message: 'Access level must be none, read, or write.'
		});
	}

	const { data: target, error: tErr } = await supabase
		.from('profiles')
		.select('id, role')
		.eq('id', user_id)
		.is('deleted_at', null)
		.maybeSingle();
	if (tErr) {
		console.error(tErr);
		return fail(500, {
			kind: 'upsertPermission' as const,
			message: tErr.message ?? 'Could not load target user.'
		});
	}
	if (!target || (target as { role: string }).role !== 'viewer') {
		return fail(400, {
			kind: 'upsertPermission' as const,
			message: 'Permissions can only be set for active viewer accounts.'
		});
	}

	const { error: upErr } = await supabase.from('user_permissions').upsert(
		{
			user_id,
			module,
			access_level
		} as never,
		{ onConflict: 'user_id,module' }
	);
	if (upErr) {
		console.error(upErr);
		return fail(500, {
			kind: 'upsertPermission' as const,
			message: upErr.message ?? 'Could not save permission.'
		});
	}

	return { kind: 'upsertPermission' as const, success: true as const };
}

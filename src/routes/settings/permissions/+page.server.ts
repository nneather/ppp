import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { upsertUserPermissionAction } from '$lib/library/server/permissions-actions';

export const MODULE_SLUGS = ['library', 'invoicing', 'calendar', 'projects'] as const;
export type ModuleSlug = (typeof MODULE_SLUGS)[number];

export type ViewerRow = {
	id: string;
	email: string;
	full_name: string | null;
};

export type PermissionMatrix = Record<string, Record<ModuleSlug, 'none' | 'read' | 'write'>>;

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;

	const { data: profileMe, error: meErr } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.maybeSingle();
	if (meErr) console.error(meErr);
	const isOwner = (profileMe?.role as string | null) === 'owner';
	if (!isOwner) error(403, 'Only the workspace owner can manage permissions.');

	const { data: viewers, error: vErr } = await supabase
		.from('profiles')
		.select('id, email, full_name')
		.eq('role', 'viewer')
		.is('deleted_at', null)
		.order('email', { ascending: true });

	if (vErr) {
		console.error(vErr);
		return {
			viewers: [] as ViewerRow[],
			matrix: {} as PermissionMatrix,
			loadError: 'Could not load viewer accounts.'
		};
	}

	const viewerRows = (viewers ?? []) as ViewerRow[];
	const ids = viewerRows.map((v) => v.id);

	let permRows: { user_id: string; module: string; access_level: string }[] = [];
	if (ids.length > 0) {
		const { data: perms, error: pErr } = await supabase
			.from('user_permissions')
			.select('user_id, module, access_level')
			.in('user_id', ids);
		if (pErr) {
			console.error(pErr);
			return {
				viewers: viewerRows,
				matrix: {} as PermissionMatrix,
				loadError: 'Could not load permissions.'
			};
		}
		permRows = (perms ?? []) as typeof permRows;
	}

	const matrix: PermissionMatrix = {};
	for (const v of viewerRows) {
		matrix[v.id] = {
			library: 'none',
			invoicing: 'none',
			calendar: 'none',
			projects: 'none'
		};
	}
	for (const r of permRows) {
		const mod = r.module as ModuleSlug;
		if (!MODULE_SLUGS.includes(mod)) continue;
		const al = r.access_level;
		if (al !== 'none' && al !== 'read' && al !== 'write') continue;
		if (matrix[r.user_id]) matrix[r.user_id][mod] = al;
	}

	return {
		viewers: viewerRows,
		matrix,
		loadError: null as string | null
	};
};

export const actions: Actions = {
	upsertPermission: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'upsertPermission' as const, message: 'Unauthorized' });
		return upsertUserPermissionAction(locals.supabase, user.id, await request.formData());
	}
};

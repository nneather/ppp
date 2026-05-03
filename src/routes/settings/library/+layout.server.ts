import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { data: profileRow, error: profileErr } = await locals.supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.maybeSingle();
	if (profileErr) console.error(profileErr);
	const isOwner = (profileRow?.role as string | null) === 'owner';

	return { isOwner };
};

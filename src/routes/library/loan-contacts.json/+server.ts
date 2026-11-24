import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchLoanContacts } from '$lib/library/server/loan-loaders';

export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');
	const { data: profile, error: profileError } = await locals.supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.maybeSingle();
	if (profileError) console.error('[loan-contacts]', profileError);
	if (profile?.role !== 'owner') error(403, 'Owner only');
	const hits = await searchLoanContacts(locals.supabase, url.searchParams.get('q') ?? '');
	return json(hits);
};

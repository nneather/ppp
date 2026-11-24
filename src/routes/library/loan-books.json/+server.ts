import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchLoanBooks } from '$lib/library/server/loan-loaders';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');
	const { data: profile, error: profileError } = await locals.supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.maybeSingle();
	if (profileError) console.error('[loan-books]', profileError);
	if (profile?.role !== 'owner') error(403, 'Owner only');
	const exclude = (url.searchParams.get('exclude') ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter((id) => UUID_RE.test(id));
	const hits = await searchLoanBooks(locals.supabase, url.searchParams.get('q') ?? '', exclude);
	return json(hits);
};

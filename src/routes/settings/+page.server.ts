import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;

	const [clientsRes, profileRes, booksRes] = await Promise.all([
		supabase.from('clients').select('id', { count: 'exact', head: true }).is('deleted_at', null),
		supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
		supabase.from('books').select('id', { count: 'exact', head: true }).is('deleted_at', null)
	]);

	if (clientsRes.error) console.error(clientsRes.error);
	if (profileRes.error) console.error(profileRes.error);
	if (booksRes.error) console.error(booksRes.error);

	const role = (profileRes.data?.role as string | null) ?? null;
	const isOwner = role === 'owner';

	return {
		userEmail: user.email ?? '',
		clientCount: clientsRes.error ? (null as number | null) : (clientsRes.count ?? 0),
		bookCount: booksRes.error ? (null as number | null) : (booksRes.count ?? 0),
		isOwner,
		settingsHubError: clientsRes.error ? 'Could not load client count.' : (null as string | null)
	};
};

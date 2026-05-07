import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildLibraryBooksTsv } from '$lib/library/server/books-csv';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { data: profile, error: profileErr } = await locals.supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.maybeSingle();
	if (profileErr) console.error(profileErr);
	if ((profile?.role as string | null) !== 'owner') {
		error(403, 'Owner only');
	}

	const tsv = await buildLibraryBooksTsv(locals.supabase);
	const date = new Date().toISOString().slice(0, 10);
	return new Response(tsv, {
		headers: {
			'Content-Type': 'text/tab-separated-values; charset=utf-8',
			'Content-Disposition': `attachment; filename="library-books-${date}.tsv"`
		}
	});
};

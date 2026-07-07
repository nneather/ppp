import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadBookCitationInputs, loadPeople } from '$lib/library/server/loaders';
import { buildBibliographyDocx } from '$lib/library/server/bibliography-docx';
import { formatBibliographyEntries } from '$lib/library/turabian';

export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const idsParam = url.searchParams.get('ids') ?? '';
	const ids = idsParam
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	if (ids.length === 0) {
		error(400, 'No books selected');
	}

	const people = await loadPeople(locals.supabase);
	const books = await loadBookCitationInputs(locals.supabase, ids, people);
	const entries = formatBibliographyEntries(books);
	if (entries.length === 0) {
		error(400, 'No citable books in selection');
	}

	const buffer = await buildBibliographyDocx(entries);
	const date = new Date().toISOString().slice(0, 10);
	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type':
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Content-Disposition': `attachment; filename="bibliography-${date}.docx"`
		}
	});
};

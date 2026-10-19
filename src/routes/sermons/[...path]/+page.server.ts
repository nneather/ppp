import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Legacy /sermons/* . By book lives at /studies/by-book, not under sermons. */
export const load: PageServerLoad = async ({ url }) => {
	const path = url.pathname;
	if (path === '/sermons/by-book' || path.startsWith('/sermons/by-book/')) {
		const rest = path.slice('/sermons/by-book'.length);
		redirect(308, `/studies/by-book${rest}${url.search}`);
	}
	const rest = path.slice('/sermons'.length);
	redirect(308, `/studies/sermons${rest}${url.search}`);
};

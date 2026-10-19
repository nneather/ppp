import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Legacy /sermons → /studies/sermons. */
export const load: PageServerLoad = async ({ url }) => {
	redirect(308, `/studies/sermons${url.search}`);
};

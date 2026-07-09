import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Legacy path — bookmarks / PWA deep links → top-level /tasks. */
export const load: PageServerLoad = async ({ url }) => {
	redirect(308, `/tasks${url.search}`);
};

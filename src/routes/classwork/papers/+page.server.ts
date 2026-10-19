import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Legacy /classwork/papers → /studies/papers. */
export const load: PageServerLoad = async ({ url }) => {
	redirect(308, `/studies/papers${url.search}`);
};

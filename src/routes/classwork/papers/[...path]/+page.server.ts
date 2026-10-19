import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Legacy /classwork/papers/* → /studies/papers/* . */
export const load: PageServerLoad = async ({ url }) => {
	const rest = url.pathname.slice('/classwork/papers'.length);
	redirect(308, `/studies/papers${rest}${url.search}`);
};

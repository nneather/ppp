import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** List CRUD folded into `/contacts?tab=lists` ([181] / Session 3). */
export const load: PageServerLoad = async ({ url }) => {
	const list = url.searchParams.get('list');
	const qs = new URLSearchParams({ tab: 'lists' });
	if (list) qs.set('list', list);
	redirect(308, `/contacts?${qs.toString()}`);
};

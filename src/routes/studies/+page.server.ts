import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ymdInChicago } from '$lib/invoicing/chicago-date';
import { loadPapers } from '$lib/studies/server/paper-loaders';
import { loadUpcomingSermons } from '$lib/sermons/server/loaders';
import type { PaperStatus } from '$lib/types/classwork';

const ACTIVE: PaperStatus[] = ['researching', 'drafting', 'submitted'];

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;
	const todayYmd = ymdInChicago();
	const [papersRes, sermonsRes] = await Promise.all([
		loadPapers(supabase),
		loadUpcomingSermons(supabase, { todayYmd, limit: 5 })
	]);

	return {
		papers: papersRes.papers.filter((p) => ACTIVE.includes(p.status)).slice(0, 8),
		sermons: sermonsRes.sermons,
		loadError: papersRes.error ?? sermonsRes.error
	};
};

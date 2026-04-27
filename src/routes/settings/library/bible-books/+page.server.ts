import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

type BibleBookRow = {
	id: string;
	name: string;
	testament: 'OT' | 'NT';
	sort_order: number;
};

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { data, error } = await locals.supabase
		.from('bible_books')
		.select('id, name, testament, sort_order')
		.order('sort_order', { ascending: true });

	if (error) console.error(error);

	const rows = (data ?? []).map((r) => {
		const x = r as { id: string; name: string; testament: string; sort_order: number };
		return {
			id: x.id,
			name: x.name,
			testament: (x.testament as 'OT' | 'NT') ?? 'OT',
			sort_order: x.sort_order
		} satisfies BibleBookRow;
	});

	return {
		ot: rows.filter((r) => r.testament === 'OT'),
		nt: rows.filter((r) => r.testament === 'NT')
	};
};

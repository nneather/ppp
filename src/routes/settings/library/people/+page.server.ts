import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { personDisplayShort } from '$lib/library/server/loaders';
import type { PersonRow } from '$lib/types/library';
import { fetchLiveBookIdsByPersonId } from '$lib/library/server/people-settings-book-counts';
import {
	mergePeopleSettingsAction,
	softDeletePersonSettingsAction,
	updatePersonSettingsAction
} from '$lib/library/server/people-settings-actions';

const LIST_CAP = 500;

export type PeopleSettingsListRow = PersonRow & {
	book_count: number;
	display_name: string;
};

export const load: PageServerLoad = async ({ locals, url, depends, parent }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { isOwner } = await parent();

	depends('app:library:people');

	const supabase = locals.supabase;
	const q = (url.searchParams.get('q') ?? '').trim();

	let peopleQuery = supabase
		.from('people')
		.select('id, first_name, middle_name, last_name, suffix, aliases')
		.is('deleted_at', null)
		.order('last_name', { ascending: true })
		.order('first_name', { ascending: true })
		.limit(LIST_CAP + 1);

	if (q.length > 0) {
		peopleQuery = peopleQuery.ilike('last_name', `%${q}%`);
	}

	const { data: peopleRaw, error: peopleErr } = await peopleQuery;
	if (peopleErr) {
		console.error(peopleErr);
		return {
			isOwner,
			people: [] as PeopleSettingsListRow[],
			listTruncated: false,
			q,
			loadError: 'Could not load people.',
			bookCountError: null as string | null
		};
	}

	const raw = (peopleRaw ?? []) as PersonRow[];
	const truncated = raw.length > LIST_CAP;
	const peopleSlice = truncated ? raw.slice(0, LIST_CAP) : raw;

	const ids = peopleSlice.map((p) => p.id);
	const { map: bookCountMap, error: bookCountError } = await fetchLiveBookIdsByPersonId(
		supabase,
		ids
	);

	const people: PeopleSettingsListRow[] = peopleSlice.map((p) => ({
		...p,
		aliases: Array.isArray(p.aliases) ? p.aliases : [],
		book_count: bookCountMap.get(p.id)?.size ?? 0,
		display_name: personDisplayShort(p)
	}));

	return {
		isOwner,
		people,
		listTruncated: truncated,
		q,
		loadError: null as string | null,
		bookCountError
	};
};

export const actions: Actions = {
	updatePerson: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updatePerson' as const, personId: '', message: 'Unauthorized' });
		return updatePersonSettingsAction(locals.supabase, user.id, await request.formData());
	},
	softDeletePerson: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'softDeletePerson' as const, personId: '', message: 'Unauthorized' });
		return softDeletePersonSettingsAction(locals.supabase, user.id, await request.formData());
	},
	mergePeople: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'mergePeople' as const, message: 'Unauthorized' });
		return mergePeopleSettingsAction(locals.supabase, user.id, await request.formData());
	}
};

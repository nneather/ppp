import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { personDisplayShort } from '$lib/library/server/loaders';
import { suggestB14MergePairs } from '$lib/library/server/people-actions';
import { fetchLiveBookIdsByPersonId } from '$lib/library/server/people-settings-book-counts';
import { mergePeopleSettingsAction } from '$lib/library/server/people-settings-actions';
import type { PersonRow } from '$lib/types/library';

const LIST_CAP = 500;

export type MergePersonRow = {
	id: string;
	display_name: string;
	book_count: number;
};

export type MergeSuggestionPair = {
	pairKey: string;
	left: MergePersonRow;
	right: MergePersonRow;
};

export const load: PageServerLoad = async ({ locals, parent, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { isOwner } = await parent();
	if (!isOwner) redirect(303, '/settings/library/people');

	depends('app:library:people');

	const supabase = locals.supabase;

	const { data: peopleRaw, error: peopleErr } = await supabase
		.from('people')
		.select('id, first_name, middle_name, last_name, suffix, aliases')
		.is('deleted_at', null)
		.order('last_name', { ascending: true })
		.order('first_name', { ascending: true })
		.limit(LIST_CAP + 1);

	if (peopleErr) {
		console.error(peopleErr);
		return {
			loadError: 'Could not load people.',
			suggestionPairs: [] as MergeSuggestionPair[],
			allPeople: [] as MergePersonRow[],
			listTruncated: false,
			bookCountError: null as string | null
		};
	}

	const raw = (peopleRaw ?? []) as PersonRow[];
	const truncated = raw.length > LIST_CAP;
	const peopleSlice = truncated ? raw.slice(0, LIST_CAP) : raw;

	const ids = peopleSlice.map((p) => p.id);
	const { map: bookMap, error: bookCountError } = await fetchLiveBookIdsByPersonId(supabase, ids);

	const toMini = (p: PersonRow): MergePersonRow => {
		const row: PersonRow = {
			...p,
			aliases: Array.isArray(p.aliases) ? p.aliases : []
		};
		return {
			id: p.id,
			display_name: personDisplayShort(row),
			book_count: bookMap.get(p.id)?.size ?? 0
		};
	};

	const allPeople: MergePersonRow[] = peopleSlice.map(toMini).sort((a, b) => {
		const c = a.display_name.localeCompare(b.display_name, undefined, { sensitivity: 'base' });
		if (c !== 0) return c;
		return a.id.localeCompare(b.id);
	});

	const pairs = suggestB14MergePairs(peopleSlice);
	const suggestionPairs: MergeSuggestionPair[] = pairs.map(({ pairKey, a, b }) => ({
		pairKey,
		left: toMini(a),
		right: toMini(b)
	}));

	return {
		loadError: null as string | null,
		bookCountError,
		suggestionPairs,
		allPeople,
		listTruncated: truncated
	};
};

export const actions: Actions = {
	mergePeople: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'mergePeople' as const, message: 'Unauthorized' });
		return mergePeopleSettingsAction(locals.supabase, user.id, await request.formData());
	}
};

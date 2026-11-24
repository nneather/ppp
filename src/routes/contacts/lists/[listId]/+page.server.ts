import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { ContactListCandidate } from '$lib/contacts/list-candidates';
import { contactDisplayName } from '$lib/contacts/names';
import {
	loadContactListMembers,
	loadContactLists,
	loadContactsLite,
	loadHouseholdListCandidates,
	loadHouseholds,
	loadHouseholdSheetExtras,
	loadListMembershipMaps
} from '$lib/contacts/server/loaders';
import { ymdInChicago } from '$lib/invoicing/chicago-date';

/**
 * One list's own page. The form actions (confirm address, add/remove members,
 * log cards, household sheet saves) are the /contacts actions, re-exported so
 * every existing component posts to `?/…` unchanged.
 */
export { actions } from '../../+page.server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ locals, params, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	depends('app:contacts:list');
	const supabase = locals.supabase;
	const listId = params.listId;
	if (!UUID_RE.test(listId)) error(404, 'List not found');

	const [profileRes, listsRes, mapsRes, householdsRes, extras, membersRes, contactsLite] =
		await Promise.all([
			supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
			loadContactLists(supabase),
			loadListMembershipMaps(supabase),
			loadHouseholds(supabase),
			loadHouseholdSheetExtras(supabase),
			loadContactListMembers(supabase, listId),
			loadContactsLite(supabase)
		]);

	if ((profileRes.data?.role as string | undefined) !== 'owner') error(403, 'Owner only');
	const list = listsRes.lists.find((l) => l.id === listId);
	if (!list) error(404, 'List not found');

	const onListHouseholdIds = new Set(mapsRes.maps.householdIdsByListId[listId] ?? []);
	const onListContactIds = new Set(mapsRes.maps.contactIdsByListId[listId] ?? []);
	const householdCandidatesRes = await loadHouseholdListCandidates(supabase, {
		listId,
		onListHouseholdIds
	});
	const contactCandidates: ContactListCandidate[] = contactsLite.map((c) => ({
		id: c.id,
		display_name: contactDisplayName(c),
		onList: onListContactIds.has(c.id)
	}));

	return {
		list,
		lists: listsRes.lists,
		members: membersRes.members,
		hiddenRetiredOnlyCount: membersRes.hiddenRetiredOnlyCount,
		householdCandidates: householdCandidatesRes.candidates,
		contactCandidates,
		contactsLite,
		households: householdsRes.households,
		listIdsByHouseholdId: mapsRes.maps.listIdsByHouseholdId,
		childrenByHouseholdId: extras.childrenByHouseholdId,
		gradeChangesByHouseholdId: extras.gradeChangesByHouseholdId,
		todayYmd: ymdInChicago(),
		loadError:
			membersRes.error ??
			householdsRes.error ??
			listsRes.error ??
			mapsRes.error ??
			householdCandidatesRes.error ??
			extras.error ??
			null
	};
};

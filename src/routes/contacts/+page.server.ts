import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ymdInChicago } from '$lib/invoicing/chicago-date';
import {
	addContactListMemberAction,
	addContactListMembersBatchAction,
	cloneContactListAction,
	createContactAction,
	createContactListAction,
	createHouseholdAction,
	createHouseholdChildAction,
	logContactDetailedAction,
	logContactQuickAction,
	logHouseholdTouchAction,
	logListCardsAction,
	skipContactPeriodAction,
	softDeleteContactAction,
	softDeleteContactListAction,
	softDeleteContactListMemberAction,
	softDeleteHouseholdAction,
	softDeleteHouseholdChildAction,
	updateContactAction,
	updateContactCadenceDefaultAction,
	updateContactListAction,
	updateHouseholdAction
} from '$lib/contacts/server/actions';
import {
	loadContactListMembers,
	loadContactLists,
	loadContacts,
	loadContactsDue,
	loadHouseholdListCandidates,
	loadHouseholds,
	loadListMembershipMaps,
	loadPeriodHistory,
	parseContactsListFilters
} from '$lib/contacts/server/loaders';
import { importSheet1AndPotentialInvite } from '$lib/contacts/server/sheet-import-action';
import { applyVCardImportAction } from '$lib/contacts/server/vcard-import-action';
import type { ContactListCandidate } from '$lib/contacts/list-candidates';
import { isGivingGrade, isRelationshipGrade } from '$lib/contacts/names';
import type { HouseholdChildRow, HouseholdGradeChangeRow } from '$lib/types/contacts';

const TABS = ['contacts', 'households', 'lists'] as const;
export type ContactsTab = (typeof TABS)[number];

function parseTab(url: URL): ContactsTab {
	const raw = url.searchParams.get('tab');
	if (raw && (TABS as readonly string[]).includes(raw)) return raw as ContactsTab;
	return 'contacts';
}

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:contacts:list');

	const filters = parseContactsListFilters(url);
	const tab = parseTab(url);
	const todayYmd = ymdInChicago();
	const supabase = locals.supabase;

	const [profileRes, householdsRes, listsRes, membershipMapsRes] = await Promise.all([
		supabase
			.from('profiles')
			.select('role, contact_cadence_days_default')
			.eq('id', user.id)
			.maybeSingle(),
		loadHouseholds(supabase),
		loadContactLists(supabase),
		loadListMembershipMaps(supabase)
	]);

	if (profileRes.error) console.error('[contacts] profile', profileRes.error);
	const role = (profileRes.data?.role as string | null) ?? null;
	const isOwner = role === 'owner';
	const profileCadenceDefault =
		(profileRes.data?.contact_cadence_days_default as number | null | undefined) ?? null;

	const contactsRes = await loadContacts(supabase, {
		filters: tab === 'lists' ? { status: 'all', q: null, listId: null } : filters,
		profileCadenceDefault,
		membershipMaps: membershipMapsRes.maps
	});

	const dueRes = await loadContactsDue(supabase, {
		todayYmd,
		limit: 100
	});
	const historyRes = await loadPeriodHistory(supabase, { todayYmd });

	const selectedParam = url.searchParams.get('list');
	const selectedListId =
		selectedParam && listsRes.lists.some((l) => l.id === selectedParam)
			? selectedParam
			: (listsRes.lists[0]?.id ?? null);

	const onListHouseholdIds = new Set(
		selectedListId
			? (membershipMapsRes.maps.householdIdsByListId[selectedListId] ?? [])
			: []
	);
	const onListContactIds = new Set(
		selectedListId
			? (membershipMapsRes.maps.contactIdsByListId[selectedListId] ?? [])
			: []
	);

	const [membersRes, householdCandidatesRes, childrenRes, gradeChangesRes] = await Promise.all([
		tab === 'lists' && selectedListId
			? loadContactListMembers(supabase, selectedListId)
			: Promise.resolve({
					members: [],
					hiddenRetiredOnlyCount: 0,
					error: null as string | null
				}),
		tab === 'lists' && selectedListId
			? loadHouseholdListCandidates(supabase, {
					listId: selectedListId,
					onListHouseholdIds
				})
			: Promise.resolve({ candidates: [], error: null as string | null }),
		supabase
			.from('household_children')
			.select('id, household_id, first_name, last_name, birthday, notes, sort_order')
			.is('deleted_at', null)
			.order('sort_order', { ascending: true })
			.order('first_name', { ascending: true }),
		supabase
			.from('household_grade_changes')
			.select('id, household_id, changed_on, giving_grade, relationship_grade, note')
			.is('deleted_at', null)
			.order('changed_on', { ascending: false })
	]);

	if (childrenRes.error) console.error('[contacts] household_children', childrenRes.error);
	if (gradeChangesRes.error)
		console.error('[contacts] household_grade_changes', gradeChangesRes.error);

	const childrenByHouseholdId: Record<string, HouseholdChildRow[]> = {};
	for (const raw of childrenRes.data ?? []) {
		const c = raw as HouseholdChildRow;
		const list = childrenByHouseholdId[c.household_id] ?? [];
		list.push(c);
		childrenByHouseholdId[c.household_id] = list;
	}

	const gradeChangesByHouseholdId: Record<string, HouseholdGradeChangeRow[]> = {};
	for (const raw of gradeChangesRes.data ?? []) {
		const r = raw as {
			id: string;
			household_id: string;
			changed_on: string;
			giving_grade: string | null;
			relationship_grade: string | null;
			note: string | null;
		};
		const list = gradeChangesByHouseholdId[r.household_id] ?? [];
		list.push({
			id: r.id,
			household_id: r.household_id,
			changed_on: r.changed_on,
			giving_grade: r.giving_grade && isGivingGrade(r.giving_grade) ? r.giving_grade : null,
			relationship_grade:
				r.relationship_grade && isRelationshipGrade(r.relationship_grade)
					? r.relationship_grade
					: null,
			note: r.note
		});
		gradeChangesByHouseholdId[r.household_id] = list;
	}

	const contactCandidates: ContactListCandidate[] =
		tab === 'lists'
			? contactsRes.contacts.map((c) => ({
					id: c.id,
					display_name: c.display_name,
					onList: onListContactIds.has(c.id)
				}))
			: [];

	return {
		contacts: contactsRes.contacts,
		households: householdsRes.households,
		lists: listsRes.lists,
		selectedListId,
		members: membersRes.members,
		hiddenRetiredOnlyCount: membersRes.hiddenRetiredOnlyCount,
		householdCandidates: householdCandidatesRes.candidates,
		contactCandidates,
		childrenByHouseholdId,
		gradeChangesByHouseholdId,
		listIdsByHouseholdId: membershipMapsRes.maps.listIdsByHouseholdId,
		listIdsByContactId: membershipMapsRes.maps.listIdsByContactId,
		dueContacts: dueRes.contacts,
		duePace: dueRes.pace,
		duePoolSize: dueRes.contacts_with_cadence,
		periodHistory: historyRes.history,
		filters,
		tab,
		todayYmd,
		profileCadenceDefault,
		isOwner,
		loadError:
			contactsRes.error ??
			householdsRes.error ??
			listsRes.error ??
			membersRes.error ??
			membershipMapsRes.error ??
			householdCandidatesRes.error ??
			dueRes.error ??
			historyRes.error ??
			childrenRes.error?.message ??
			gradeChangesRes.error?.message
	};
};

export const actions: Actions = {
	createContact: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createContact' as const, message: 'Unauthorized' });
		return createContactAction(locals.supabase, user.id, await request.formData());
	},
	updateContact: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateContact' as const, message: 'Unauthorized' });
		return updateContactAction(locals.supabase, user.id, await request.formData());
	},
	softDeleteContact: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'softDeleteContact' as const, message: 'Unauthorized' });
		return softDeleteContactAction(locals.supabase, await request.formData());
	},
	createHousehold: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createHousehold' as const, message: 'Unauthorized' });
		return createHouseholdAction(locals.supabase, user.id, await request.formData());
	},
	updateHousehold: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateHousehold' as const, message: 'Unauthorized' });
		return updateHouseholdAction(locals.supabase, user.id, await request.formData());
	},
	softDeleteHousehold: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'softDeleteHousehold' as const, message: 'Unauthorized' });
		return softDeleteHouseholdAction(locals.supabase, await request.formData());
	},
	logContactQuick: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'logContactQuick' as const, message: 'Unauthorized' });
		return logContactQuickAction(locals.supabase, user.id, await request.formData());
	},
	logContactDetailed: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'logContactDetailed' as const, message: 'Unauthorized' });
		return logContactDetailedAction(locals.supabase, user.id, await request.formData());
	},
	logHouseholdTouch: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'logHouseholdTouch' as const, message: 'Unauthorized' });
		return logHouseholdTouchAction(locals.supabase, user.id, await request.formData());
	},
	logListCards: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'logListCards' as const, message: 'Unauthorized' });
		return logListCardsAction(locals.supabase, user.id, await request.formData());
	},
	updateContactCadenceDefault: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, {
				kind: 'updateContactCadenceDefault' as const,
				message: 'Unauthorized'
			});
		return updateContactCadenceDefaultAction(
			locals.supabase,
			user.id,
			await request.formData()
		);
	},
	createContactList: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createContactList' as const, message: 'Unauthorized' });
		return createContactListAction(locals.supabase, user.id, await request.formData());
	},
	updateContactList: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateContactList' as const, message: 'Unauthorized' });
		return updateContactListAction(locals.supabase, await request.formData());
	},
	softDeleteContactList: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'softDeleteContactList' as const, message: 'Unauthorized' });
		return softDeleteContactListAction(locals.supabase, await request.formData());
	},
	addContactListMember: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'addContactListMember' as const, message: 'Unauthorized' });
		return addContactListMemberAction(locals.supabase, user.id, await request.formData());
	},
	addContactListMembersBatch: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, {
				kind: 'addContactListMembersBatch' as const,
				message: 'Unauthorized'
			});
		return addContactListMembersBatchAction(
			locals.supabase,
			user.id,
			await request.formData()
		);
	},
	softDeleteContactListMember: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, {
				kind: 'softDeleteContactListMember' as const,
				message: 'Unauthorized'
			});
		return softDeleteContactListMemberAction(locals.supabase, await request.formData());
	},
	skipContactPeriod: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'skipContactPeriod' as const, message: 'Unauthorized' });
		return skipContactPeriodAction(locals.supabase, user.id, await request.formData());
	},
	cloneContactList: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'cloneContactList' as const, message: 'Unauthorized' });
		return cloneContactListAction(locals.supabase, user.id, await request.formData());
	},
	createHouseholdChild: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'createHouseholdChild' as const, message: 'Unauthorized' });
		return createHouseholdChildAction(locals.supabase, user.id, await request.formData());
	},
	softDeleteHouseholdChild: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, {
				kind: 'softDeleteHouseholdChild' as const,
				message: 'Unauthorized'
			});
		return softDeleteHouseholdChildAction(locals.supabase, await request.formData());
	},
	importSheet: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'importSheet' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		const sheet1 = fd.get('sheet1');
		const pft = fd.get('people_for_things');
		if (!(sheet1 instanceof File) || sheet1.size === 0) {
			return fail(400, {
				kind: 'importSheet' as const,
				message: 'Upload Sheet1 CSV (File → Download → CSV from the Christmas Cards spreadsheet).'
			});
		}
		const sheet1Csv = await sheet1.text();
		const peopleForThingsCsv =
			pft instanceof File && pft.size > 0 ? await pft.text() : null;
		const result = await importSheet1AndPotentialInvite(locals.supabase, user.id, {
			sheet1Csv,
			peopleForThingsCsv
		});
		return { kind: 'importSheet' as const, success: true as const, ...result };
	},
	applyVCardImport: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'applyVCardImport' as const, message: 'Unauthorized' });
		return applyVCardImportAction(locals.supabase, user.id, await request.formData());
	}
};

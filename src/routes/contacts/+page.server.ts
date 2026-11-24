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
	nudgeContactFrequencyAction,
	logHouseholdTouchAction,
	logListCardsAction,
	setHouseholdAddressConfirmedAction,
	skipContactPeriodAction,
	setContactsDefaultSortAction,
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
	loadContactLists,
	loadContacts,
	loadContactsDue,
	loadHouseholds,
	loadHouseholdSheetExtras,
	loadListMembershipMaps,
	loadPeriodHistory,
	parseContactsListFilters
} from '$lib/contacts/server/loaders';
import { importSheet1AndPotentialInvite } from '$lib/contacts/server/sheet-import-action';
import { countOpenLoansByContact } from '$lib/library/server/loan-loaders';
import { applyVCardImportAction } from '$lib/contacts/server/vcard-import-action';
import { resolveContactSort } from '$lib/contacts/sort';

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

	const [profileRes, householdsRes, listsRes, membershipMapsRes, booksOutByContactId] =
		await Promise.all([
			supabase
				.from('profiles')
				.select('role, contact_cadence_days_default, contacts_default_sort')
				.eq('id', user.id)
				.maybeSingle(),
			loadHouseholds(supabase),
			loadContactLists(supabase),
			loadListMembershipMaps(supabase),
			countOpenLoansByContact(supabase)
		]);

	if (profileRes.error) console.error('[contacts] profile', profileRes.error);
	const role = (profileRes.data?.role as string | null) ?? null;
	const isOwner = role === 'owner';
	const profileCadenceDefault =
		(profileRes.data?.contact_cadence_days_default as number | null | undefined) ?? null;
	const resolvedSort = resolveContactSort(url, profileRes.data?.contacts_default_sort);
	filters.sort = resolvedSort.sort;

	// Lists open on their own page now; keep old ?tab=lists&list=… links working.
	const listParam = url.searchParams.get('list');
	if (tab === 'lists' && listParam && listsRes.lists.some((l) => l.id === listParam)) {
		redirect(303, `/contacts/lists/${listParam}`);
	}

	const contactsRes = await loadContacts(supabase, {
		filters: tab === 'lists' ? { ...filters, status: 'all', q: null, listId: null } : filters,
		profileCadenceDefault,
		todayYmd,
		membershipMaps: membershipMapsRes.maps
	});

	const dueRes = await loadContactsDue(supabase, {
		todayYmd,
		limit: 500
	});
	const historyRes = await loadPeriodHistory(supabase, { todayYmd });

	const extras = await loadHouseholdSheetExtras(supabase);

	return {
		contacts: contactsRes.contacts,
		households: householdsRes.households,
		lists: listsRes.lists,
		childrenByHouseholdId: extras.childrenByHouseholdId,
		gradeChangesByHouseholdId: extras.gradeChangesByHouseholdId,
		listIdsByHouseholdId: membershipMapsRes.maps.listIdsByHouseholdId,
		listIdsByContactId: membershipMapsRes.maps.listIdsByContactId,
		dueContacts: dueRes.contacts,
		duePace: dueRes.pace,
		duePoolSize: dueRes.contacts_with_cadence,
		periodHistory: historyRes.history,
		filters,
		defaultSort: resolvedSort.defaultSort,
		tab,
		todayYmd,
		profileCadenceDefault,
		isOwner,
		booksOutByContactId,
		loadError:
			contactsRes.error ??
			householdsRes.error ??
			listsRes.error ??
			membershipMapsRes.error ??
			dueRes.error ??
			historyRes.error ??
			extras.error
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
		if (!user) return fail(401, { kind: 'softDeleteHousehold' as const, message: 'Unauthorized' });
		return softDeleteHouseholdAction(locals.supabase, await request.formData());
	},
	logContactQuick: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'logContactQuick' as const, message: 'Unauthorized' });
		return logContactQuickAction(locals.supabase, user.id, await request.formData());
	},
	logContactDetailed: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'logContactDetailed' as const, message: 'Unauthorized' });
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
	setHouseholdAddressConfirmed: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'setHouseholdAddressConfirmed' as const, message: 'Unauthorized' });
		return setHouseholdAddressConfirmedAction(locals.supabase, await request.formData());
	},
	setContactsDefaultSort: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'setContactsDefaultSort' as const, message: 'Unauthorized' });
		return setContactsDefaultSortAction(locals.supabase, user.id, await request.formData());
	},
	updateContactCadenceDefault: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, {
				kind: 'updateContactCadenceDefault' as const,
				message: 'Unauthorized'
			});
		return updateContactCadenceDefaultAction(locals.supabase, user.id, await request.formData());
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
		if (!user) return fail(401, { kind: 'addContactListMember' as const, message: 'Unauthorized' });
		return addContactListMemberAction(locals.supabase, user.id, await request.formData());
	},
	addContactListMembersBatch: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, {
				kind: 'addContactListMembersBatch' as const,
				message: 'Unauthorized'
			});
		return addContactListMembersBatchAction(locals.supabase, user.id, await request.formData());
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
		if (!user) return fail(401, { kind: 'skipContactPeriod' as const, message: 'Unauthorized' });
		return skipContactPeriodAction(locals.supabase, user.id, await request.formData());
	},
	nudgeContactFrequency: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'nudgeContactFrequency' as const, message: 'Unauthorized' });
		return nudgeContactFrequencyAction(locals.supabase, await request.formData());
	},
	cloneContactList: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'cloneContactList' as const, message: 'Unauthorized' });
		return cloneContactListAction(locals.supabase, user.id, await request.formData());
	},
	createHouseholdChild: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createHouseholdChild' as const, message: 'Unauthorized' });
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
		const peopleForThingsCsv = pft instanceof File && pft.size > 0 ? await pft.text() : null;
		const result = await importSheet1AndPotentialInvite(locals.supabase, user.id, {
			sheet1Csv,
			peopleForThingsCsv
		});
		return { kind: 'importSheet' as const, success: true as const, ...result };
	},
	applyVCardImport: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'applyVCardImport' as const, message: 'Unauthorized' });
		return applyVCardImportAction(locals.supabase, user.id, await request.formData());
	}
};

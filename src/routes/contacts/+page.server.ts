import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ymdInChicago } from '$lib/invoicing/chicago-date';
import {
	addContactListMemberAction,
	createContactAction,
	createContactListAction,
	createHouseholdAction,
	logContactDetailedAction,
	logContactQuickAction,
	logHouseholdTouchAction,
	logListCardsAction,
	softDeleteContactAction,
	softDeleteContactListAction,
	softDeleteContactListMemberAction,
	softDeleteHouseholdAction,
	updateContactAction,
	updateContactCadenceDefaultAction,
	updateContactListAction,
	updateHouseholdAction
} from '$lib/contacts/server/actions';
import {
	loadContactListMembers,
	loadContactLists,
	loadContacts,
	loadHouseholds,
	parseContactsListFilters
} from '$lib/contacts/server/loaders';

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

	const [profileRes, householdsRes, listsRes] = await Promise.all([
		supabase
			.from('profiles')
			.select('role, contact_cadence_days_default')
			.eq('id', user.id)
			.maybeSingle(),
		loadHouseholds(supabase),
		loadContactLists(supabase)
	]);

	if (profileRes.error) console.error('[contacts] profile', profileRes.error);
	const role = (profileRes.data?.role as string | null) ?? null;
	const isOwner = role === 'owner';
	const profileCadenceDefault =
		(profileRes.data?.contact_cadence_days_default as number | null | undefined) ?? null;

	const contactsRes = await loadContacts(supabase, {
		filters: tab === 'lists' ? { status: 'all', q: null } : filters,
		profileCadenceDefault
	});

	const selectedParam = url.searchParams.get('list');
	const selectedListId =
		selectedParam && listsRes.lists.some((l) => l.id === selectedParam)
			? selectedParam
			: (listsRes.lists[0]?.id ?? null);

	const membersRes =
		tab === 'lists' && selectedListId
			? await loadContactListMembers(supabase, selectedListId)
			: { members: [], hiddenRetiredOnlyCount: 0, error: null as string | null };

	return {
		contacts: contactsRes.contacts,
		households: householdsRes.households,
		lists: listsRes.lists,
		selectedListId,
		members: membersRes.members,
		hiddenRetiredOnlyCount: membersRes.hiddenRetiredOnlyCount,
		filters,
		tab,
		todayYmd,
		profileCadenceDefault,
		isOwner,
		loadError:
			contactsRes.error ??
			householdsRes.error ??
			listsRes.error ??
			membersRes.error
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
		return updateHouseholdAction(locals.supabase, await request.formData());
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
	softDeleteContactListMember: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, {
				kind: 'softDeleteContactListMember' as const,
				message: 'Unauthorized'
			});
		return softDeleteContactListMemberAction(locals.supabase, await request.formData());
	}
};

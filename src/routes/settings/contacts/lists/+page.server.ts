import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addContactListMemberAction,
	createContactListAction,
	softDeleteContactListAction,
	softDeleteContactListMemberAction,
	updateContactListAction
} from '$lib/contacts/server/actions';
import {
	loadContactListMembers,
	loadContactLists,
	loadContacts,
	loadHouseholds,
	parseContactsListFilters
} from '$lib/contacts/server/loaders';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:contacts:lists');

	const supabase = locals.supabase;
	const { data: profile, error: profileErr } = await supabase
		.from('profiles')
		.select('role, contact_cadence_days_default')
		.eq('id', user.id)
		.maybeSingle();

	if (profileErr) console.error('[contacts lists] profile', profileErr);
	const isOwner = profile?.role === 'owner';
	if (!isOwner) {
		return {
			notOwner: true as const,
			lists: [],
			selectedListId: null as string | null,
			members: [],
			contacts: [],
			households: [],
			loadError: null as string | null
		};
	}

	const listsRes = await loadContactLists(supabase);
	const selectedParam = url.searchParams.get('list');
	const selectedListId =
		selectedParam && listsRes.lists.some((l) => l.id === selectedParam)
			? selectedParam
			: (listsRes.lists[0]?.id ?? null);

	const [membersRes, contactsRes, householdsRes] = await Promise.all([
		selectedListId
			? loadContactListMembers(supabase, selectedListId)
			: Promise.resolve({ members: [], error: null as string | null }),
		loadContacts(supabase, {
			filters: parseContactsListFilters(new URL('http://x/?status=all')),
			profileCadenceDefault:
				(profile?.contact_cadence_days_default as number | null | undefined) ?? null
		}),
		loadHouseholds(supabase)
	]);

	return {
		notOwner: false as const,
		lists: listsRes.lists,
		selectedListId,
		members: membersRes.members,
		contacts: contactsRes.contacts,
		households: householdsRes.households,
		loadError:
			listsRes.error ?? membersRes.error ?? contactsRes.error ?? householdsRes.error
	};
};

export const actions: Actions = {
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

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ymdInChicago } from '$lib/invoicing/chicago-date';
import {
	createContactAction,
	createHouseholdAction,
	logContactDetailedAction,
	logContactQuickAction,
	logHouseholdTouchAction,
	softDeleteContactAction,
	softDeleteHouseholdAction,
	updateContactAction,
	updateHouseholdAction
} from '$lib/contacts/server/actions';
import {
	loadContacts,
	loadHouseholds,
	parseContactsListFilters
} from '$lib/contacts/server/loaders';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:contacts:list');

	const filters = parseContactsListFilters(url);
	const todayYmd = ymdInChicago();
	const supabase = locals.supabase;

	const [profileRes, householdsRes] = await Promise.all([
		supabase
			.from('profiles')
			.select('role, contact_cadence_days_default')
			.eq('id', user.id)
			.maybeSingle(),
		loadHouseholds(supabase)
	]);

	if (profileRes.error) console.error('[contacts] profile', profileRes.error);
	const role = (profileRes.data?.role as string | null) ?? null;
	const isOwner = role === 'owner';
	const profileCadenceDefault =
		(profileRes.data?.contact_cadence_days_default as number | null | undefined) ?? null;

	const contactsRes = await loadContacts(supabase, {
		filters,
		profileCadenceDefault
	});

	return {
		contacts: contactsRes.contacts,
		households: householdsRes.households,
		filters,
		todayYmd,
		profileCadenceDefault,
		isOwner,
		loadError: contactsRes.error ?? householdsRes.error
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
	}
};

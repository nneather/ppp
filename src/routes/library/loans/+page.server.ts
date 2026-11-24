import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	checkoutBookAction,
	retryLoanMessageAction,
	returnBookAction,
	updateLoanDueAction,
	updateLoanEmailAction,
	updateLoanReminderAction
} from '$lib/library/server/loan-actions';
import { loadOpenLoans } from '$lib/library/server/loan-loaders';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	const { data: profile } = await locals.supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.maybeSingle();
	const isOwner = profile?.role === 'owner';
	const contactId = url.searchParams.get('contact');
	const loans = await loadOpenLoans(locals.supabase, {
		contactId: contactId && UUID_RE.test(contactId) ? contactId : undefined,
		includePrivate: isOwner
	});
	return { loans, isOwner };
};

export const actions: Actions = {
	checkoutBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'checkoutBook' as const, message: 'Unauthorized' });
		return checkoutBookAction(locals.supabase, user.id, await request.formData());
	},
	returnBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'returnBook' as const, message: 'Unauthorized' });
		return returnBookAction(locals.supabase, user.id, await request.formData());
	},
	updateLoanReminder: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateLoanReminder' as const, message: 'Unauthorized' });
		return updateLoanReminderAction(locals.supabase, user.id, await request.formData());
	},
	updateLoanDue: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateLoanDue' as const, message: 'Unauthorized' });
		return updateLoanDueAction(locals.supabase, user.id, await request.formData());
	},
	updateLoanEmail: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateLoanEmail' as const, message: 'Unauthorized' });
		return updateLoanEmailAction(locals.supabase, user.id, await request.formData());
	},
	retryLoanMessage: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'retryLoanMessage' as const, message: 'Unauthorized' });
		return retryLoanMessageAction(locals.supabase, user.id, await request.formData());
	}
};

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addDaysYmd, ymdInChicago } from '$lib/invoicing/chicago-date';
import { DEFAULT_LOAN_DUE_DAYS } from '$lib/email/variables';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');
	const { data: profile, error: profileError } = await locals.supabase
		.from('profiles')
		.select('role, loan_due_days')
		.eq('id', user.id)
		.maybeSingle();
	if (profileError) console.error('[loan-defaults]', profileError);
	if (profile?.role !== 'owner') error(403, 'Owner only');
	const days = profile?.loan_due_days ?? DEFAULT_LOAN_DUE_DAYS;
	const dueOn = addDaysYmd(ymdInChicago(), days) ?? ymdInChicago();
	return json({ dueOn, dueDays: days });
};

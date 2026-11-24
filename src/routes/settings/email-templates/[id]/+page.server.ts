import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { saveEmailTemplateAction } from '$lib/email/server/template-actions';
import { buildLoanMergeValues } from '$lib/library/server/loan-actions';
import { loadOpenLoans } from '$lib/library/server/loan-loaders';
import { emailUseLabel } from '$lib/email/variables';
import { ymdInChicago } from '$lib/invoicing/chicago-date';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ locals, params }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	if (!UUID_RE.test(params.id)) error(404, 'Template not found.');
	const supabase = locals.supabase;
	const { data: profile } = await supabase
		.from('profiles')
		.select('role, full_name')
		.eq('id', user.id)
		.maybeSingle();
	if (profile?.role !== 'owner') return { notOwner: true as const };

	const [templateRes, foldersRes, bindingsRes, loans] = await Promise.all([
		supabase
			.from('email_templates')
			.select('id, name, subject, html_body, folder_id')
			.eq('id', params.id)
			.is('deleted_at', null)
			.maybeSingle(),
		supabase.from('email_template_folders').select('id, name').is('deleted_at', null).order('name'),
		supabase.from('email_template_bindings').select('binding_key, template_id').is('deleted_at', null),
		loadOpenLoans(supabase, { includePrivate: true })
	]);
	if (!templateRes.data) error(404, 'Template not found.');
	const today = ymdInChicago();
	const byContact = new Map<string, typeof loans>();
	for (const loan of loans) {
		const group = byContact.get(loan.contactId) ?? [];
		group.push(loan);
		byContact.set(loan.contactId, group);
	}
	const previews = [...byContact.values()].slice(0, 12).map((group) => {
		const lead = group[0];
		if (!lead) return null;
		const [first, ...rest] = lead.recipientName.split(' ');
		const label =
			group.length === 1
				? `${lead.bookTitle ?? 'Book'} · ${lead.recipientName}`
				: `${lead.recipientName} · ${group.length} books`;
		return {
			id: lead.contactId,
			label,
			values: buildLoanMergeValues({
				firstName: first ?? '',
				lastName: rest.join(' '),
				books: group.map((loan) => ({
					title: loan.bookTitle ?? '',
					authors: loan.bookAuthors,
					checkedOutOn: loan.checkedOutOn,
					dueOn: loan.dueOn
				})),
				asOfYmd: lead.reminder?.scheduledFor ?? today,
				ownerFullName: profile.full_name
			})
		};
	}).filter((row) => row != null);
	const bound = new Set(
		(bindingsRes.data ?? []).filter((b) => b.template_id === params.id).map((b) => b.binding_key)
	);
	return {
		notOwner: false as const,
		template: templateRes.data,
		folders: foldersRes.data ?? [],
		uses: [...bound].map((key) => emailUseLabel(key)),
		previews,
		ownerFullName: profile.full_name
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'saveEmailTemplate' as const, message: 'Unauthorized' });
		return saveEmailTemplateAction(locals.supabase, user.id, await request.formData());
	}
};

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	assignEmailTemplateUseAction,
	createEmailFolderAction,
	createEmailTemplateAction,
	softDeleteEmailTemplateAction
} from '$lib/email/server/template-actions';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	const supabase = locals.supabase;
	const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
	const isOwner = profile?.role === 'owner';
	if (!isOwner) return { notOwner: true as const, folders: [], templates: [], bindings: [] };

	const [foldersRes, templatesRes, bindingsRes] = await Promise.all([
		supabase
			.from('email_template_folders')
			.select('id, name, sort_order')
			.is('deleted_at', null)
			.order('sort_order')
			.order('name'),
		supabase
			.from('email_templates')
			.select('id, name, subject, folder_id, is_active')
			.is('deleted_at', null)
			.order('name'),
		supabase.from('email_template_bindings').select('binding_key, template_id').is('deleted_at', null)
	]);
	if (foldersRes.error) console.error(foldersRes.error);
	if (templatesRes.error) console.error(templatesRes.error);
	if (bindingsRes.error) console.error(bindingsRes.error);
	return {
		notOwner: false as const,
		folders: foldersRes.data ?? [],
		templates: templatesRes.data ?? [],
		bindings: bindingsRes.data ?? []
	};
};

export const actions: Actions = {
	createFolder: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createEmailFolder' as const, message: 'Unauthorized' });
		return createEmailFolderAction(locals.supabase, user.id, await request.formData());
	},
	createTemplate: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createEmailTemplate' as const, message: 'Unauthorized' });
		const result = await createEmailTemplateAction(locals.supabase, user.id, await request.formData());
		if (result && 'templateId' in result && result.success) {
			redirect(303, `/settings/email-templates/${result.templateId}`);
		}
		return result;
	},
	assignUse: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'assignEmailTemplateUse' as const, message: 'Unauthorized' });
		return assignEmailTemplateUseAction(locals.supabase, user.id, await request.formData());
	},
	deleteTemplate: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'softDeleteEmailTemplate' as const, message: 'Unauthorized' });
		return softDeleteEmailTemplateAction(locals.supabase, user.id, await request.formData());
	}
};

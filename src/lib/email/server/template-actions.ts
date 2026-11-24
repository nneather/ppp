import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeEmailHtml } from '$lib/email/sanitize';
import { EMAIL_TEMPLATE_USES, emailUseLabel, unknownEmailTokens } from '$lib/email/variables';
import type { Database } from '$lib/types/database';

type Db = SupabaseClient<Database>;

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireOwner(supabase: Db, userId: string): Promise<boolean> {
	const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
	if (error) console.error('[email-templates] role', error);
	return data?.role === 'owner';
}

function trim(fd: FormData, key: string): string {
	return String(fd.get(key) ?? '').trim();
}

export async function createEmailFolderAction(supabase: Db, userId: string, fd: FormData) {
	const kind = 'createEmailFolder' as const;
	if (!(await requireOwner(supabase, userId))) {
		return fail(403, { kind, message: 'Only the owner can edit templates.' });
	}
	const name = trim(fd, 'name');
	if (!name) return fail(400, { kind, message: 'Folder name is required.' });
	const { error } = await supabase.from('email_template_folders').insert({ name, created_by: userId });
	if (error) {
		console.error('[email-templates] folder', error);
		return fail(500, { kind, message: 'Could not create the folder.' });
	}
	return { kind, success: true as const };
}

export async function createEmailTemplateAction(supabase: Db, userId: string, fd: FormData) {
	const kind = 'createEmailTemplate' as const;
	if (!(await requireOwner(supabase, userId))) {
		return fail(403, { kind, message: 'Only the owner can edit templates.' });
	}
	const name = trim(fd, 'name');
	const folderId = trim(fd, 'folder_id');
	if (!name) return fail(400, { kind, message: 'Template name is required.' });
	if (folderId && !UUID_RE.test(folderId)) return fail(400, { kind, message: 'Pick a folder.' });
	const { data, error } = await supabase
		.from('email_templates')
		.insert({
			name,
			folder_id: folderId || null,
			subject: '',
			html_body: '<p></p>',
			created_by: userId
		})
		.select('id')
		.single();
	if (error || !data) {
		console.error('[email-templates] create', error);
		return fail(500, { kind, message: 'Could not create the template.' });
	}
	return { kind, success: true as const, templateId: data.id };
}

export async function saveEmailTemplateAction(supabase: Db, userId: string, fd: FormData) {
	const kind = 'saveEmailTemplate' as const;
	if (!(await requireOwner(supabase, userId))) {
		return fail(403, { kind, message: 'Only the owner can edit templates.' });
	}
	const id = trim(fd, 'id');
	const name = trim(fd, 'name');
	const subject = trim(fd, 'subject');
	const folderId = trim(fd, 'folder_id');
	const html = sanitizeEmailHtml(String(fd.get('html_body') ?? ''));
	if (!UUID_RE.test(id)) return fail(400, { kind, message: 'Template not found.' });
	if (!name) return fail(400, { kind, message: 'Template name is required.' });
	const unknown = unknownEmailTokens(subject, html);
	if (unknown.length > 0) {
		return fail(400, { kind, message: `Unknown merge field: ${unknown.join(', ')}` });
	}
	const { error } = await supabase
		.from('email_templates')
		.update({
			name,
			subject,
			html_body: html,
			folder_id: folderId && UUID_RE.test(folderId) ? folderId : null
		})
		.eq('id', id)
		.is('deleted_at', null);
	if (error) {
		console.error('[email-templates] save', error);
		return fail(500, { kind, message: 'Could not save the template.' });
	}

	return { kind, success: true as const, templateId: id };
}

export async function assignEmailTemplateUseAction(supabase: Db, userId: string, fd: FormData) {
	const kind = 'assignEmailTemplateUse' as const;
	if (!(await requireOwner(supabase, userId))) {
		return fail(403, { kind, message: 'Only the owner can edit templates.' });
	}
	const key = trim(fd, 'binding_key');
	const templateId = trim(fd, 'template_id');
	if (!EMAIL_TEMPLATE_USES.some((use) => use.key === key)) {
		return fail(400, { kind, message: 'That email use is not in the catalog.' });
	}
	if (!UUID_RE.test(templateId)) return fail(400, { kind, message: 'Pick a template.' });
	const { data: template, error } = await supabase
		.from('email_templates')
		.select('id')
		.eq('id', templateId)
		.is('deleted_at', null)
		.maybeSingle();
	if (error || !template) return fail(400, { kind, message: 'That template is gone.' });
	await moveBinding(supabase, key, templateId, userId);
	return { kind, success: true as const };
}

async function moveBinding(supabase: Db, key: string, templateId: string, userId: string) {
	const { data, error } = await supabase
		.from('email_template_bindings')
		.update({ template_id: templateId })
		.eq('binding_key', key)
		.is('deleted_at', null)
		.select('id');
	if (error) {
		console.error('[email-templates] binding', error);
		return;
	}
	if ((data ?? []).length > 0) return;
	const { error: insertError } = await supabase.from('email_template_bindings').insert({
		binding_key: key,
		template_id: templateId,
		created_by: userId
	});
	if (insertError) console.error('[email-templates] binding insert', insertError);
}

export async function softDeleteEmailTemplateAction(supabase: Db, userId: string, fd: FormData) {
	const kind = 'softDeleteEmailTemplate' as const;
	if (!(await requireOwner(supabase, userId))) {
		return fail(403, { kind, message: 'Only the owner can edit templates.' });
	}
	const id = trim(fd, 'id');
	if (!UUID_RE.test(id)) return fail(400, { kind, message: 'Template not found.' });
	const { data: bindings } = await supabase
		.from('email_template_bindings')
		.select('binding_key')
		.eq('template_id', id)
		.is('deleted_at', null);
	if ((bindings ?? []).length > 0) {
		const labels = (bindings ?? []).map((row) => emailUseLabel(row.binding_key));
		return fail(400, {
			kind,
			message: `This template is used for ${labels.join(', ')}. Point that use at another template first.`
		});
	}
	const { error } = await supabase
		.from('email_templates')
		.update({ deleted_at: new Date().toISOString() })
		.eq('id', id)
		.is('deleted_at', null);
	if (error) {
		console.error('[email-templates] delete', error);
		return fail(500, { kind, message: 'Could not delete the template.' });
	}
	return { kind, success: true as const, templateId: id };
}

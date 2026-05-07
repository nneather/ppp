import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { applyPreparedLibraryCsv, prepareLibraryCsvImport } from '$lib/library/server/books-csv';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	const { isOwner } = await parent();
	if (!isOwner) redirect(303, '/settings/library');
	return {};
};

export const actions = {
	previewLibraryCsv: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'previewLibraryCsv' as const, message: 'Unauthorized' });

		const fd = await request.formData();
		const file = fd.get('csv_file');
		if (!file || !(file instanceof File)) {
			return fail(400, {
				kind: 'previewLibraryCsv' as const,
				message: 'Choose a CSV file to preview.'
			});
		}
		const text = await file.text();
		const prep = await prepareLibraryCsvImport(locals.supabase, text);
		if (!prep.ok) {
			return {
				kind: 'previewLibraryCsv' as const,
				success: false as const,
				errors: prep.errors
			};
		}
		const inserts = prep.prepared.filter((p) => p.kind === 'insert').length;
		const updates = prep.prepared.filter((p) => p.kind === 'update').length;
		const deletes = prep.prepared.filter((p) => p.kind === 'softDelete').length;
		return {
			kind: 'previewLibraryCsv' as const,
			success: true as const,
			inserts,
			updates,
			deletes,
			total: prep.prepared.length
		};
	},

	applyLibraryCsv: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'applyLibraryCsv' as const, message: 'Unauthorized' });

		const fd = await request.formData();
		if (fd.get('confirmed') !== 'true') {
			return fail(400, {
				kind: 'applyLibraryCsv' as const,
				message: 'Confirmation is required to apply the import.'
			});
		}
		const file = fd.get('csv_file');
		if (!file || !(file instanceof File)) {
			return fail(400, {
				kind: 'applyLibraryCsv' as const,
				message: 'Choose the same CSV file again to apply.'
			});
		}
		const text = await file.text();
		const prep = await prepareLibraryCsvImport(locals.supabase, text);
		if (!prep.ok) {
			return fail(400, {
				kind: 'applyLibraryCsv' as const,
				message: 'Import no longer validates — fix the CSV and preview again.',
				errors: prep.errors
			});
		}
		const summary = await applyPreparedLibraryCsv(locals.supabase, user.id, prep.prepared);
		if (summary.errors.length > 0) {
			return fail(500, {
				kind: 'applyLibraryCsv' as const,
				message: summary.errors[0]?.message ?? 'Import stopped after an error.',
				inserted: summary.inserted,
				updated: summary.updated,
				deleted: summary.deleted,
				errors: summary.errors
			});
		}
		return {
			kind: 'applyLibraryCsv' as const,
			success: true as const,
			inserted: summary.inserted,
			updated: summary.updated,
			deleted: summary.deleted
		};
	}
} satisfies Actions;

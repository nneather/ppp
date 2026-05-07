import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prepareLibraryBooksImport } from '$lib/library/server/books-csv';

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
				message: 'Choose a TSV or CSV file to preview.'
			});
		}
		const text = await file.text();
		const prep = await prepareLibraryBooksImport(locals.supabase, text, { filename: file.name });
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
			format: prep.format,
			inserts,
			updates,
			deletes,
			total: prep.prepared.length
		};
	}
} satisfies Actions;

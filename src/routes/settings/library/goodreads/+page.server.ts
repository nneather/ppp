import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	applyGoodreadsRatingsImport,
	previewGoodreadsRatingsImport
} from '$lib/library/server/goodreads-import';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	const { isOwner } = await parent();
	if (!isOwner) redirect(303, '/settings/library');
	return {};
};

function readOpts(fd: FormData) {
	return {
		overwriteExisting: String(fd.get('overwrite_existing') ?? '') === 'true',
		fillEmptyNotes: String(fd.get('fill_empty_notes') ?? '') === 'true'
	};
}

export const actions = {
	previewGoodreads: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'previewGoodreads' as const, message: 'Unauthorized' });

		const fd = await request.formData();
		const file = fd.get('csv_file');
		if (!file || !(file instanceof File)) {
			return fail(400, {
				kind: 'previewGoodreads' as const,
				message: 'Choose a Goodreads export CSV to preview.'
			});
		}
		const text = await file.text();
		const opts = readOpts(fd);
		try {
			const result = await previewGoodreadsRatingsImport(locals.supabase, text, opts);
			if (!result.ok) {
				return fail(400, { kind: 'previewGoodreads' as const, message: result.message });
			}
			const unmatchedSample = result.summary.unmatched.slice(0, 15).map((r) => ({
				line: r.gr.line,
				title: r.gr.title,
				author: r.gr.author,
				rating: r.gr.myRating,
				isbn: r.gr.isbn
			}));
			return {
				kind: 'previewGoodreads' as const,
				success: true as const,
				rowCount: result.rowCount,
				applyCount: result.summary.apply.length,
				skipExisting: result.summary.skipExisting.length,
				unmatched: result.summary.unmatched.length,
				unrated: result.summary.unrated,
				unmatchedSample,
				overwriteExisting: opts.overwriteExisting,
				fillEmptyNotes: opts.fillEmptyNotes
			};
		} catch (e) {
			console.error(e);
			return fail(500, {
				kind: 'previewGoodreads' as const,
				message: e instanceof Error ? e.message : 'Preview failed.'
			});
		}
	},
	applyGoodreads: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'applyGoodreads' as const, message: 'Unauthorized' });

		const fd = await request.formData();
		const file = fd.get('csv_file');
		if (!file || !(file instanceof File)) {
			return fail(400, {
				kind: 'applyGoodreads' as const,
				message: 'Choose a Goodreads export CSV to apply.'
			});
		}
		const text = await file.text();
		const opts = readOpts(fd);
		try {
			const result = await applyGoodreadsRatingsImport(locals.supabase, text, opts);
			if (!result.ok) {
				return fail(400, { kind: 'applyGoodreads' as const, message: result.message });
			}
			return {
				kind: 'applyGoodreads' as const,
				success: true as const,
				updated: result.updated,
				skippedExisting: result.skippedExisting,
				unmatched: result.unmatched,
				unrated: result.unrated
			};
		} catch (e) {
			console.error(e);
			return fail(500, {
				kind: 'applyGoodreads' as const,
				message: e instanceof Error ? e.message : 'Apply failed.'
			});
		}
	}
} satisfies Actions;

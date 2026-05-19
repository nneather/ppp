import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	loadAncientCoverageForBook,
	loadBibleCoverageForBook,
	loadBookDetail,
	loadBookTopicsForBook,
	loadScriptureRefsForBook
} from '$lib/library/server/loaders';
import {
	softDeleteBookAction,
	undoSoftDeleteBookAction,
	updateReadingStatusAction
} from '$lib/library/server/book-actions';
import {
	createScriptureRefAction,
	createScriptureRefsBatchAction,
	softDeleteScriptureRefAction,
	updateScriptureRefAction
} from '$lib/library/server/scripture-actions';
import { invokeOcrScriptureRefs } from '$lib/library/ocr-invoke-client';
import {
	createBookTopicsBatchAction,
	softDeleteBookTopicAction,
	updateBookTopicAction
} from '$lib/library/server/topic-actions';
import {
	createAncientCoverageAction,
	createAncientTextAction,
	createBibleCoverageAction,
	softDeleteAncientCoverageAction,
	softDeleteBibleCoverageAction
} from '$lib/library/server/coverage-actions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Extended duration when the server-action OCR path is used (browser invoke is preferred). */
export const config = { maxDuration: 300 };

export const load: PageServerLoad = async ({ params, locals, depends, parent }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { id } = params;
	if (!UUID_RE.test(id)) error(404, 'Book not found.');

	depends(`app:library:book:${id}`);
	depends('app:library:ancient_texts');

	const supabase = locals.supabase;
	const { people, series, bibleBookNames } = await parent();

	const [book, scriptureRefs, profileRow] = await Promise.all([
		loadBookDetail(supabase, id, people),
		loadScriptureRefsForBook(supabase, id),
		supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
	]);

	if (!book) error(404, 'Book not found.');

	const isOwner =
		((profileRow.data as { role?: string | null } | null)?.role ?? null) === 'owner';

	return {
		book,
		people,
		series,
		bibleBookNames,
		scriptureRefs,
		isOwner,
		userId: user.id,
		bookTopicsPromise: loadBookTopicsForBook(supabase, id),
		bibleCoveragePromise: loadBibleCoverageForBook(supabase, id),
		ancientCoveragePromise: loadAncientCoverageForBook(supabase, id)
	};
};

export const actions: Actions = {
	softDeleteBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'softDeleteBook' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		const result = await softDeleteBookAction(locals.supabase, fd);
		if (result && 'success' in result && result.success && id) {
			redirect(303, `/library?deleted=${encodeURIComponent(id)}`);
		}
		return result;
	},
	undoSoftDeleteBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'undoSoftDeleteBook' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return undoSoftDeleteBookAction(locals.supabase, fd);
	},
	updateReadingStatus: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'updateReadingStatus' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return updateReadingStatusAction(locals.supabase, fd);
	},
	createScriptureRef: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'createScriptureRef' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return createScriptureRefAction(locals.supabase, user.id, fd);
	},
	createScriptureRefsBatch: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, {
				kind: 'createScriptureRefsBatch' as const,
				message: 'Unauthorized'
			});
		const fd = await request.formData();
		return createScriptureRefsBatchAction(locals.supabase, user.id, fd);
	},
	updateScriptureRef: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'updateScriptureRef' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return updateScriptureRefAction(locals.supabase, fd);
	},
	softDeleteScriptureRef: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'softDeleteScriptureRef' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return softDeleteScriptureRefAction(locals.supabase, fd);
	},
	extractScriptureRefs: async ({ request, locals, params }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(401, { kind: 'extractScriptureRefs' as const, message: 'Unauthorized' });
		}
		const bookId = params.id;
		if (!UUID_RE.test(bookId)) {
			return fail(400, { kind: 'extractScriptureRefs' as const, message: 'Invalid book.' });
		}

		const fd = await request.formData();
		const object_path = String(fd.get('object_path') ?? '').trim();
		const mime_type = String(fd.get('mime_type') ?? '').trim();
		const fdBookId = String(fd.get('book_id') ?? '').trim();
		if (fdBookId !== bookId) {
			return fail(400, {
				kind: 'extractScriptureRefs' as const,
				message: 'Book mismatch.'
			});
		}
		if (!object_path || !mime_type) {
			return fail(400, {
				kind: 'extractScriptureRefs' as const,
				message: 'Image path and MIME type are required.'
			});
		}

		const result = await invokeOcrScriptureRefs(locals.supabase, {
			object_path,
			mime_type,
			book_id: bookId
		});

		if (!result.ok) {
			console.error('[extractScriptureRefs]', result.message);
			return fail(500, {
				kind: 'extractScriptureRefs' as const,
				message: result.message
			});
		}

		return {
			kind: 'extractScriptureRefs' as const,
			success: true as const,
			rawText: result.data.rawText,
			candidates: result.data.candidates
		};
	},
	createBookTopicsBatch: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, {
				kind: 'createBookTopicsBatch' as const,
				message: 'Unauthorized'
			});
		const fd = await request.formData();
		return createBookTopicsBatchAction(locals.supabase, user.id, fd);
	},
	updateBookTopic: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'updateBookTopic' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return updateBookTopicAction(locals.supabase, fd);
	},
	softDeleteBookTopic: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'softDeleteBookTopic' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return softDeleteBookTopicAction(locals.supabase, fd);
	},
	createBibleCoverage: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'createBibleCoverage' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return createBibleCoverageAction(locals.supabase, user.id, fd);
	},
	softDeleteBibleCoverage: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, {
				kind: 'softDeleteBibleCoverage' as const,
				message: 'Unauthorized'
			});
		const fd = await request.formData();
		return softDeleteBibleCoverageAction(locals.supabase, fd);
	},
	createAncientCoverage: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'createAncientCoverage' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return createAncientCoverageAction(locals.supabase, user.id, fd);
	},
	softDeleteAncientCoverage: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, {
				kind: 'softDeleteAncientCoverage' as const,
				message: 'Unauthorized'
			});
		const fd = await request.formData();
		return softDeleteAncientCoverageAction(locals.supabase, fd);
	},
	createAncientText: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'createAncientText' as const, message: 'Unauthorized' });
		// Server-side owner gate (defense-in-depth alongside RLS).
		const { data: prof } = await locals.supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.maybeSingle();
		const isOwner =
			((prof as { role?: string | null } | null)?.role ?? null) === 'owner';
		if (!isOwner) {
			return fail(403, {
				kind: 'createAncientText' as const,
				message: 'Owner-only.'
			});
		}
		const fd = await request.formData();
		return createAncientTextAction(locals.supabase, user.id, fd);
	}
};

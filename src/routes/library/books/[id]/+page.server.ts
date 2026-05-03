import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	loadAncientCoverageForBook,
	loadAncientTexts,
	loadAllTopicCounts,
	loadBibleBookNames,
	loadBibleCoverageForBook,
	loadBookDetail,
	loadBookTopicsForBook,
	loadCategories,
	loadPeople,
	loadPersonBookCounts,
	loadScriptureRefsForBook,
	loadSeries
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

export const load: PageServerLoad = async ({ params, locals, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:library:ancient_texts');

	const { id } = params;
	if (!UUID_RE.test(id)) error(404, 'Book not found.');

	const supabase = locals.supabase;

	const [people, categories, series, bibleBookNames, ancientTexts, topicCounts] =
		await Promise.all([
			loadPeople(supabase),
			loadCategories(supabase),
			loadSeries(supabase),
			loadBibleBookNames(supabase),
			loadAncientTexts(supabase),
			loadAllTopicCounts(supabase)
		]);
	const [
		book,
		personBookCounts,
		scriptureRefs,
		bookTopics,
		bibleCoverage,
		ancientCoverage,
		profileRow
	] = await Promise.all([
		loadBookDetail(supabase, id, people),
		loadPersonBookCounts(supabase),
		loadScriptureRefsForBook(supabase, id),
		loadBookTopicsForBook(supabase, id),
		loadBibleCoverageForBook(supabase, id),
		loadAncientCoverageForBook(supabase, id),
		supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
	]);

	if (!book) error(404, 'Book not found.');

	const isOwner =
		((profileRow.data as { role?: string | null } | null)?.role ?? null) === 'owner';

	return {
		book,
		people,
		categories,
		series,
		bibleBookNames,
		ancientTexts,
		topicCounts,
		scriptureRefs,
		bookTopics,
		bibleCoverage,
		ancientCoverage,
		isOwner,
		personBookCounts: Object.fromEntries(personBookCounts),
		userId: user.id
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

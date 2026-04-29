import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	loadBibleBookNames,
	loadBookDetail,
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
	softDeleteScriptureRefAction,
	updateScriptureRefAction
} from '$lib/library/server/scripture-actions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { id } = params;
	if (!UUID_RE.test(id)) error(404, 'Book not found.');

	const supabase = locals.supabase;

	const [people, categories, series, bibleBookNames] = await Promise.all([
		loadPeople(supabase),
		loadCategories(supabase),
		loadSeries(supabase),
		loadBibleBookNames(supabase)
	]);
	const [book, personBookCounts, scriptureRefs] = await Promise.all([
		loadBookDetail(supabase, id, people),
		loadPersonBookCounts(supabase),
		loadScriptureRefsForBook(supabase, id)
	]);

	if (!book) error(404, 'Book not found.');

	return {
		book,
		people,
		categories,
		series,
		bibleBookNames,
		scriptureRefs,
		personBookCounts: Object.fromEntries(personBookCounts),
		// Surface userId explicitly so client components (e.g. the storage upload
		// path builder in <ScriptureReferenceForm>) get a non-nullable string
		// without re-asserting on data.user (which TS sees as nullable since the
		// layout's redirect happens before this load runs).
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
		// Detail page no longer exists after the delete (loadBookDetail returns
		// null → 404). Redirect to the list, which renders the 10s undo toast.
		// Pre-Session-1.5 this returned a success object and the page rerender
		// 404'd before the toast could mount.
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
	}
};

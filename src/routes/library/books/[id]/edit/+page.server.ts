import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	loadBookDetail,
	loadBibleBookList,
	loadPersonBookCounts
} from '$lib/library/server/loaders';
import {
	createPersonAction,
	softDeleteBookAction,
	undoSoftDeleteBookAction,
	updateBookAction
} from '$lib/library/server/book-actions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params, locals, depends, parent }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:library:people');
	depends('app:library:series');

	const { id } = params;
	if (!UUID_RE.test(id)) error(404, 'Book not found.');

	const supabase = locals.supabase;
	const { people, series } = await parent();

	const bibleBooks = await loadBibleBookList(supabase);
	const [book, personBookCounts] = await Promise.all([
		loadBookDetail(supabase, id, people),
		loadPersonBookCounts(supabase)
	]);

	if (!book) error(404, 'Book not found.');

	return {
		book,
		people,
		series,
		bibleBooks,
		personBookCounts: Object.fromEntries(personBookCounts)
	};
};

export const actions: Actions = {
	updateBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateBook' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return updateBookAction(locals.supabase, user.id, fd);
	},
	createPerson: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createPerson' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return createPersonAction(locals.supabase, user.id, fd);
	},
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
	}
};

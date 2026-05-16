import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	countLiveBooks,
	loadBookListFiltered
} from '$lib/library/server/loaders';
import {
	createPersonAction,
	softDeleteBookAction,
	undoSoftDeleteBookAction,
	updateReadingStatusAction,
	bulkUpdateBooksAction
} from '$lib/library/server/book-actions';
import { multiParam } from '$lib/library/server/url-params';
import { LANGUAGES, READING_STATUSES } from '$lib/types/library';
import type { BookListFilters, Language, ReadingStatus } from '$lib/types/library';

function parseFilters(url: URL): BookListFilters {
	const filters: BookListFilters = {};

	const genres = multiParam(url, 'genre');
	if (genres.length > 0) filters.genre = genres;

	const series = multiParam(url, 'series_id');
	if (series.length > 0) filters.series_id = series;

	const authors = multiParam(url, 'author_id');
	if (authors.length > 0) filters.author_id = authors;

	const langSet = new Set<Language>(LANGUAGES);
	const langs = multiParam(url, 'language').filter((l): l is Language =>
		langSet.has(l as Language)
	);
	if (langs.length > 0) filters.language = langs;

	const statusSet = new Set<ReadingStatus>(READING_STATUSES);
	const statuses = multiParam(url, 'reading_status').filter((s): s is ReadingStatus =>
		statusSet.has(s as ReadingStatus)
	);
	if (statuses.length > 0) filters.reading_status = statuses;

	if (url.searchParams.get('needs_review') === 'true') filters.needs_review = true;

	const q = (url.searchParams.get('q') ?? '').trim();
	if (q.length > 0) filters.q = q;

	return filters;
}

export const load: PageServerLoad = async ({ locals, url, parent }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;
	const filters = parseFilters(url);
	const recentlyDeletedId = url.searchParams.get('deleted');

	const { people, series, bibleBookNames } = await parent();

	const [books, totalCount] = await Promise.all([
		loadBookListFiltered(supabase, people, filters),
		countLiveBooks(supabase)
	]);

	return {
		books,
		series,
		people,
		bibleBookNames,
		recentlyDeletedId,
		filters,
		totalCount
	};
};

export const actions: Actions = {
	softDeleteBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'softDeleteBook' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return softDeleteBookAction(locals.supabase, fd);
	},
	undoSoftDeleteBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'undoSoftDeleteBook' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return undoSoftDeleteBookAction(locals.supabase, fd);
	},
	createPerson: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createPerson' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return createPersonAction(locals.supabase, user.id, fd);
	},
	updateReadingStatus: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateReadingStatus' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return updateReadingStatusAction(locals.supabase, fd);
	},
	bulkUpdateBooks: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'bulkUpdateBooks' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return bulkUpdateBooksAction(locals.supabase, user.id, fd);
	}
};

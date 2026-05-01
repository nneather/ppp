import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	countLiveBooks,
	loadBookListFiltered,
	loadPeople,
	loadPersonBookCounts,
	loadSeries
} from '$lib/library/server/loaders';
import {
	createPersonAction,
	softDeleteBookAction,
	undoSoftDeleteBookAction,
	updateReadingStatusAction
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

	// Author facet (Session 5). `category_id` param dropped per Open
	// Question 11 — the column is still populated for shelving, but the
	// facet duplicated Genre after Pass 1's SUBJECT_TO_GENRE mapping.
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

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;
	const filters = parseFilters(url);

	const [people, series, totalCount] = await Promise.all([
		loadPeople(supabase),
		loadSeries(supabase),
		countLiveBooks(supabase)
	]);
	const [books, personBookCounts] = await Promise.all([
		loadBookListFiltered(supabase, people, filters),
		loadPersonBookCounts(supabase)
	]);

	const recentlyDeletedId = url.searchParams.get('deleted');

	return {
		books,
		series,
		people,
		personBookCounts: Object.fromEntries(personBookCounts),
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
	}
};

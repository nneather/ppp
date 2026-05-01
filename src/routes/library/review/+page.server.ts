import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	countReviewQueue,
	loadPeople,
	loadReviewQueue
} from '$lib/library/server/loaders';
import {
	reviewSaveAction,
	softDeleteBookAction
} from '$lib/library/server/book-actions';
import { multiParam } from '$lib/library/server/url-params';
import {
	IMPORT_MATCH_TYPES,
	LANGUAGES,
	READING_STATUSES
} from '$lib/types/library';
import type {
	ImportMatchType,
	Language,
	ReadingStatus,
	ReviewQueueFilters
} from '$lib/types/library';

const QUEUE_PAGE_SIZE = 10;

export function parseReviewFilters(url: URL): ReviewQueueFilters {
	const filters: ReviewQueueFilters = {};

	const genres = multiParam(url, 'genre');
	if (genres.length > 0) filters.genre = genres;

	const series = multiParam(url, 'series_id');
	if (series.length > 0) filters.series_id = series;

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

	if (url.searchParams.get('subject') === 'blank') filters.subject_blank = true;

	const matchSet = new Set<ImportMatchType>(IMPORT_MATCH_TYPES);
	const matches = multiParam(url, 'match_type').filter((m): m is ImportMatchType =>
		matchSet.has(m as ImportMatchType)
	);
	if (matches.length > 0) filters.import_match_type = matches;

	return filters;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;
	const filters = parseReviewFilters(url);

	const people = await loadPeople(supabase);
	const [cards, remaining] = await Promise.all([
		loadReviewQueue(supabase, people, filters, {
			limit: QUEUE_PAGE_SIZE,
			excludeIds: []
		}),
		countReviewQueue(supabase, filters)
	]);

	return {
		cards,
		remaining,
		filters,
		queuePageSize: QUEUE_PAGE_SIZE
	};
};

export const actions: Actions = {
	saveReviewed: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'reviewSaved' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return reviewSaveAction(locals.supabase, user.id, fd);
	},
	softDeleteBook: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'softDeleteBook' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return softDeleteBookAction(locals.supabase, fd);
	}
};

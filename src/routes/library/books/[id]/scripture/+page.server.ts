import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	loadScriptureIndexCounts,
	loadScriptureIndexRows
} from '$lib/library/server/scripture-index-loaders';
import { loadSetVolumeBooks } from '$lib/library/server/systematics-loaders';
import {
	setScriptureRefsNeedsReviewAction,
	softDeleteScriptureRefsBulkAction,
	undoSoftDeleteScriptureRefsBulkAction,
	updateScriptureRefAction
} from '$lib/library/server/scripture-actions';
import {
	aggregateScriptureCounts,
	parseScriptureManageFilters,
	scriptureManageFiltersToSearchParams
} from '$lib/library/scripture-index';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params, locals, url, depends, parent }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const id = params.id?.trim() ?? '';
	if (!UUID_RE.test(id)) error(404, 'Book not found.');

	depends(`app:library:book:${id}`);

	const supabase = locals.supabase;
	const { allBibleBookNames } = await parent();

	const { data: book, error: bookErr } = await supabase
		.from('books')
		.select('id, title, subtitle, volume_number, series_id')
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (bookErr || !book) error(404, 'Book not found.');

	const seriesId = (book.series_id as string | null) ?? null;
	let seriesName: string | null = null;
	if (seriesId) {
		const { data: seriesRow } = await supabase
			.from('series')
			.select('name')
			.eq('id', seriesId)
			.is('deleted_at', null)
			.maybeSingle();
		seriesName = (seriesRow?.name as string | null) ?? null;
	}

	const volumes = seriesId ? await loadSetVolumeBooks(supabase, seriesId) : [];
	const volumeByBookId = new Map<string, string | null>(
		volumes.length > 0
			? volumes.map((v) => [v.bookId, v.volumeNumber])
			: [[id, (book.volume_number as string | null) ?? null]]
	);

	const filters = parseScriptureManageFilters(url.searchParams);
	const scopeBookIds =
		filters.scope === 'set' && volumes.length > 0
			? volumes.map((v) => v.bookId)
			: [id];

	const [counts, page] = await Promise.all([
		loadScriptureIndexCounts(supabase, volumes.length > 0 ? volumes.map((v) => v.bookId) : [id]),
		loadScriptureIndexRows(supabase, {
			bookIds: scopeBookIds,
			bibleBook: filters.bibleBook,
			chapter: filters.chapter,
			withOutline: true,
			volumeByBookId,
			limit: filters.limit,
			offset: filters.offset,
			filters: {
				passage: filters.passage,
				page: filters.page,
				needsReview: filters.needsReview
			}
		})
	]);

	const tallies = aggregateScriptureCounts(counts, new Set(scopeBookIds));

	return {
		book: {
			id: book.id as string,
			title: (book.title as string) ?? '',
			subtitle: (book.subtitle as string | null) ?? null,
			volume_number: (book.volume_number as string | null) ?? null,
			series_id: seriesId,
			series_name: seriesName
		},
		allBibleBookNames,
		filters,
		filterQuery: scriptureManageFiltersToSearchParams(filters).toString(),
		scopeBookIds,
		setVolumeCount: volumes.length,
		tallies,
		rows: page.rows,
		filteredCount: page.filteredCount
	};
};

export const actions: Actions = {
	updateScriptureRef: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateScriptureRef' as const, message: 'Unauthorized' });
		return updateScriptureRefAction(locals.supabase, await request.formData());
	},
	softDeleteBulk: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(401, {
				kind: 'softDeleteScriptureRefsBulk' as const,
				message: 'Unauthorized'
			});
		}
		return softDeleteScriptureRefsBulkAction(locals.supabase, await request.formData());
	},
	undoSoftDeleteBulk: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(401, {
				kind: 'undoSoftDeleteScriptureRefsBulk' as const,
				message: 'Unauthorized'
			});
		}
		return undoSoftDeleteScriptureRefsBulkAction(locals.supabase, await request.formData());
	},
	setNeedsReview: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(401, {
				kind: 'setScriptureRefsNeedsReview' as const,
				message: 'Unauthorized'
			});
		}
		return setScriptureRefsNeedsReviewAction(locals.supabase, await request.formData());
	}
};

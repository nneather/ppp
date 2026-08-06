import { redirect } from '@sveltejs/kit';
import {
	analyticsRangeEndingToday,
	buildAnalyticsSeries,
	parseAnalyticsSearchParams,
	summarizeAnalyticsSeries,
	type AnalyticsEntryInput
} from '$lib/invoicing/analytics';
import { ymdInChicago } from '$lib/invoicing/chicago-date';
import type { PageServerLoad } from './$types';

export type AnalyticsClientOption = {
	id: string;
	name: string;
	/** Soft-deleted clients (e.g. FOL) still appear when they have series hours. */
	archived: boolean;
};

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { grain, metric, clientId } = parseAnalyticsSearchParams(url.searchParams);
	const today = ymdInChicago();
	const range = analyticsRangeEndingToday(grain, today);

	const { data: entryRows, error: entriesError } = await locals.supabase
		.from('time_entries')
		.select('date, hours, rate, client_id')
		.is('deleted_at', null)
		.gte('date', range.start)
		.lte('date', range.end)
		.order('date', { ascending: true });

	if (entriesError) {
		console.error(entriesError);
		return {
			error: 'Could not load time entries.',
			grain,
			metric,
			clientId,
			rangeStart: range.start,
			rangeEnd: range.end,
			series: [],
			summary: summarizeAnalyticsSeries([]),
			clients: [] as AnalyticsClientOption[]
		};
	}

	const rawEntries: AnalyticsEntryInput[] = (entryRows ?? []).map((row) => ({
		date: row.date as string,
		hours: Number(row.hours) || 0,
		rate: Number(row.rate) || 0,
		client_id: row.client_id as string
	}));

	const clientIdsInSeries = [...new Set(rawEntries.map((e) => e.client_id))];

	const [{ data: liveClients, error: liveErr }, { data: seriesClients, error: seriesErr }] =
		await Promise.all([
			locals.supabase
				.from('clients')
				.select('id, name')
				.is('deleted_at', null)
				.order('name', { ascending: true }),
			clientIdsInSeries.length > 0
				? locals.supabase.from('clients').select('id, name, deleted_at').in('id', clientIdsInSeries)
				: Promise.resolve({ data: [] as { id: string; name: string; deleted_at: string | null }[], error: null })
		]);

	if (liveErr) console.error(liveErr);
	if (seriesErr) console.error(seriesErr);

	const nameById = new Map<string, { name: string; archived: boolean }>();
	for (const c of liveClients ?? []) {
		nameById.set(c.id as string, { name: c.name as string, archived: false });
	}
	for (const c of seriesClients ?? []) {
		const id = c.id as string;
		const archived = c.deleted_at != null;
		const existing = nameById.get(id);
		if (!existing) {
			nameById.set(id, { name: c.name as string, archived });
		} else if (archived) {
			nameById.set(id, { ...existing, archived: true });
		}
	}

	const clients: AnalyticsClientOption[] = [...nameById.entries()]
		.map(([id, v]) => ({ id, name: v.name, archived: v.archived }))
		.sort((a, b) => a.name.localeCompare(b.name));

	const filtered =
		clientId && nameById.has(clientId)
			? rawEntries.filter((e) => e.client_id === clientId)
			: rawEntries;

	const effectiveClientId = clientId && nameById.has(clientId) ? clientId : null;

	const series = buildAnalyticsSeries(filtered, {
		grain,
		rangeStart: range.start,
		rangeEnd: range.end
	});
	const summary = summarizeAnalyticsSeries(series);

	return {
		error: null as string | null,
		grain,
		metric,
		clientId: effectiveClientId,
		rangeStart: range.start,
		rangeEnd: range.end,
		series,
		summary,
		clients
	};
};

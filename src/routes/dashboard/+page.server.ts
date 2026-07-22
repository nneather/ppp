import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	countBooksNeedingReview,
	countReviewQueueBySlice
} from '$lib/library/server/loaders';
import {
	ymdInChicago,
	mondaySundayWeekContainingYmd,
	previousMondaySundayWeekChicago
} from '$lib/invoicing/chicago-date';
import { loadProjectTree, loadLatestHealth } from '$lib/projects/server/loaders';
import type { LatestHealth } from '$lib/types/projects';
import type { LastWeekInvoiceCandidate } from '$lib/types/invoicing';

type LastWeekClientRel = { name: string; billing_cadence: string; deleted_at: string | null };

function parseLastWeekClientRel(raw: unknown): LastWeekClientRel | null {
	const rel = raw as LastWeekClientRel | LastWeekClientRel[] | null;
	const row = Array.isArray(rel) ? rel[0] : rel;
	if (!row || typeof row.name !== 'string') return null;
	return row;
}

function aggregateLastWeekInvoiceCandidates(
	rows: Array<{ client_id: string; hours: number | string; clients: unknown }>,
	periodStart: string,
	periodEnd: string
): LastWeekInvoiceCandidate[] {
	const byClient = new Map<string, { clientName: string; entryCount: number; hours: number }>();

	for (const row of rows) {
		const client = parseLastWeekClientRel(row.clients);
		if (!client) continue;
		if (client.deleted_at != null) continue;
		if (client.billing_cadence !== 'weekly') continue;
		const hours = Number(row.hours);
		const existing = byClient.get(row.client_id);
		if (existing) {
			existing.entryCount += 1;
			existing.hours += hours;
		} else {
			byClient.set(row.client_id, {
				clientName: client.name,
				entryCount: 1,
				hours
			});
		}
	}

	return [...byClient.entries()]
		.map(([clientId, value]) => ({
			clientId,
			clientName: value.clientName,
			entryCount: value.entryCount,
			hours: Math.round(value.hours * 100) / 100,
			periodStart,
			periodEnd
		}))
		.sort((a, b) => a.clientName.localeCompare(b.clientName));
}

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;
	const today = ymdInChicago();
	const thisMonday = mondaySundayWeekContainingYmd(today).start;
	const lastWeek = previousMondaySundayWeekChicago();

	const [
		unbilledRes,
		lastWeekEntriesRes,
		libraryNeedsReview,
		criticalRemaining,
		backlogRemaining,
		projectTree,
		latestHealthMap,
		criticalNowTasksRes,
		opportunityNowTasksRes
	] = await Promise.all([
		supabase
			.from('time_entries')
			.select('id', { count: 'exact', head: true })
			.is('invoice_id', null)
			.is('deleted_at', null)
			.lt('date', thisMonday),
		supabase
			.from('time_entries')
			.select('client_id, hours, clients!inner ( name, billing_cadence, deleted_at )')
			.is('invoice_id', null)
			.is('deleted_at', null)
			.gte('date', lastWeek.start)
			.lte('date', lastWeek.end),
		countBooksNeedingReview(supabase),
		countReviewQueueBySlice(supabase, 'critical'),
		countReviewQueueBySlice(supabase, 'backlog'),
		locals.perf.measure('db', () => loadProjectTree(supabase)),
		locals.perf.measure('db', () => loadLatestHealth(supabase)),
		supabase
			.from('project_tasks')
			.select('id', { count: 'exact', head: true })
			.eq('priority', 'critical_now')
			.is('deleted_at', null)
			.is('completed_at', null)
			.lte('start_date', today),
		supabase
			.from('project_tasks')
			.select('id', { count: 'exact', head: true })
			.eq('priority', 'opportunity_now')
			.is('deleted_at', null)
			.is('completed_at', null)
			.lte('start_date', today)
	]);

	const criticalNowTaskCount = criticalNowTasksRes.error
		? null
		: (criticalNowTasksRes.count ?? 0);
	const opportunityNowTaskCount = opportunityNowTasksRes.error
		? null
		: (opportunityNowTasksRes.count ?? 0);
	if (criticalNowTasksRes.error) console.error(criticalNowTasksRes.error);
	if (opportunityNowTasksRes.error) console.error(opportunityNowTasksRes.error);

	const latestHealth = Object.fromEntries(latestHealthMap) as Record<string, LatestHealth>;

	let lastWeekInvoiceCandidates: LastWeekInvoiceCandidate[] = [];
	if (lastWeekEntriesRes.error) {
		console.error(lastWeekEntriesRes.error);
	} else {
		lastWeekInvoiceCandidates = aggregateLastWeekInvoiceCandidates(
			lastWeekEntriesRes.data ?? [],
			lastWeek.start,
			lastWeek.end
		);
	}

	if (unbilledRes.error) {
		console.error(unbilledRes.error);
		return {
			unbilledPriorCount: null as number | null,
			lastWeekInvoiceCandidates,
			libraryNeedsReviewCount: libraryNeedsReview,
			libraryCriticalRemaining: criticalRemaining,
			libraryBacklogRemaining: backlogRemaining,
			projectTree,
			latestHealth,
			criticalNowTaskCount,
			opportunityNowTaskCount,
			dashboardError: 'Could not load unbilled count.' as string | null
		};
	}

	return {
		unbilledPriorCount: unbilledRes.count ?? 0,
		lastWeekInvoiceCandidates,
		libraryNeedsReviewCount: libraryNeedsReview,
		libraryCriticalRemaining: criticalRemaining,
		libraryBacklogRemaining: backlogRemaining,
		projectTree,
		latestHealth,
		criticalNowTaskCount,
		opportunityNowTaskCount,
		dashboardError: null as string | null
	};
};

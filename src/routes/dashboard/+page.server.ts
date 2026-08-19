import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	countBooksNeedingReview,
	countLiveBooks
} from '$lib/library/server/loaders';
import {
	ymdInChicago,
	mondaySundayWeekContainingYmd,
	previousMondaySundayWeekChicago
} from '$lib/invoicing/chicago-date';
import { currentSundayChicago } from '$lib/projects/week';
import { countMissingWeekCheckIns } from '$lib/projects/filter';
import { loadProjectTree, loadLatestHealth } from '$lib/projects/server/loaders';
import { loadDashboardNowTasks } from '$lib/projects/server/task-loaders';
import { loadDueSoonAssignments } from '$lib/classwork/server/loaders';
import { loadContactsDue } from '$lib/contacts/server/loaders';
import { loadUpcomingSermons } from '$lib/sermons/server/loaders';
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

export const load: PageServerLoad = async ({ locals, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:classwork:list');
	depends('app:contacts:list');

	const supabase = locals.supabase;
	const today = ymdInChicago();
	const thisMonday = mondaySundayWeekContainingYmd(today).start;
	const lastWeek = previousMondaySundayWeekChicago();
	const weekOf = currentSundayChicago();

	const [
		unbilledRes,
		lastWeekEntriesRes,
		libraryNeedsReview,
		libraryBookCount,
		projectTree,
		latestHealthMap,
		nowTasks,
		upcomingSermonsRes,
		dueSoonRes,
		profileRes
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
		countLiveBooks(supabase),
		locals.perf.measure('db', () => loadProjectTree(supabase)),
		locals.perf.measure('db', () => loadLatestHealth(supabase)),
		locals.perf.measure('db', () => loadDashboardNowTasks(supabase, { todayYmd: today })),
		locals.perf.measure('db', () => loadUpcomingSermons(supabase, { todayYmd: today, limit: 5 })),
		locals.perf.measure('db', () =>
			loadDueSoonAssignments(supabase, { todayYmd: today, horizonDays: 14 })
		),
		supabase
			.from('profiles')
			.select('contact_cadence_days_default')
			.eq('id', user.id)
			.maybeSingle()
	]);

	if (profileRes.error) console.error(profileRes.error);
	if (upcomingSermonsRes.error) console.error(upcomingSermonsRes.error);
	if (dueSoonRes.error) console.error(dueSoonRes.error);

	const contactsDueRes = await locals.perf.measure('db', () =>
		loadContactsDue(supabase, {
			todayYmd: today,
			profileCadenceDefault: profileRes.data?.contact_cadence_days_default ?? null,
			limit: 25
		})
	);
	if (contactsDueRes.error) console.error(contactsDueRes.error);

	const latestHealth = Object.fromEntries(latestHealthMap) as Record<string, LatestHealth>;
	const missingCheckInCount = countMissingWeekCheckIns(
		projectTree,
		latestHealth,
		weekOf,
		today
	);

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

	const criticalNowTaskCount = nowTasks.criticalNowCount;
	const opportunityNowTaskCount = nowTasks.opportunityNowCount;

	const dueSoonAssignments = dueSoonRes.assignments;
	const dueSoonOverdueCount = dueSoonAssignments.filter((a) => a.days_until < 0).length;
	const contactsDue = contactsDueRes.contacts;
	const contactsDueNeverCount = contactsDue.filter((c) => c.days_overdue == null).length;

	if (unbilledRes.error) {
		console.error(unbilledRes.error);
		return {
			unbilledPriorCount: null as number | null,
			lastWeekInvoiceCandidates,
			libraryNeedsReviewCount: libraryNeedsReview,
			libraryBookCount,
			projectTree,
			latestHealth,
			criticalNowTaskCount,
			opportunityNowTaskCount,
			upcomingSermons: upcomingSermonsRes.sermons,
			dueSoonAssignments,
			dueSoonOverdueCount,
			contactsDue,
			contactsDueNeverCount,
			missingCheckInCount,
			weekOf,
			dashboardError: 'Could not load unbilled count.' as string | null
		};
	}

	return {
		unbilledPriorCount: unbilledRes.count ?? 0,
		lastWeekInvoiceCandidates,
		libraryNeedsReviewCount: libraryNeedsReview,
		libraryBookCount,
		projectTree,
		latestHealth,
		criticalNowTaskCount,
		opportunityNowTaskCount,
		upcomingSermons: upcomingSermonsRes.sermons,
		dueSoonAssignments,
		dueSoonOverdueCount,
		contactsDue,
		contactsDueNeverCount,
		missingCheckInCount,
		weekOf,
		dashboardError: null as string | null
	};
};

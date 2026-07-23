import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	countBooksNeedingReview,
	countReviewQueueBySlice
} from '$lib/library/server/loaders';
import {
	ymdInChicago,
	mondaySundayWeekContainingYmd,
	previousMondaySundayWeekChicago
} from '$lib/invoicing/chicago-date';
import { currentSundayChicago } from '$lib/projects/week';
import { countMissingWeekCheckIns } from '$lib/projects/filter';
import {
	loadProjectTree,
	loadLatestHealth,
	loadProjectRows,
	flattenProjectTree
} from '$lib/projects/server/loaders';
import {
	attachTaskDomainColors,
	loadDashboardNowTasks,
	loadTaskSeriesByIds
} from '$lib/projects/server/task-loaders';
import { buildDomainColorByProjectId } from '$lib/projects/project-colors';
import {
	createTaskAction,
	updateTaskAction,
	completeTaskAction,
	uncompleteTaskAction,
	deferTaskAction,
	promoteTaskAction,
	raisePriorityAction,
	softDeleteTaskAction,
	undoSoftDeleteTaskAction
} from '$lib/projects/server/task-actions';
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

	depends('app:projects:tasks');

	const supabase = locals.supabase;
	const today = ymdInChicago();
	const thisMonday = mondaySundayWeekContainingYmd(today).start;
	const lastWeek = previousMondaySundayWeekChicago();
	const weekOf = currentSundayChicago();

	const [
		unbilledRes,
		lastWeekEntriesRes,
		libraryNeedsReview,
		criticalRemaining,
		backlogRemaining,
		projectTree,
		latestHealthMap,
		nowTasks,
		upcomingSermonsRes,
		flatRows,
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
		countReviewQueueBySlice(supabase, 'critical'),
		countReviewQueueBySlice(supabase, 'backlog'),
		locals.perf.measure('db', () => loadProjectTree(supabase)),
		locals.perf.measure('db', () => loadLatestHealth(supabase)),
		locals.perf.measure('db', () => loadDashboardNowTasks(supabase, { todayYmd: today })),
		locals.perf.measure('db', () => loadUpcomingSermons(supabase, { todayYmd: today, limit: 5 })),
		loadProjectRows(supabase),
		supabase
			.from('profiles')
			.select('default_task_project_id')
			.eq('id', user.id)
			.maybeSingle()
	]);

	if (profileRes.error) console.error(profileRes.error);
	if (upcomingSermonsRes.error) console.error(upcomingSermonsRes.error);

	const latestHealth = Object.fromEntries(latestHealthMap) as Record<string, LatestHealth>;
	const missingCheckInCount = countMissingWeekCheckIns(projectTree, latestHealth, weekOf);

	const colored = attachTaskDomainColors(
		{
			zones: nowTasks.zones,
			deferred: [],
			completed: [],
			todayYmd: nowTasks.todayYmd,
			openCount: nowTasks.criticalNowCount + nowTasks.opportunityNowCount,
			visibleCount: nowTasks.criticalNowCount + nowTasks.opportunityNowCount,
			atCap: false,
			truncated: false
		},
		buildDomainColorByProjectId(flatRows)
	);

	const seriesIds = [
		...new Set(
			colored.zones
				.flatMap((z) => z.tasks)
				.map((t) => t.series_id)
				.filter((id): id is string => id != null)
		)
	];
	const seriesById = await loadTaskSeriesByIds(supabase, seriesIds);

	const projectOptions = flattenProjectTree(projectTree).filter((o) => o.parent_id == null);

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
			nowZones: colored.zones,
			todayYmd: today,
			seriesById,
			projectOptions,
			defaultTaskProjectId: profileRes.data?.default_task_project_id ?? null,
			upcomingSermons: upcomingSermonsRes.sermons,
			missingCheckInCount,
			weekOf,
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
		nowZones: colored.zones,
		todayYmd: today,
		seriesById,
		projectOptions,
		defaultTaskProjectId: profileRes.data?.default_task_project_id ?? null,
		upcomingSermons: upcomingSermonsRes.sermons,
		missingCheckInCount,
		weekOf,
		dashboardError: null as string | null
	};
};

export const actions: Actions = {
	createTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createTask' as const, message: 'Unauthorized' });
		return createTaskAction(locals.supabase, user.id, await request.formData());
	},
	updateTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateTask' as const, message: 'Unauthorized' });
		return updateTaskAction(locals.supabase, await request.formData());
	},
	completeTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'completeTask' as const, message: 'Unauthorized' });
		return completeTaskAction(locals.supabase, await request.formData());
	},
	uncompleteTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'uncompleteTask' as const, message: 'Unauthorized' });
		return uncompleteTaskAction(locals.supabase, await request.formData());
	},
	deferTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'deferTask' as const, message: 'Unauthorized' });
		return deferTaskAction(locals.supabase, await request.formData());
	},
	promoteTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'promoteTask' as const, message: 'Unauthorized' });
		return promoteTaskAction(locals.supabase, await request.formData());
	},
	raisePriority: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'raisePriority' as const, message: 'Unauthorized' });
		return raisePriorityAction(locals.supabase, await request.formData());
	},
	softDeleteTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'softDeleteTask' as const, message: 'Unauthorized' });
		return softDeleteTaskAction(locals.supabase, await request.formData());
	},
	undoSoftDeleteTask: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'undoSoftDeleteTask' as const, message: 'Unauthorized' });
		return undoSoftDeleteTaskAction(locals.supabase, await request.formData());
	}
};

/**
 * When this Chicago Sunday's project check-in is complete (no missing nags),
 * auto-complete the open weekly_project_checkin ritual occurrence in that week.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ymdInChicago } from '$lib/invoicing/chicago-date';
import { countMissingWeekCheckIns } from '$lib/projects/filter';
import {
	startDateInSundayWeek,
	sundayWeekEndYmd,
	WEEKLY_PROJECT_CHECKIN_RITUAL
} from '$lib/projects/ritual-checkin';
import { currentSundayChicago } from '$lib/projects/week';
import { loadLatestHealth, loadProjectTree } from '$lib/projects/server/loaders';
import { completeTaskRecord } from '$lib/projects/server/task-actions';

export type RitualReconcileResult =
	| { kind: 'skipped'; reason: string }
	| { kind: 'already_done' }
	| { kind: 'completed'; taskId: string }
	| { kind: 'error'; message: string };

export async function reconcileWeeklyCheckinRitual(
	supabase: SupabaseClient,
	opts?: { weekOf?: string; todayYmd?: string }
): Promise<RitualReconcileResult> {
	const weekOf = opts?.weekOf ?? currentSundayChicago();
	const todayYmd = opts?.todayYmd ?? ymdInChicago();
	const weekEnd = sundayWeekEndYmd(weekOf);
	if (!weekEnd) {
		return { kind: 'skipped', reason: 'invalid_week' };
	}

	const [tree, latestHealth] = await Promise.all([
		loadProjectTree(supabase),
		loadLatestHealth(supabase)
	]);

	if (countMissingWeekCheckIns(tree, latestHealth, weekOf, todayYmd) > 0) {
		return { kind: 'skipped', reason: 'checkin_incomplete' };
	}

	const { data: seriesRows, error: seriesError } = await supabase
		.from('project_task_series')
		.select('id')
		.eq('ritual_kind', WEEKLY_PROJECT_CHECKIN_RITUAL)
		.is('deleted_at', null)
		.limit(1);

	if (seriesError) {
		console.error('reconcileWeeklyCheckinRitual series', seriesError);
		return { kind: 'error', message: seriesError.message };
	}

	const seriesId = seriesRows?.[0]?.id as string | undefined;
	if (!seriesId) {
		return { kind: 'skipped', reason: 'no_ritual_series' };
	}

	const { data: taskRows, error: taskError } = await supabase
		.from('project_tasks')
		.select(
			'id, project_id, title, priority, start_date, notes, series_id, series_occurrence, completed_at, deleted_at, created_by'
		)
		.eq('series_id', seriesId)
		.is('deleted_at', null)
		.is('completed_at', null)
		.gte('start_date', weekOf)
		.lte('start_date', weekEnd)
		.order('start_date', { ascending: true })
		.limit(5);

	if (taskError) {
		console.error('reconcileWeeklyCheckinRitual tasks', taskError);
		return { kind: 'error', message: taskError.message };
	}

	const open = (taskRows ?? []).filter((t) =>
		startDateInSundayWeek(t.start_date as string, weekOf)
	);
	if (open.length === 0) {
		return { kind: 'already_done' };
	}

	const task = open[0]!;
	const result = await completeTaskRecord(supabase, {
		id: task.id as string,
		project_id: task.project_id as string,
		title: task.title as string,
		priority: task.priority as string,
		start_date: task.start_date as string,
		notes: (task.notes as string | null) ?? null,
		series_id: (task.series_id as string | null) ?? null,
		series_occurrence: (task.series_occurrence as number | null) ?? null,
		completed_at: (task.completed_at as string | null) ?? null,
		deleted_at: (task.deleted_at as string | null) ?? null,
		created_by: (task.created_by as string | null) ?? null
	});

	if (!result.ok) {
		return { kind: 'error', message: result.message };
	}

	return { kind: 'completed', taskId: task.id as string };
}

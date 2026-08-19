<script lang="ts">
	import { onMount } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import ProjectTaskList from '$lib/components/project-task-list.svelte';
	import ProjectTaskSheet from '$lib/components/project-task-sheet.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		isNowTaskRailData,
		NOW_TASK_RAIL_JSON,
		type NowTaskRailData
	} from '$lib/projects/now-task-rail';
	import type { ProjectTaskView } from '$lib/types/projects';

	let rail = $state<NowTaskRailData | null>(null);
	let loadError = $state<string | null>(null);

	let sheetOpen = $state(false);
	let sheetMode = $state<'create' | 'edit'>('create');
	let editingTask = $state<ProjectTaskView | null>(null);

	const editingSeries = $derived.by(() => {
		if (!editingTask?.series_id || !rail) return null;
		return rail.seriesById[editingTask.series_id] ?? null;
	});

	async function refresh() {
		loadError = null;
		try {
			const res = await fetch(NOW_TASK_RAIL_JSON, { cache: 'no-store', credentials: 'same-origin' });
			if (!res.ok) {
				loadError = 'Could not load tasks.';
				return;
			}
			const body: unknown = await res.json();
			if (!isNowTaskRailData(body)) {
				loadError = 'Could not load tasks.';
				return;
			}
			rail = body;
		} catch {
			loadError = 'Could not load tasks.';
		}
	}

	onMount(() => {
		void refresh();
	});

	function openCreate() {
		sheetMode = 'create';
		editingTask = null;
		sheetOpen = true;
	}

	function openEdit(task: ProjectTaskView) {
		sheetMode = 'edit';
		editingTask = task;
		sheetOpen = true;
	}
</script>

<div class="flex h-full min-h-0 flex-col">
	<div class="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
		<div class="min-w-0">
			<h2 class="text-sm font-semibold tracking-tight text-foreground">Now</h2>
			<a
				href="/tasks"
				class="text-xs font-medium text-primary underline-offset-4 hover:underline"
			>
				Open full list
			</a>
		</div>
		<Button type="button" variant="outline" size="sm" class="gap-1" onclick={openCreate}>
			<Plus class="size-3.5" />
			New
		</Button>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
		{#if loadError}
			<p class="text-sm text-destructive">{loadError}</p>
		{:else if !rail}
			<p class="text-sm text-muted-foreground">Loading…</p>
		{:else}
			<ProjectTaskList
				zones={rail.zones}
				compact={true}
				showProjectLabel={true}
				todayYmd={rail.todayYmd}
				actionPrefix="/tasks"
				onEdit={openEdit}
				onInvalidate={refresh}
			/>
		{/if}
	</div>
</div>

{#if rail}
	<ProjectTaskSheet
		bind:open={sheetOpen}
		mode={sheetMode}
		task={editingTask}
		series={editingSeries}
		projectOptions={rail.projectOptions}
		defaultProjectId={rail.defaultTaskProjectId}
		actionPrefix="/tasks"
		onSaved={refresh}
	/>
{/if}

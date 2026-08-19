<script lang="ts">
	import { onMount } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import PanelRightClose from '@lucide/svelte/icons/panel-right-close';
	import PanelRightOpen from '@lucide/svelte/icons/panel-right-open';
	import ProjectTaskList from '$lib/components/project-task-list.svelte';
	import ProjectTaskSheet from '$lib/components/project-task-sheet.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		isNowTaskRailData,
		NOW_TASK_RAIL_JSON,
		type NowTaskRailData
	} from '$lib/projects/now-task-rail';
	import type { ProjectTaskView } from '$lib/types/projects';

	let {
		collapsed = $bindable(false)
	}: {
		collapsed?: boolean;
	} = $props();

	let rail = $state<NowTaskRailData | null>(null);
	let loadError = $state<string | null>(null);

	let sheetOpen = $state(false);
	let sheetMode = $state<'create' | 'edit'>('create');
	let editingTask = $state<ProjectTaskView | null>(null);

	const editingSeries = $derived.by(() => {
		if (!editingTask?.series_id || !rail) return null;
		return rail.seriesById[editingTask.series_id] ?? null;
	});

	const openNowCount = $derived.by(() => {
		if (!rail) return null;
		return rail.criticalNowCount + rail.opportunityNowCount;
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
	{#if collapsed}
		<div class="flex flex-1 flex-col items-center gap-2 p-2">
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class="shrink-0"
				onclick={() => (collapsed = false)}
				aria-label="Expand Now pane"
				title="Expand Now pane"
			>
				<PanelRightOpen class="size-4" />
			</Button>
			<Button
				type="button"
				variant="outline"
				size="icon-sm"
				class="shrink-0"
				onclick={openCreate}
				aria-label="New task"
				title="New task"
			>
				<Plus class="size-4" />
			</Button>
			{#if openNowCount != null}
				<span
					class="mt-1 text-xs font-semibold tabular-nums text-muted-foreground"
					title="{openNowCount} open Now"
					aria-label="{openNowCount} open Now tasks"
				>
					{openNowCount}
				</span>
			{/if}
		</div>
	{:else}
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
			<div class="flex shrink-0 items-center gap-1">
				<Button type="button" variant="outline" size="sm" class="gap-1" onclick={openCreate}>
					<Plus class="size-3.5" />
					New
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					class="shrink-0"
					onclick={() => (collapsed = true)}
					aria-label="Collapse Now pane"
					title="Collapse Now pane"
				>
					<PanelRightClose class="size-4" />
				</Button>
			</div>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
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
	{/if}
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

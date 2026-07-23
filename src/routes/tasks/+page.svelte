<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import PageHeader from '$lib/components/page-header.svelte';
	import ProjectTaskList from '$lib/components/project-task-list.svelte';
	import ProjectTaskSheet from '$lib/components/project-task-sheet.svelte';
	import ListTodo from '@lucide/svelte/icons/list-todo';
	import Plus from '@lucide/svelte/icons/plus';
	import type { PageProps } from './$types';
	import type { ProjectTaskView } from '$lib/types/projects';

	let { data, form }: PageProps = $props();

	let sheetOpen = $state(false);
	let sheetMode = $state<'create' | 'edit'>('create');
	let editingTask = $state<ProjectTaskView | null>(null);

	const f = $derived(form ?? null);

	const sheetError = $derived.by(() => {
		if (!f || f.success) return null;
		if (f.kind === 'createTask' || f.kind === 'updateTask') {
			return f.message ?? 'Something went wrong.';
		}
		return null;
	});

	function tasksHref(patch: Record<string, string | null>): string {
		const params = new URLSearchParams(page.url.searchParams);
		for (const [k, v] of Object.entries(patch)) {
			if (v == null || v === '') params.delete(k);
			else params.set(k, v);
		}
		const q = params.toString();
		return `/tasks${q ? `?${q}` : ''}`;
	}

	function toggleParam(key: 'deferred' | 'completed' | 'all') {
		const on = page.url.searchParams.get(key) === '1';
		goto(tasksHref({ [key]: on ? null : '1' }), { keepFocus: true, noScroll: true });
	}

	const projectFilterLabel = $derived.by(() => {
		if (!data.projectId) return 'All projects';
		return data.filterProjectName ?? 'Project';
	});

	const viewFilterLabel = $derived.by(() => {
		if (!data.activeViewId) return 'All (no saved view)';
		return data.activeViewName ?? 'Saved view';
	});

	const projectSelectItems = $derived([
		{ value: '__all__', label: 'All projects' },
		...data.projectOptions.map((o) => ({
			value: o.id,
			label: o.name
		}))
	]);

	const viewSelectItems = $derived([
		{ value: '__all__', label: 'All (no saved view)' },
		...data.savedViews.map((v) => ({
			value: v.id,
			label: v.name
		}))
	]);

	const softCapBanner = $derived.by(() => {
		if (!data.atCap) return null;
		if (data.truncated) {
			return `Showing ${data.visibleCount} of ${data.openCount} — at cap`;
		}
		return `${data.openCount} open — at cap`;
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

	const editingSeries = $derived.by(() => {
		if (!editingTask?.series_id) return null;
		return data.seriesById[editingTask.series_id] ?? null;
	});

	/** Filter project wins; else profile default for New Task. */
	const sheetDefaultProjectId = $derived(data.projectId ?? data.defaultTaskProjectId);

	async function onTaskSaved() {
		await invalidate('app:projects:tasks');
	}
</script>

{#snippet tasksLead()}
	<ListTodo class="size-6 shrink-0 text-muted-foreground" />
{/snippet}

<div class="mx-auto max-w-3xl px-4 py-6 pb-tabbar md:px-6 md:py-8">
	<PageHeader title="Tasks" lead={tasksLead}>
		{#snippet actions()}
			<Button type="button" variant="outline" size="sm" href="/projects">Tree</Button>
			<Button type="button" size="sm" class="gap-1.5" hotkey="b" onclick={openCreate}>
				<Plus class="size-4" />
				New task
			</Button>
		{/snippet}
	</PageHeader>

	<p class="mb-6 text-sm text-muted-foreground">
		MYN urgency zones — Critical Now, Opportunity Now, Over the Horizon. Sorted by start date (newest
		first). Today: {data.todayYmd} (Chicago).
		<a href="/settings/projects" class="underline-offset-2 hover:underline">Task defaults</a>
	</p>

	{#if softCapBanner}
		<div
			class="mb-4 flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
		>
			<p class="text-sm font-medium text-amber-900 dark:text-amber-200">{softCapBanner}</p>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onclick={() => toggleParam('all')}
			>
				{data.showAll ? 'Show 50' : 'Show all'}
			</Button>
		</div>
	{/if}

	<section class="mb-6 flex flex-col gap-4">
		<div class="space-y-2">
			<Label>Project filter</Label>
			<Select.Root
				type="single"
				value={data.projectId ?? '__all__'}
				onValueChange={(v) => {
					goto(tasksHref({ project: v === '__all__' || !v ? null : v, view: null }), {
						keepFocus: true,
						noScroll: true
					});
				}}
			>
				<Select.Trigger class="w-full max-w-md">{projectFilterLabel}</Select.Trigger>
				<Select.Content class="max-h-72">
					{#each projectSelectItems as item (item.value)}
						<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		{#if data.savedViews.length > 0}
			<div class="space-y-2">
				<Label>Saved view</Label>
				<Select.Root
					type="single"
					value={data.activeViewId ?? '__all__'}
					onValueChange={(v) => {
						goto(tasksHref({ view: v === '__all__' || !v ? null : v, project: null }), {
							keepFocus: true,
							noScroll: true
						});
					}}
				>
					<Select.Trigger class="w-full max-w-md">{viewFilterLabel}</Select.Trigger>
					<Select.Content class="max-h-72">
						{#each viewSelectItems as item (item.value)}
							<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		{/if}

		<div class="flex flex-wrap gap-2">
			<Button
				type="button"
				variant={data.includeDeferred ? 'secondary' : 'outline'}
				size="sm"
				onclick={() => toggleParam('deferred')}
			>
				{data.includeDeferred ? 'Hide' : 'Show'} deferred
			</Button>
			<Button
				type="button"
				variant={data.includeCompleted ? 'secondary' : 'outline'}
				size="sm"
				onclick={() => toggleParam('completed')}
			>
				{data.includeCompleted ? 'Hide' : 'Show'} completed
			</Button>
		</div>
	</section>

	<ProjectTaskList
		zones={data.zones}
		deferred={data.deferred}
		completed={data.completed}
		showProjectLabel={!data.projectId}
		todayYmd={data.todayYmd}
		onEdit={openEdit}
		onInvalidate={onTaskSaved}
	/>
</div>

<ProjectTaskSheet
	bind:open={sheetOpen}
	mode={sheetMode}
	task={editingTask}
	series={editingSeries}
	projectOptions={data.projectOptions}
	defaultProjectId={sheetDefaultProjectId}
	errorMessage={sheetError}
	onSaved={onTaskSaved}
/>

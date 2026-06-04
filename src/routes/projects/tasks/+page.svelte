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
		return `/projects/tasks${q ? `?${q}` : ''}`;
	}

	function toggleParam(key: 'deferred' | 'completed') {
		const on = page.url.searchParams.get(key) === '1';
		goto(tasksHref({ [key]: on ? null : '1' }), { keepFocus: true, noScroll: true });
	}

	const projectFilterLabel = $derived.by(() => {
		if (!data.projectId) return 'All projects';
		return data.filterProjectName ?? 'Project';
	});

	const projectSelectItems = $derived([
		{ value: '__all__', label: 'All projects' },
		...data.projectOptions.map((o) => ({
			value: o.id,
			label: `${'—'.repeat(Math.max(0, o.depth - 1))} ${o.name}`.trim()
		}))
	]);

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
	</p>

	<section class="mb-6 flex flex-col gap-4">
		<div class="space-y-2">
			<Label>Project filter</Label>
			<Select.Root
				type="single"
				value={data.projectId ?? '__all__'}
				onValueChange={(v) => {
					goto(tasksHref({ project: v === '__all__' || !v ? null : v }), {
						keepFocus: true,
						noScroll: true
					});
				}}
			>
				<Select.Trigger class="w-full max-w-md">{projectFilterLabel}</Select.Trigger>
				<Select.Content>
					{#each projectSelectItems as item (item.value)}
						<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

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
	projectOptions={data.projectOptions}
	defaultProjectId={data.projectId}
	errorMessage={sheetError}
	onSaved={onTaskSaved}
/>

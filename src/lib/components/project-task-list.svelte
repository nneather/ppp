<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import { cn } from '$lib/utils';
	import {
		TASK_PRIORITIES,
		TASK_PRIORITY_LABELS,
		type TaskPriority,
		type ProjectTaskView,
		type TaskZoneGroup
	} from '$lib/types/projects';
	import {
		PROJECT_COLOR_DOT_CLASS,
		PROJECT_COLOR_RAIL_CLASS,
		parseProjectColorKey
	} from '$lib/projects/project-colors';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import FileText from '@lucide/svelte/icons/file-text';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let {
		zones,
		deferred = [],
		completed = [],
		showProjectLabel = true,
		todayYmd,
		onEdit,
		onInvalidate
	}: {
		zones: TaskZoneGroup[];
		deferred?: ProjectTaskView[];
		completed?: ProjectTaskView[];
		showProjectLabel?: boolean;
		todayYmd: string;
		onEdit: (task: ProjectTaskView) => void;
		onInvalidate?: () => void | Promise<void>;
	} = $props();

	let deferOpen = $state(false);
	let deferTask = $state<ProjectTaskView | null>(null);
	let deferPriority = $state<TaskPriority>('over_horizon');
	let deferDate = $state('');

	const deferPriorityLabel = $derived(TASK_PRIORITY_LABELS[deferPriority]);

	function openDefer(task: ProjectTaskView) {
		deferTask = task;
		deferPriority = task.priority === 'critical_now' ? 'opportunity_now' : 'over_horizon';
		const d = new Date(`${todayYmd}T12:00:00Z`);
		d.setUTCDate(d.getUTCDate() + 7);
		const y = d.getUTCFullYear();
		const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
		const day = String(d.getUTCDate()).padStart(2, '0');
		deferDate = `${y}-${mo}-${day}`;
		deferOpen = true;
	}

	const actionEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update();
			if (result.type === 'success') {
				deferOpen = false;
				deferTask = null;
				await onInvalidate?.();
			}
		};
	};

	const zoneHeaderClass: Record<TaskPriority, string> = {
		critical_now: 'border-red-500/40 bg-red-500/5',
		opportunity_now: 'border-amber-500/40 bg-amber-500/5',
		over_horizon: 'border-muted-foreground/30 bg-muted/30'
	};
</script>

{#snippet taskRow(task: ProjectTaskView, completed = false)}
	{@const domainColor = parseProjectColorKey(task.domain_color)}
	<li
		class={cn(
			'flex flex-col gap-2 border-b border-border/60 px-3 py-2.5 last:border-b-0',
			domainColor && PROJECT_COLOR_RAIL_CLASS[domainColor],
			completed && 'opacity-70'
		)}
	>
		<div class="flex min-w-0 items-start gap-2">
			<form method="POST" action={completed ? '?/uncompleteTask' : '?/completeTask'} use:enhance={actionEnhance}>
				<input type="hidden" name="id" value={task.id} />
				<input
					type="checkbox"
					class="mt-1 size-4 shrink-0 rounded border-border"
					checked={completed}
					aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
					onchange={(e) => (e.currentTarget as HTMLInputElement).form?.requestSubmit()}
				/>
			</form>
			<div class="min-w-0 flex-1">
				<div class="flex min-w-0 items-start gap-1.5">
					<p class={cn('min-w-0 flex-1 break-words text-sm font-medium', completed && 'line-through')}>
						{task.title}
					</p>
					{#if task.notes && !completed}
						<button
							type="button"
							class="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
							title="Has notes — edit to read"
							aria-label="Open task notes"
							onclick={() => onEdit(task)}
						>
							<FileText class="size-3.5" />
						</button>
					{:else if task.notes}
						<span class="mt-0.5 shrink-0 text-muted-foreground" title="Has notes" aria-label="Has notes">
							<FileText class="size-3.5" />
						</span>
					{/if}
				</div>
				{#if showProjectLabel}
					<p class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
						{#if domainColor}
							<span
								class={cn('size-2 shrink-0 rounded-full', PROJECT_COLOR_DOT_CLASS[domainColor])}
								aria-hidden="true"
							></span>
						{/if}
						{task.project_name}
					</p>
				{/if}
				<p class="text-xs text-muted-foreground">Start {task.start_date}</p>
			</div>
			{#if !completed}
				<div class="flex shrink-0 flex-wrap justify-end gap-0.5">
					<form method="POST" action="?/promoteTask" use:enhance={actionEnhance}>
						<input type="hidden" name="id" value={task.id} />
						<Button
							type="submit"
							variant="ghost"
							size="icon-sm"
							aria-label="Promote (start today)"
							title="Promote — start today"
						>
							<ArrowUp class="size-4" />
						</Button>
					</form>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Defer"
						title="Defer to future date"
						onclick={() => openDefer(task)}
					>
						<CalendarClock class="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Edit task"
						onclick={() => onEdit(task)}
					>
						<Pencil class="size-4" />
					</Button>
					<form method="POST" action="?/softDeleteTask" use:enhance={actionEnhance}>
						<input type="hidden" name="id" value={task.id} />
						<Button
							type="submit"
							variant="ghost"
							size="icon-sm"
							class="text-destructive hover:text-destructive"
							aria-label="Delete task"
						>
							<Trash2 class="size-4" />
						</Button>
					</form>
				</div>
			{:else}
				<form method="POST" action="?/softDeleteTask" use:enhance={actionEnhance}>
					<input type="hidden" name="id" value={task.id} />
					<Button
						type="submit"
						variant="ghost"
						size="icon-sm"
						class="text-destructive hover:text-destructive"
						aria-label="Delete task"
					>
						<Trash2 class="size-4" />
					</Button>
				</form>
			{/if}
		</div>
	</li>
{/snippet}

{#each zones as zone (zone.priority)}
	<section class="mb-6">
		<div
			class={cn(
				'mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2',
				zoneHeaderClass[zone.priority]
			)}
		>
			<h2 class="text-sm font-semibold">{zone.label}</h2>
			<span class="text-xs text-muted-foreground">
				{zone.count}{zone.cap != null ? ` / ~${zone.cap}` : ''}
				{#if zone.overCap}
					<span class="font-medium text-amber-700 dark:text-amber-400"> — over cap</span>
				{/if}
			</span>
		</div>
		{#if zone.tasks.length === 0}
			<p class="px-3 text-sm text-muted-foreground italic">No open tasks in this zone.</p>
		{:else}
			<ul class="rounded-lg border border-border bg-card">
				{#each zone.tasks as task (task.id)}
					{@render taskRow(task, false)}
				{/each}
			</ul>
		{/if}
	</section>
{/each}

{#if deferred.length > 0}
	<section class="mb-6">
		<h2 class="mb-2 text-sm font-semibold text-muted-foreground">Deferred (future start)</h2>
		<ul class="rounded-lg border border-dashed border-border bg-muted/20">
			{#each deferred as task (task.id)}
				{@render taskRow(task, false)}
			{/each}
		</ul>
	</section>
{/if}

{#if completed.length > 0}
	<section class="mb-6">
		<h2 class="mb-2 text-sm font-semibold text-muted-foreground">Completed</h2>
		<ul class="rounded-lg border border-border bg-card/50">
			{#each completed as task (task.id)}
				{@render taskRow(task, true)}
			{/each}
		</ul>
	</section>
{/if}

<Dialog.Root bind:open={deferOpen}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Defer task</Dialog.Title>
			<Dialog.Description>
				Set a future start date and zone. Task stays hidden until that date.
			</Dialog.Description>
		</Dialog.Header>
		{#if deferTask}
			<form method="POST" action="?/deferTask" use:enhance={actionEnhance} class="flex flex-col gap-4">
				<input type="hidden" name="id" value={deferTask.id} />
				<p class="text-sm font-medium">{deferTask.title}</p>

				<div class="space-y-2">
					<Label>Zone when visible</Label>
					<Select.Root
						type="single"
						value={deferPriority}
						onValueChange={(v) => {
							if (v && (TASK_PRIORITIES as readonly string[]).includes(v)) {
								deferPriority = v as TaskPriority;
							}
						}}
					>
						<Select.Trigger class="w-full">{deferPriorityLabel}</Select.Trigger>
						<Select.Content>
							{#each TASK_PRIORITIES as p (p)}
								<Select.Item value={p} label={TASK_PRIORITY_LABELS[p]}>
									{TASK_PRIORITY_LABELS[p]}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="priority" value={deferPriority} />
				</div>

				<div class="space-y-2">
					<Label for="defer-date">Start date (must be after {todayYmd})</Label>
					<Input id="defer-date" name="start_date" type="date" bind:value={deferDate} required />
				</div>

				<Dialog.Footer class="gap-2 sm:justify-end">
					<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={() => (deferOpen = false)}>
						Cancel
					</Button>
					<Button type="submit" hotkey="s" label="Defer">Defer</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

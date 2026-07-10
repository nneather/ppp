<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Select from '$lib/components/ui/select';
	import { cn } from '$lib/utils';
	import { ymdInChicago } from '$lib/invoicing/chicago-date';
	import {
		TASK_PRIORITIES,
		TASK_PRIORITY_LABELS,
		type TaskPriority,
		type ProjectTaskView,
		type ProjectFlatOption
	} from '$lib/types/projects';

	let {
		open = $bindable(false),
		mode,
		task = null,
		projectOptions,
		defaultProjectId = null,
		errorMessage = null,
		onSaved
	}: {
		open?: boolean;
		mode: 'create' | 'edit';
		task?: ProjectTaskView | null;
		projectOptions: ProjectFlatOption[];
		defaultProjectId?: string | null;
		errorMessage?: string | null;
		onSaved?: () => void | Promise<void>;
	} = $props();

	let sheetSide: 'right' | 'bottom' = $state('bottom');
	let pending = $state(false);

	let title = $state('');
	let projectId = $state('');
	let priority = $state<TaskPriority>('opportunity_now');
	let startDate = $state('');
	let notes = $state('');

	const formAction = $derived(mode === 'create' ? '?/createTask' : '?/updateTask');
	const sheetTitle = $derived(mode === 'create' ? 'New task' : 'Edit task');

	const projectSelectItems = $derived(
		projectOptions.map((o) => ({
			value: o.id,
			label: `${'—'.repeat(Math.max(0, o.depth - 1))} ${o.name}`.trim()
		}))
	);

	const projectLabel = $derived.by(() => {
		const o = projectOptions.find((x) => x.id === projectId);
		return o?.name ?? 'Select project';
	});

	const priorityLabel = $derived(TASK_PRIORITY_LABELS[priority]);

	$effect(() => {
		if (!browser) return;
		const mq = window.matchMedia('(min-width: 768px)');
		const sync = () => {
			sheetSide = mq.matches ? 'right' : 'bottom';
		};
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});

	$effect(() => {
		if (!open) return;
		if (mode === 'edit' && task) {
			title = task.title;
			projectId = task.project_id;
			priority = task.priority;
			startDate = task.start_date;
			notes = task.notes ?? '';
		} else {
			title = '';
			projectId = defaultProjectId ?? projectOptions[0]?.id ?? '';
			priority = 'opportunity_now';
			startDate = ymdInChicago();
			notes = '';
		}
	});

	const submitEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update();
			if (result.type === 'success') {
				open = false;
				await onSaved?.();
			}
		};
	};
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side={sheetSide}
		class={cn(
			'flex w-full flex-col gap-0 p-0',
			sheetSide === 'bottom' && 'h-[min(92dvh,720px)] max-h-[92dvh] rounded-t-xl',
			sheetSide === 'right' && 'max-w-md sm:max-w-md'
		)}
	>
		<Sheet.Header class="shrink-0 border-b border-border px-4 pt-2 pb-4">
			<Sheet.Title>{sheetTitle}</Sheet.Title>
			<Sheet.Description class="text-muted-foreground">
				MYN zones and start date control visibility and sort order.
			</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action={formAction}
			use:enhance={submitEnhance}
			class="flex min-h-0 flex-1 flex-col"
		>
			<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
				{#if errorMessage}
					<p
						class="shrink-0 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
						role="alert"
					>
						{errorMessage}
					</p>
				{/if}

				{#if mode === 'edit' && task}
					<input type="hidden" name="id" value={task.id} />
				{/if}

				<div class="shrink-0 space-y-2">
					<Label for="task-title">Title</Label>
					<Input id="task-title" name="title" type="text" bind:value={title} required maxlength={500} />
				</div>

				<div class="shrink-0 space-y-2">
					<Label>Project</Label>
					<Select.Root
						type="single"
						value={projectId}
						onValueChange={(v) => {
							if (v) projectId = v;
						}}
					>
						<Select.Trigger class="w-full">{projectLabel}</Select.Trigger>
						<Select.Content class="max-h-72">
							{#each projectSelectItems as item (item.value)}
								<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="project_id" value={projectId} />
				</div>

				<div class="shrink-0 space-y-2">
					<Label>Urgency zone</Label>
					<Select.Root
						type="single"
						value={priority}
						onValueChange={(v) => {
							if (v && (TASK_PRIORITIES as readonly string[]).includes(v)) {
								priority = v as TaskPriority;
							}
						}}
					>
						<Select.Trigger class="w-full">{priorityLabel}</Select.Trigger>
						<Select.Content>
							{#each TASK_PRIORITIES as p (p)}
								<Select.Item value={p} label={TASK_PRIORITY_LABELS[p]}>
									{TASK_PRIORITY_LABELS[p]}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="priority" value={priority} />
				</div>

				<div class="shrink-0 space-y-2">
					<Label for="task-start">Start date</Label>
					<Input id="task-start" name="start_date" type="date" bind:value={startDate} required />
					<p class="text-xs text-muted-foreground">
						Today = top of zone (FRESH). Future date = deferred (hidden until then).
					</p>
				</div>

				<div class="flex min-h-48 flex-1 flex-col gap-2">
					<Label for="task-notes" class="shrink-0">Notes</Label>
					<textarea
						id="task-notes"
						name="notes"
						bind:value={notes}
						maxlength={10000}
						class="min-h-0 w-full flex-1 resize-none rounded-lg border border-input bg-background px-3 py-3 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
						placeholder="Optional details (e.g. forwarded email body)"
					></textarea>
				</div>
			</div>

			<div class="sticky bottom-0 flex shrink-0 flex-wrap gap-2 border-t border-border bg-popover px-4 py-3">
				<Button type="submit" hotkey={mode === 'create' ? 's' : 'u'} disabled={pending}>
					{pending ? 'Saving…' : mode === 'create' ? 'Add task' : 'Update task'}
				</Button>
				<Button
					type="button"
					variant="outline"
					hotkey="Escape"
					label="Cancel"
					onclick={() => (open = false)}
				/>
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>

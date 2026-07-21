<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Select from '$lib/components/ui/select';
	import * as Dialog from '$lib/components/ui/dialog';
	import { cn } from '$lib/utils';
	import { ymdInChicago } from '$lib/invoicing/chicago-date';
	import {
		TASK_PRIORITIES,
		TASK_PRIORITY_LABELS,
		type TaskPriority,
		type ProjectTaskView,
		type ProjectTaskSeriesView,
		type ProjectFlatOption
	} from '$lib/types/projects';
	import {
		defaultRuleFromStartDate,
		formatRecurrenceSummary,
		isoWeekdayFromYmd,
		monthDayFromYmd,
		type IsoWeekday,
		type RecurrenceEnds,
		type RecurrenceFreq,
		type RecurrenceRule,
		type TaskSeriesScope
	} from '$lib/projects/task-recurrence';

	const WEEKDAY_OPTIONS: { value: IsoWeekday; label: string }[] = [
		{ value: 1, label: 'Mon' },
		{ value: 2, label: 'Tue' },
		{ value: 3, label: 'Wed' },
		{ value: 4, label: 'Thu' },
		{ value: 5, label: 'Fri' },
		{ value: 6, label: 'Sat' },
		{ value: 7, label: 'Sun' }
	];

	let {
		open = $bindable(false),
		mode,
		task = null,
		series = null,
		projectOptions,
		defaultProjectId = null,
		errorMessage = null,
		onSaved
	}: {
		open?: boolean;
		mode: 'create' | 'edit';
		task?: ProjectTaskView | null;
		series?: ProjectTaskSeriesView | null;
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

	let recurring = $state(false);
	let freq = $state<RecurrenceFreq>('weekly');
	let interval = $state(1);
	let byweekday = $state<IsoWeekday[]>([1]);
	let bymonthday = $state(1);
	let ends = $state<RecurrenceEnds>('never');
	let endsCount = $state(10);
	let endsOn = $state('');

	let scopeDialogOpen = $state(false);
	let pendingScope = $state<TaskSeriesScope | null>(null);
	let formEl = $state<HTMLFormElement | null>(null);

	const isSeriesTask = $derived(mode === 'edit' && task?.series_id != null);
	const formAction = $derived(mode === 'create' ? '?/createTask' : '?/updateTask');
	const sheetTitle = $derived(mode === 'create' ? 'New task' : 'Edit task');

	const effectiveProjectOptions = $derived.by(() => {
		if (mode === 'edit' && task && !projectOptions.some((o) => o.id === task.project_id)) {
			return [
				...projectOptions,
				{
					id: task.project_id,
					name: task.project_name,
					parent_id: null,
					depth: 0
				}
			];
		}
		return projectOptions;
	});

	const projectSelectItems = $derived(
		effectiveProjectOptions.map((o) => ({
			value: o.id,
			label: o.name
		}))
	);

	const projectLabel = $derived.by(() => {
		const o = effectiveProjectOptions.find((x) => x.id === projectId);
		return o?.name ?? 'Select project';
	});

	const priorityLabel = $derived(TASK_PRIORITY_LABELS[priority]);

	const draftRule = $derived.by((): RecurrenceRule => ({
		freq,
		interval: Math.max(1, interval || 1),
		byweekday: freq === 'weekly' ? byweekday : null,
		bymonthday: freq === 'monthly' ? bymonthday : null,
		ends,
		ends_count: ends === 'after_count' ? endsCount : null,
		ends_on: ends === 'on_date' ? endsOn || null : null
	}));

	const recurrenceSummary = $derived(
		recurring ? formatRecurrenceSummary(draftRule) : 'Does not repeat'
	);

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
			if (series && task.series_id === series.id) {
				recurring = true;
				freq = series.freq;
				interval = series.interval;
				byweekday =
					series.byweekday && series.byweekday.length > 0
						? (series.byweekday.filter((d) => d >= 1 && d <= 7) as IsoWeekday[])
						: [isoWeekdayFromYmd(task.start_date) ?? 1];
				bymonthday = series.bymonthday ?? monthDayFromYmd(task.start_date) ?? 1;
				ends = series.ends;
				endsCount = series.ends_count ?? 10;
				endsOn = series.ends_on ?? '';
			} else {
				recurring = false;
			}
		} else {
			title = '';
			projectId = defaultProjectId ?? projectOptions[0]?.id ?? '';
			priority = 'opportunity_now';
			startDate = ymdInChicago();
			notes = '';
			recurring = false;
			const def = defaultRuleFromStartDate(ymdInChicago(), 'weekly');
			freq = def.freq;
			interval = def.interval;
			byweekday = def.byweekday ?? [1];
			bymonthday = def.bymonthday ?? 1;
			ends = 'never';
			endsCount = 10;
			endsOn = '';
		}
		pendingScope = null;
		scopeDialogOpen = false;
	});

	function syncDefaultsFromStartDate() {
		const iso = isoWeekdayFromYmd(startDate);
		const day = monthDayFromYmd(startDate);
		if (freq === 'weekly' && iso && byweekday.length === 0) {
			byweekday = [iso];
		}
		if (freq === 'monthly' && day) {
			bymonthday = day;
		}
	}

	function toggleWeekday(day: IsoWeekday) {
		if (byweekday.includes(day)) {
			if (byweekday.length === 1) return;
			byweekday = byweekday.filter((d) => d !== day);
		} else {
			byweekday = [...byweekday, day].sort((a, b) => a - b);
		}
	}

	function onFreqChange(v: string | undefined) {
		if (v !== 'weekly' && v !== 'monthly') return;
		freq = v;
		if (v === 'weekly') {
			byweekday = [isoWeekdayFromYmd(startDate) ?? 1];
		} else {
			bymonthday = monthDayFromYmd(startDate) ?? 1;
		}
	}

	function requestSave(e: SubmitEvent) {
		if (isSeriesTask && !pendingScope) {
			e.preventDefault();
			scopeDialogOpen = true;
		}
	}

	function confirmScope(scope: TaskSeriesScope) {
		pendingScope = scope;
		scopeDialogOpen = false;
		queueMicrotask(() => formEl?.requestSubmit());
	}

	const submitEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update();
			if (result.type === 'success') {
				open = false;
				pendingScope = null;
				await onSaved?.();
			} else {
				pendingScope = null;
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
			bind:this={formEl}
			method="POST"
			action={formAction}
			use:enhance={submitEnhance}
			onsubmit={requestSave}
			class="flex min-h-0 flex-1 flex-col"
		>
			{#if mode === 'edit' && task}
				<input type="hidden" name="id" value={task.id} />
			{/if}
			{#if isSeriesTask && pendingScope}
				<input type="hidden" name="scope" value={pendingScope} />
			{/if}

			<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
				{#if errorMessage}
					<p
						class="shrink-0 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
						role="alert"
					>
						{errorMessage}
					</p>
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
					<Input
						id="task-start"
						name="start_date"
						type="date"
						bind:value={startDate}
						required
						onchange={syncDefaultsFromStartDate}
					/>
					<p class="text-xs text-muted-foreground">
						Today = top of zone (FRESH). Future date = deferred (hidden until then).
					</p>
				</div>

				<div class="shrink-0 space-y-3 rounded-lg border border-border p-3">
					<div class="flex items-center justify-between gap-2">
						<Label for="task-recurring" class="text-sm font-medium">Make recurring</Label>
						<input
							id="task-recurring"
							type="checkbox"
							class="size-4 rounded border-border"
							checked={recurring}
							disabled={isSeriesTask}
							onchange={(e) => {
								recurring = (e.currentTarget as HTMLInputElement).checked;
								if (recurring) {
									const def = defaultRuleFromStartDate(startDate || ymdInChicago(), freq);
									byweekday = def.byweekday ?? byweekday;
									bymonthday = def.bymonthday ?? bymonthday;
								}
							}}
						/>
					</div>
					{#if isSeriesTask}
						<p class="text-xs text-muted-foreground">
							Recurrence edits apply only when you choose Entire series on save.
						</p>
					{/if}
					{#if recurring}
						<input type="hidden" name="recurring" value="1" />
						<input type="hidden" name="recurrence_freq" value={freq} />
						<input type="hidden" name="recurrence_interval" value={String(interval)} />
						<input type="hidden" name="recurrence_byweekday" value={byweekday.join(',')} />
						<input type="hidden" name="recurrence_bymonthday" value={String(bymonthday)} />
						<input type="hidden" name="recurrence_ends" value={ends} />
						{#if ends === 'after_count'}
							<input type="hidden" name="recurrence_ends_count" value={String(endsCount)} />
						{/if}
						{#if ends === 'on_date'}
							<input type="hidden" name="recurrence_ends_on" value={endsOn} />
						{/if}

						<div class="space-y-2">
							<Label>Frequency</Label>
							<Select.Root type="single" value={freq} onValueChange={onFreqChange}>
								<Select.Trigger class="w-full">
									{freq === 'weekly' ? 'Weekly' : 'Monthly'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="weekly" label="Weekly">Weekly</Select.Item>
									<Select.Item value="monthly" label="Monthly">Monthly</Select.Item>
								</Select.Content>
							</Select.Root>
						</div>

						<div class="space-y-2">
							<Label for="task-interval">
								Every {interval}
								{freq === 'weekly' ? (interval === 1 ? 'week' : 'weeks') : interval === 1 ? 'month' : 'months'}
							</Label>
							<Input
								id="task-interval"
								type="number"
								min="1"
								max="99"
								bind:value={interval}
							/>
						</div>

						{#if freq === 'weekly'}
							<div class="space-y-2">
								<Label>On days</Label>
								<div class="flex flex-wrap gap-1.5">
									{#each WEEKDAY_OPTIONS as day (day.value)}
										<button
											type="button"
											class={cn(
												'rounded-md border px-2.5 py-1 text-xs font-medium',
												byweekday.includes(day.value)
													? 'border-primary bg-primary text-primary-foreground'
													: 'border-border bg-background text-muted-foreground hover:bg-muted'
											)}
											onclick={() => toggleWeekday(day.value)}
										>
											{day.label}
										</button>
									{/each}
								</div>
							</div>
						{:else}
							<p class="text-sm text-muted-foreground">On day {bymonthday} of the month</p>
						{/if}

						<div class="space-y-2">
							<Label>Ends</Label>
							<Select.Root
								type="single"
								value={ends}
								onValueChange={(v) => {
									if (v === 'never' || v === 'after_count' || v === 'on_date') ends = v;
								}}
							>
								<Select.Trigger class="w-full">
									{ends === 'never' ? 'Never' : ends === 'after_count' ? 'After N occurrences' : 'On date'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="never" label="Never">Never</Select.Item>
									<Select.Item value="after_count" label="After N occurrences">After N occurrences</Select.Item>
									<Select.Item value="on_date" label="On date">On date</Select.Item>
								</Select.Content>
							</Select.Root>
							{#if ends === 'after_count'}
								<Input type="number" min="1" max="999" bind:value={endsCount} aria-label="Occurrence count" />
							{:else if ends === 'on_date'}
								<Input type="date" bind:value={endsOn} required aria-label="End date" />
							{/if}
						</div>

						<p class="text-xs text-muted-foreground">{recurrenceSummary}</p>
					{/if}
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

<Dialog.Root bind:open={scopeDialogOpen}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Update recurring task</Dialog.Title>
			<Dialog.Description>
				Apply changes to this occurrence only, or to the entire series (template + future
				occurrences).
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="flex flex-col gap-2 sm:flex-col">
			<Button type="button" hotkey="s" label="This task" onclick={() => confirmScope('this')}>
				This task
			</Button>
			<Button
				type="button"
				variant="secondary"
				onclick={() => confirmScope('series')}
			>
				Entire series
			</Button>
			<Button
				type="button"
				variant="outline"
				hotkey="Escape"
				label="Cancel"
				onclick={() => (scopeDialogOpen = false)}
			>
				Cancel
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

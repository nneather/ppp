<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { addDaysYmd, nextMondayYmdChicago } from '$lib/invoicing/chicago-date';
	import { dueDateForPreset } from '$lib/classwork/due-presets';
	import {
		ASSIGNMENT_KIND_LABELS,
		ASSIGNMENT_STATUSES,
		ASSIGNMENT_STATUS_LABELS,
		type AssignmentListRow,
		type AssignmentStatus
	} from '$lib/types/classwork';
	import { cn } from '$lib/utils';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let {
		assignment,
		showCourse = false,
		todayYmd,
		isOwner = false,
		variant = 'full',
		/** Form action base: `?` on /classwork, `/classwork?` from dashboard. */
		actionPrefix = '?',
		formatDate,
		daysLabel,
		onEdit,
		onDelete
	}: {
		assignment: AssignmentListRow;
		showCourse?: boolean;
		todayYmd: string;
		isOwner?: boolean;
		variant?: 'full' | 'compact';
		actionPrefix?: string;
		formatDate: (ymd: string) => string;
		daysLabel?: (a: AssignmentListRow) => string | null;
		onEdit?: (a: AssignmentListRow) => void;
		onDelete?: (a: AssignmentListRow) => void;
	} = $props();

	const isDone = $derived(assignment.status === 'done');

	function action(name: string): string {
		return `${actionPrefix}/${name}`;
	}

	const rowEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				await invalidate('app:classwork:list');
			}
		};
	};

	let rescheduleOpen = $state(false);
	let rescheduleDate = $state('');
	let statusFormEl = $state<HTMLFormElement | null>(null);
	let statusHidden = $state<AssignmentStatus>('not_started');

	$effect(() => {
		statusHidden = assignment.status;
	});

	const tomorrowYmd = $derived(addDaysYmd(todayYmd, 1) ?? todayYmd);
	const nextMondayYmd = $derived(nextMondayYmdChicago(todayYmd));
	const plusOneWeekYmd = $derived(addDaysYmd(todayYmd, 7) ?? todayYmd);

	function openReschedule() {
		rescheduleDate = assignment.due_date;
		rescheduleOpen = true;
	}

	function applyPreset(kind: 'tomorrow' | 'monday' | 'week') {
		rescheduleDate = dueDateForPreset(kind, todayYmd) ?? rescheduleDate;
	}

	const statusLabel = $derived(ASSIGNMENT_STATUS_LABELS[assignment.status]);
</script>

<li
	class={cn(
		variant === 'full' && 'rounded-lg border border-border px-3 py-2.5',
		variant === 'compact' && 'py-2 first:pt-0 last:pb-0',
		isDone && variant === 'full' && 'opacity-60',
		assignment.days_until != null &&
			assignment.days_until < 0 &&
			!isDone &&
			variant === 'full' &&
			'border-destructive/40'
	)}
>
	<div class="flex items-start gap-2">
		{#if isOwner}
			<form
				method="POST"
				action={isDone ? action('uncompleteAssignment') : action('completeAssignment')}
				use:enhance={rowEnhance}
				class="shrink-0"
			>
				<input type="hidden" name="assignment_id" value={assignment.id} />
				<input
					type="checkbox"
					class="mt-1 size-4 rounded border-border"
					checked={isDone}
					aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
					onchange={(e) => (e.currentTarget as HTMLInputElement).form?.requestSubmit()}
				/>
			</form>
		{/if}

		<div class="min-w-0 flex-1">
			{#if variant === 'compact'}
				<p
					class={cn(
						'text-xs font-medium tracking-wide uppercase',
						assignment.days_until != null && assignment.days_until < 0
							? 'text-destructive'
							: 'text-muted-foreground'
					)}
				>
					{#if daysLabel}
						{daysLabel(assignment) ?? ''}
					{/if}
					<span class="ml-1.5 normal-case tracking-normal">
						· {formatDate(assignment.due_date)}
					</span>
				</p>
			{/if}

			{#if isOwner && onEdit && variant === 'full'}
				<button
					type="button"
					class="min-w-0 text-left"
					onclick={() => onEdit(assignment)}
				>
					<p class="text-sm font-medium">
						{#if assignment.parent_id}
							<span class="text-muted-foreground">↳ </span>
						{/if}
						{assignment.title}
					</p>
				</button>
			{:else}
				<p class={cn('text-sm font-medium', isDone && 'line-through')}>
					{#if assignment.parent_id && variant === 'full'}
						<span class="text-muted-foreground">↳ </span>
					{/if}
					{assignment.title}
				</p>
			{/if}

			{#if variant === 'full'}
				<p class="mt-0.5 text-xs text-muted-foreground">
					{ASSIGNMENT_KIND_LABELS[assignment.kind]}
					· {statusLabel}
					{#if showCourse}
						· {assignment.course_code ?? assignment.course_name}
					{:else}
						· {formatDate(assignment.due_date)}
					{/if}
					{#if daysLabel?.(assignment)}
						· <span
							class={cn(
								assignment.days_until != null &&
									assignment.days_until < 0 &&
									'font-medium text-destructive'
							)}>{daysLabel(assignment)}</span
						>
					{/if}
				</p>
			{:else}
				<p class="mt-0.5 text-xs text-muted-foreground">
					{assignment.course_code?.trim() || assignment.course_name}
					<span aria-hidden="true"> · </span>
					{ASSIGNMENT_KIND_LABELS[assignment.kind]}
				</p>
			{/if}

			{#if isOwner && variant === 'full'}
				<form
					bind:this={statusFormEl}
					method="POST"
					action={action('setAssignmentStatus')}
					use:enhance={rowEnhance}
					class="mt-1.5"
				>
					<input type="hidden" name="assignment_id" value={assignment.id} />
					<input type="hidden" name="status" value={statusHidden} />
					<Select.Root
						type="single"
						value={assignment.status}
						onValueChange={(v) => {
							if (!v || !(ASSIGNMENT_STATUSES as readonly string[]).includes(v)) return;
							if (v === assignment.status) return;
							statusHidden = v as AssignmentStatus;
							queueMicrotask(() => statusFormEl?.requestSubmit());
						}}
					>
						<Select.Trigger
							class="h-7 w-[8.5rem] text-xs"
							aria-label="Assignment status"
						>
							{statusLabel}
						</Select.Trigger>
						<Select.Content>
							{#each ASSIGNMENT_STATUSES as s (s)}
								<Select.Item value={s} label={ASSIGNMENT_STATUS_LABELS[s]}>
									{ASSIGNMENT_STATUS_LABELS[s]}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</form>
			{/if}

			{#if isOwner && variant === 'compact'}
				<div class="mt-1.5 flex flex-wrap gap-1.5">
					<Button
						type="button"
						size="sm"
						variant="outline"
						class="h-7 gap-1 px-2 text-xs"
						onclick={openReschedule}
					>
						<CalendarClock class="size-3.5" />
						Due
					</Button>
					<a
						href="/classwork?group=date"
						class="inline-flex h-7 items-center px-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
					>
						Open
					</a>
				</div>
			{/if}
		</div>

		{#if isOwner && variant === 'full'}
			<div class="flex shrink-0 gap-1">
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					aria-label="Reschedule due date"
					title="Reschedule due date"
					onclick={openReschedule}
				>
					<CalendarClock class="size-3.5" />
				</Button>
				{#if onEdit}
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Edit assignment"
						onclick={() => onEdit(assignment)}
					>
						<Pencil class="size-3.5" />
					</Button>
				{/if}
				{#if onDelete}
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						class="text-destructive"
						aria-label="Delete assignment"
						onclick={() => onDelete(assignment)}
					>
						<Trash2 class="size-3.5" />
					</Button>
				{/if}
			</div>
		{/if}
	</div>
</li>

{#if isOwner}
	<Dialog.Root bind:open={rescheduleOpen}>
		<Dialog.Content class="max-w-sm">
			<Dialog.Header>
				<Dialog.Title>Move due date</Dialog.Title>
				<Dialog.Description>
					Change when “{assignment.title}” is due. Status stays the same.
				</Dialog.Description>
			</Dialog.Header>
			<form
				method="POST"
				action={action('rescheduleAssignment')}
				use:enhance={() => {
					return async ({ result, update }) => {
						await update({ reset: false });
						if (result.type === 'success') {
							rescheduleOpen = false;
							await invalidate('app:classwork:list');
						}
					};
				}}
				class="flex flex-col gap-4"
			>
				<input type="hidden" name="assignment_id" value={assignment.id} />

				<div class="space-y-2">
					<Label>Presets</Label>
					<div class="flex flex-wrap gap-1.5">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => applyPreset('tomorrow')}
						>
							Tomorrow ({tomorrowYmd})
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => applyPreset('monday')}
						>
							Next Monday ({nextMondayYmd})
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => applyPreset('week')}
						>
							+1 week ({plusOneWeekYmd})
						</Button>
					</div>
				</div>

				<div class="space-y-2">
					<Label for={`due-${assignment.id}`}>Due date</Label>
					<Input
						id={`due-${assignment.id}`}
						name="due_date"
						type="date"
						bind:value={rescheduleDate}
						required
					/>
				</div>

				<Dialog.Footer class="gap-2">
					<Button
						type="button"
						variant="outline"
						hotkey="Escape"
						label="Cancel"
						onclick={() => (rescheduleOpen = false)}
					>
						Cancel
					</Button>
					<Button type="submit" hotkey="s" label="Save due date">Save due date</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Root>
{/if}

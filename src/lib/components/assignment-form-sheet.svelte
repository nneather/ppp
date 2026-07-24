<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Select from '$lib/components/ui/select';
	import { parentPickerOptions } from '$lib/classwork/parent-picker';
	import {
		ASSIGNMENT_KINDS,
		ASSIGNMENT_KIND_LABELS,
		ASSIGNMENT_STATUSES,
		ASSIGNMENT_STATUS_LABELS,
		type AssignmentKind,
		type AssignmentListRow,
		type AssignmentStatus,
		type CourseRow
	} from '$lib/types/classwork';

	const NONE = '__none__';

	let {
		open = $bindable(false),
		mode,
		assignment = null,
		courses = [],
		allAssignments = [],
		defaultCourseId = null,
		defaultDueDate = '',
		errorMessage = null,
		onSaved
	}: {
		open?: boolean;
		mode: 'create' | 'edit';
		assignment?: AssignmentListRow | null;
		courses?: CourseRow[];
		allAssignments?: AssignmentListRow[];
		defaultCourseId?: string | null;
		defaultDueDate?: string;
		errorMessage?: string | null;
		onSaved?: () => void | Promise<void>;
	} = $props();

	let sheetSide: 'right' | 'bottom' = $state('bottom');
	let pending = $state(false);

	let courseId = $state('');
	let title = $state('');
	let kind = $state<AssignmentKind>('other');
	let status = $state<AssignmentStatus>('not_started');
	let dueDate = $state('');
	let parentId = $state('');
	let notes = $state('');

	const formAction = $derived(mode === 'create' ? '?/createAssignment' : '?/updateAssignment');
	const sheetTitle = $derived(mode === 'create' ? 'New assignment' : 'Edit assignment');

	const parentCandidates = $derived(
		parentPickerOptions(
			allAssignments,
			courseId,
			mode === 'edit' && assignment ? assignment.id : null
		)
	);

	const parentSelectValue = $derived(parentId || NONE);
	const parentLabel = $derived.by(() => {
		if (!parentId) return 'No parent (top-level)';
		return parentCandidates.find((a) => a.id === parentId)?.title ?? 'Select parent';
	});

	const courseLabel = $derived.by(() => {
		if (!courseId) return 'Select course';
		const c = courses.find((x) => x.id === courseId);
		if (!c) return 'Select course';
		return c.code ? `${c.code} · ${c.name}` : c.name;
	});

	function seedFromAssignment() {
		if (mode === 'edit' && assignment) {
			courseId = assignment.course_id;
			title = assignment.title;
			kind = assignment.kind;
			status = assignment.status;
			dueDate = assignment.due_date;
			parentId = assignment.parent_id ?? '';
			notes = assignment.notes ?? '';
		} else {
			courseId = defaultCourseId ?? courses[0]?.id ?? '';
			title = '';
			kind = 'other';
			status = 'not_started';
			dueDate = defaultDueDate;
			parentId = '';
			notes = '';
		}
	}

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
		untrack(() => seedFromAssignment());
	});

	// Clear parent if course changes and parent is no longer valid.
	$effect(() => {
		if (!parentId || !courseId) return;
		if (!parentCandidates.some((a) => a.id === parentId)) {
			parentId = '';
		}
	});

	const onSubmit: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				open = false;
				await onSaved?.();
			}
		};
	};
</script>

<Sheet.Root bind:open>
	<Sheet.Content side={sheetSide} class="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
		<Sheet.Header class="shrink-0 border-b border-border pb-4">
			<Sheet.Title>{sheetTitle}</Sheet.Title>
			<Sheet.Description class="text-sm text-muted-foreground">
				Due date is required. Undated work belongs in Tasks, not here.
			</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action={formAction}
			use:enhance={onSubmit}
			class="flex flex-1 flex-col gap-4 px-1 py-4"
		>
			{#if mode === 'edit' && assignment}
				<input type="hidden" name="assignment_id" value={assignment.id} />
			{/if}

			{#if errorMessage}
				<p
					class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
					role="alert"
				>
					{errorMessage}
				</p>
			{/if}

			<div class="space-y-2">
				<Label>Course</Label>
				<input type="hidden" name="course_id" value={courseId} />
				<Select.Root
					type="single"
					value={courseId || NONE}
					onValueChange={(v) => {
						if (v && v !== NONE) courseId = v;
					}}
				>
					<Select.Trigger class="w-full" size="lg">{courseLabel}</Select.Trigger>
					<Select.Content>
						{#each courses as c (c.id)}
							<Select.Item value={c.id}>
								{c.code ? `${c.code} · ${c.name}` : c.name}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<div class="space-y-2">
				<Label for="assignment_title">Title</Label>
				<Input
					id="assignment_title"
					name="title"
					bind:value={title}
					required
					placeholder="Exegesis paper — final"
				/>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-2">
					<Label>Kind</Label>
					<input type="hidden" name="kind" value={kind} />
					<Select.Root
						type="single"
						value={kind}
						onValueChange={(v) => {
							if (v && (ASSIGNMENT_KINDS as readonly string[]).includes(v)) {
								kind = v as AssignmentKind;
							}
						}}
					>
						<Select.Trigger class="w-full" size="lg">{ASSIGNMENT_KIND_LABELS[kind]}</Select.Trigger>
						<Select.Content>
							{#each ASSIGNMENT_KINDS as k (k)}
								<Select.Item value={k}>{ASSIGNMENT_KIND_LABELS[k]}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2">
					<Label>Status</Label>
					<input type="hidden" name="status" value={status} />
					<Select.Root
						type="single"
						value={status}
						onValueChange={(v) => {
							if (v && (ASSIGNMENT_STATUSES as readonly string[]).includes(v)) {
								status = v as AssignmentStatus;
							}
						}}
					>
						<Select.Trigger class="w-full" size="lg"
							>{ASSIGNMENT_STATUS_LABELS[status]}</Select.Trigger
						>
						<Select.Content>
							{#each ASSIGNMENT_STATUSES as s (s)}
								<Select.Item value={s}>{ASSIGNMENT_STATUS_LABELS[s]}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<div class="space-y-2">
				<Label for="due_date">Due date</Label>
				<Input id="due_date" name="due_date" type="date" bind:value={dueDate} required />
			</div>

			<div class="space-y-2">
				<Label>Parent (milestone)</Label>
				<input type="hidden" name="parent_id" value={parentId} />
				<Select.Root
					type="single"
					value={parentSelectValue}
					onValueChange={(v) => {
						parentId = !v || v === NONE ? '' : v;
					}}
				>
					<Select.Trigger class="w-full" size="lg">{parentLabel}</Select.Trigger>
					<Select.Content>
						<Select.Item value={NONE}>No parent (top-level)</Select.Item>
						{#each parentCandidates as a (a.id)}
							<Select.Item value={a.id}>{a.title}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<p class="text-xs text-muted-foreground">
					Same course only. Order under a parent follows due date.
				</p>
			</div>

			<div class="space-y-2">
				<Label for="assignment_notes">Notes</Label>
				<textarea
					id="assignment_notes"
					name="notes"
					bind:value={notes}
					rows={3}
					class="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				></textarea>
			</div>

			<div class="sticky bottom-0 mt-auto flex gap-2 border-t border-border bg-background pt-4 pb-1">
				<Button
					type="button"
					variant="outline"
					hotkey="Escape"
					label="Cancel"
					onclick={() => (open = false)}
				/>
				<Button
					type="submit"
					hotkey={mode === 'create' ? 's' : 'u'}
					label={pending
						? 'Saving…'
						: mode === 'create'
							? 'Save assignment'
							: 'Update assignment'}
					disabled={pending || !title.trim() || !dueDate || !courseId}
				/>
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>

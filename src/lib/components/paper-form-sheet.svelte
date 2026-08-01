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
	import {
		PAPER_STATUSES,
		PAPER_STATUS_LABELS,
		type AssignmentListRow,
		type CourseRow,
		type PaperRow,
		type PaperStatus
	} from '$lib/types/classwork';

	const NONE = '__none__';

	let {
		open = $bindable(false),
		mode,
		paper = null,
		courses = [],
		assignments = [],
		linkedAssignmentIds = [],
		errorMessage = null,
		onSaved
	}: {
		open?: boolean;
		mode: 'create' | 'edit';
		paper?: PaperRow | null;
		courses?: CourseRow[];
		assignments?: AssignmentListRow[];
		/** Assignment ids already taken by another live paper (1:1 guard). */
		linkedAssignmentIds?: string[];
		errorMessage?: string | null;
		onSaved?: () => void | Promise<void>;
	} = $props();

	let sheetSide: 'right' | 'bottom' = $state('bottom');
	let pending = $state(false);

	let title = $state('');
	let status = $state<PaperStatus>('draft');
	let assignmentId = $state('');
	let courseId = $state('');
	let dueDate = $state('');
	let topic = $state('');
	let passageDisplay = $state('');
	let notes = $state('');

	const formAction = $derived(mode === 'create' ? '?/createPaper' : '?/updatePaper');
	const sheetTitle = $derived(mode === 'create' ? 'New paper' : 'Edit paper');

	const takenIds = $derived(new Set(linkedAssignmentIds.filter((id) => id !== paper?.assignment_id)));
	const assignmentCandidates = $derived(assignments.filter((a) => !takenIds.has(a.id)));

	const linkedAssignment = $derived(
		assignmentId ? (assignments.find((a) => a.id === assignmentId) ?? null) : null
	);

	/** P1 stamp + lock: course/due derive from the assignment while linked. */
	const linked = $derived(linkedAssignment != null);
	const effectiveCourseId = $derived(linked ? linkedAssignment!.course_id : courseId);
	const effectiveDueDate = $derived(linked ? linkedAssignment!.due_date : dueDate);

	const assignmentLabel = $derived.by(() => {
		if (!assignmentId) return 'No assignment (independent)';
		return linkedAssignment?.title ?? 'Select assignment';
	});

	const courseLabel = $derived.by(() => {
		if (!effectiveCourseId) return 'No course';
		const c = courses.find((x) => x.id === effectiveCourseId);
		if (!c) return 'No course';
		return c.code ? `${c.code} · ${c.name}` : c.name;
	});

	function seedFromPaper() {
		if (mode === 'edit' && paper) {
			title = paper.title;
			status = paper.status;
			assignmentId = paper.assignment_id ?? '';
			courseId = paper.course_id ?? '';
			dueDate = paper.due_date ?? '';
			topic = paper.topic ?? '';
			passageDisplay = paper.passage_display ?? '';
			notes = paper.notes ?? '';
		} else {
			title = '';
			status = 'draft';
			assignmentId = '';
			courseId = '';
			dueDate = '';
			topic = '';
			passageDisplay = '';
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
		untrack(() => seedFromPaper());
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
				Research papers carry the bibliography. When linked to an assignment, course and due
				date follow the assignment.
			</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action={formAction}
			use:enhance={onSubmit}
			class="flex flex-1 flex-col gap-4 px-1 py-4"
		>
			{#if mode === 'edit' && paper}
				<input type="hidden" name="paper_id" value={paper.id} />
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
				<Label for="paper_title">Title</Label>
				<Input
					id="paper_title"
					name="title"
					bind:value={title}
					required
					placeholder="Exegesis of Psalm 110"
				/>
			</div>

			<div class="space-y-2">
				<Label>Status</Label>
				<input type="hidden" name="status" value={status} />
				<Select.Root
					type="single"
					value={status}
					onValueChange={(v) => {
						if (v && (PAPER_STATUSES as readonly string[]).includes(v)) {
							status = v as PaperStatus;
						}
					}}
				>
					<Select.Trigger class="w-full" size="lg">{PAPER_STATUS_LABELS[status]}</Select.Trigger>
					<Select.Content>
						{#each PAPER_STATUSES as s (s)}
							<Select.Item value={s}>{PAPER_STATUS_LABELS[s]}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<div class="space-y-2">
				<Label>Assignment</Label>
				<input type="hidden" name="assignment_id" value={assignmentId} />
				<Select.Root
					type="single"
					value={assignmentId || NONE}
					onValueChange={(v) => {
						assignmentId = !v || v === NONE ? '' : v;
					}}
				>
					<Select.Trigger class="w-full" size="lg">{assignmentLabel}</Select.Trigger>
					<Select.Content>
						<Select.Item value={NONE}>No assignment (independent)</Select.Item>
						{#each assignmentCandidates as a (a.id)}
							<Select.Item value={a.id}>
								{a.title} · {a.course_code ?? a.course_name}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<p class="text-xs text-muted-foreground">
					One paper per assignment. Assignments already linked to another paper are hidden.
				</p>
			</div>

			<div class="space-y-2">
				<Label>Course</Label>
				<input type="hidden" name="course_id" value={effectiveCourseId} />
				{#if linked}
					<p
						class="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground"
					>
						{courseLabel} — from assignment
					</p>
				{:else}
					<Select.Root
						type="single"
						value={courseId || NONE}
						onValueChange={(v) => {
							courseId = !v || v === NONE ? '' : v;
						}}
					>
						<Select.Trigger class="w-full" size="lg">{courseLabel}</Select.Trigger>
						<Select.Content>
							<Select.Item value={NONE}>No course</Select.Item>
							{#each courses as c (c.id)}
								<Select.Item value={c.id}>
									{c.code ? `${c.code} · ${c.name}` : c.name}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="paper_due_date">Target / due date</Label>
				{#if linked}
					<p
						class="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground"
					>
						{effectiveDueDate} — from assignment
					</p>
					<input type="hidden" name="due_date" value={effectiveDueDate} />
				{:else}
					<Input id="paper_due_date" name="due_date" type="date" bind:value={dueDate} />
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="paper_topic">Topic / thesis</Label>
				<textarea
					id="paper_topic"
					name="topic"
					bind:value={topic}
					rows={2}
					class="flex min-h-[56px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				></textarea>
			</div>

			<div class="space-y-2">
				<Label for="paper_passage">Primary passage</Label>
				<Input
					id="paper_passage"
					name="passage_display"
					bind:value={passageDisplay}
					placeholder="Psalm 110:1–4"
				/>
			</div>

			<div class="space-y-2">
				<Label for="paper_notes">Notes</Label>
				<textarea
					id="paper_notes"
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
					label={pending ? 'Saving…' : mode === 'create' ? 'Save paper' : 'Update paper'}
					disabled={pending || !title.trim()}
				/>
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>

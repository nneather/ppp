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
	import SearchableSelect from '$lib/components/searchable-select.svelte';
	import { assignmentsForCourse, reconcileAssignmentForCourse } from '$lib/classwork/paper-pickers';
	import {
		PAPER_STATUSES,
		PAPER_STATUS_LABELS,
		type AssignmentListRow,
		type CourseRow,
		type PaperRow,
		type PaperStatus
	} from '$lib/types/classwork';

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
	let duplicateWarning = $state<string | null>(null);

	let title = $state('');
	let status = $state<PaperStatus>('researching');
	let assignmentId = $state('');
	let courseId = $state('');
	let dueDate = $state('');
	let topic = $state('');
	let passageDisplay = $state('');
	let topical = $state(true);
	let notes = $state('');

	const formAction = $derived(mode === 'create' ? '?/createPaper' : '?/updatePaper');
	const sheetTitle = $derived(mode === 'create' ? 'New paper' : 'Edit paper');

	const takenIds = $derived(
		new Set(linkedAssignmentIds.filter((id) => id !== paper?.assignment_id))
	);
	const assignmentCandidates = $derived(
		assignmentsForCourse(assignments, courseId).filter((a) => !takenIds.has(a.id))
	);

	const linkedAssignment = $derived(
		assignmentId ? (assignments.find((a) => a.id === assignmentId) ?? null) : null
	);

	/** Due date follows the assignment while linked; the course is always editable (assignment list filters by it). */
	const linked = $derived(linkedAssignment != null);
	const effectiveCourseId = $derived(courseId);
	const effectiveDueDate = $derived(linked ? linkedAssignment!.due_date : dueDate);

	const courseOptions = $derived(
		courses.map((c) => ({ value: c.id, label: c.code ? `${c.code} · ${c.name}` : c.name }))
	);
	const assignmentOptions = $derived(
		assignmentCandidates.map((a) => ({
			value: a.id,
			label: a.title,
			hint: courseId ? a.due_date : (a.course_code ?? a.course_name)
		}))
	);

	function onCourseChange(v: string) {
		courseId = v;
		assignmentId = reconcileAssignmentForCourse(assignmentId, courseId, assignments);
	}
	function onAssignmentChange(v: string) {
		assignmentId = v;
		const a = v ? assignments.find((x) => x.id === v) : null;
		if (a) courseId = a.course_id;
	}

	function seedFromPaper() {
		if (mode === 'edit' && paper) {
			title = paper.title;
			status = paper.status;
			assignmentId = paper.assignment_id ?? '';
			courseId =
				(paper.assignment_id
					? assignments.find((a) => a.id === paper!.assignment_id)?.course_id
					: null) ??
				paper.course_id ??
				'';
			dueDate = paper.due_date ?? '';
			topic = paper.topic ?? '';
			passageDisplay = paper.passage_display ?? '';
			topical = paper.topical;
			notes = paper.notes ?? '';
		} else {
			title = '';
			status = 'researching';
			assignmentId = '';
			courseId = '';
			dueDate = '';
			topic = '';
			passageDisplay = '';
			topical = true;
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
		untrack(() => {
			seedFromPaper();
			duplicateWarning = null;
		});
	});

	const onSubmit: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			if (result.type === 'failure') {
				const data = result.data as { needsConfirm?: boolean; message?: string } | undefined;
				duplicateWarning = data?.needsConfirm
					? (data.message ?? 'A similar paper already exists.')
					: null;
			} else {
				duplicateWarning = null;
			}
			// Create redirects to the new paper. `update` follows that.
			if (result.type === 'redirect') open = false;
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
				Research papers carry the bibliography. When linked to an assignment, course and due date
				follow the assignment.
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

			{#if duplicateWarning}
				<p
					class="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
					role="status"
				>
					{duplicateWarning} Create another anyway?
				</p>
			{:else if errorMessage}
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
				<Label>Course</Label>
				<input type="hidden" name="course_id" value={effectiveCourseId} />
				<SearchableSelect
					options={courseOptions}
					value={courseId}
					onChange={onCourseChange}
					noneLabel="No course"
					placeholder="Search courses…"
					emptyMessage="No matching courses."
				/>
			</div>

			<div class="space-y-2">
				<Label>Assignment</Label>
				<input type="hidden" name="assignment_id" value={assignmentId} />
				<SearchableSelect
					options={assignmentOptions}
					value={assignmentId}
					onChange={onAssignmentChange}
					noneLabel="No assignment (independent)"
					placeholder="Search assignments…"
					emptyMessage={courseId
						? 'No available assignments for this course.'
						: 'No matching assignments.'}
				/>
				<p class="text-xs text-muted-foreground">
					{courseId ? 'Showing this course’s assignments. ' : ''}One paper per assignment;
					assignments already linked to another paper are hidden.
				</p>
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
					class="flex min-h-[56px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				></textarea>
			</div>

			<div class="space-y-2">
				<input type="hidden" name="topical" value={topical ? 'true' : 'false'} />
				<label class="flex items-start gap-2 text-sm">
					<input
						type="checkbox"
						class="mt-0.5 size-4"
						checked={topical}
						onchange={(e) => (topical = e.currentTarget.checked)}
					/>
					<span>
						Topical
						<span class="mt-0.5 block text-xs text-muted-foreground">
							Off suggests the passage commentaries, language tools, and Systematic Theology.
						</span>
					</span>
				</label>
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
					class="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				></textarea>
			</div>

			<div
				class="sticky bottom-0 mt-auto flex gap-2 border-t border-border bg-background pt-4 pb-1"
			>
				<Button
					type="button"
					variant="outline"
					hotkey="Escape"
					label="Cancel"
					onclick={() => (open = false)}
				/>
				{#if mode === 'create' && duplicateWarning}
					<input type="hidden" name="confirm_duplicate" value="yes" />
					<Button
						type="submit"
						hotkey="s"
						label={pending ? 'Saving…' : 'Create anyway'}
						disabled={pending || !title.trim()}
					/>
				{:else}
					<Button
						type="submit"
						hotkey={mode === 'create' ? 's' : 'u'}
						label={pending ? 'Saving…' : mode === 'create' ? 'Save paper' : 'Update paper'}
						disabled={pending || !title.trim()}
					/>
				{/if}
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import PageHeader from '$lib/components/page-header.svelte';
	import CourseFormSheet from '$lib/components/course-form-sheet.svelte';
	import AssignmentFormSheet from '$lib/components/assignment-form-sheet.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import {
		ASSIGNMENT_KIND_LABELS,
		ASSIGNMENT_STATUS_LABELS,
		type AssignmentListRow,
		type ClassworkGroup,
		type CourseRow
	} from '$lib/types/classwork';
	import { cn } from '$lib/utils';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type FormShape = {
		kind?: string;
		message?: string;
		success?: boolean;
		courseId?: string;
		assignmentId?: string;
	};
	const f = $derived((form ?? null) as FormShape | null);

	let courseSheetOpen = $state(false);
	let courseSheetMode = $state<'create' | 'edit'>('create');
	let editingCourse = $state<CourseRow | null>(null);

	let assignmentSheetOpen = $state(false);
	let assignmentSheetMode = $state<'create' | 'edit'>('create');
	let editingAssignment = $state<AssignmentListRow | null>(null);

	let deleteOpen = $state(false);
	let deleteKind = $state<'course' | 'assignment'>('assignment');
	let deleteCourse = $state<CourseRow | null>(null);
	let deleteAssignment = $state<AssignmentListRow | null>(null);
	let deletePending = $state(false);
	let deleteCourseFormEl = $state<HTMLFormElement | null>(null);
	let deleteAssignmentFormEl = $state<HTMLFormElement | null>(null);

	const courseSheetError = $derived.by(() => {
		if (!f || f.success === true) return null;
		if (f.kind === 'createCourse' || f.kind === 'updateCourse') return f.message ?? null;
		return null;
	});

	const assignmentSheetError = $derived.by(() => {
		if (!f || f.success === true) return null;
		if (f.kind === 'createAssignment' || f.kind === 'updateAssignment')
			return f.message ?? null;
		return null;
	});

	const deleteError = $derived.by(() => {
		if (!f || f.success === true) return null;
		if (f.kind === 'softDeleteCourse' || f.kind === 'softDeleteAssignment')
			return f.message ?? null;
		return null;
	});

	function openCreateCourse() {
		courseSheetMode = 'create';
		editingCourse = null;
		courseSheetOpen = true;
	}

	function openEditCourse(c: CourseRow) {
		courseSheetMode = 'edit';
		editingCourse = c;
		courseSheetOpen = true;
	}

	function openCreateAssignment() {
		assignmentSheetMode = 'create';
		editingAssignment = null;
		assignmentSheetOpen = true;
	}

	function openEditAssignment(a: AssignmentListRow) {
		assignmentSheetMode = 'edit';
		editingAssignment = a;
		assignmentSheetOpen = true;
	}

	function askDeleteCourse(c: CourseRow) {
		deleteKind = 'course';
		deleteCourse = c;
		deleteAssignment = null;
		deleteOpen = true;
	}

	function askDeleteAssignment(a: AssignmentListRow) {
		deleteKind = 'assignment';
		deleteAssignment = a;
		deleteCourse = null;
		deleteOpen = true;
	}

	function submitDelete() {
		if (deleteKind === 'course') {
			if (!deleteCourse || !deleteCourseFormEl) return;
			const idInput = deleteCourseFormEl.querySelector(
				'input[name="course_id"]'
			) as HTMLInputElement | null;
			if (!idInput) return;
			idInput.value = deleteCourse.id;
			deleteCourseFormEl.requestSubmit();
			return;
		}
		if (!deleteAssignment || !deleteAssignmentFormEl) return;
		const idInput = deleteAssignmentFormEl.querySelector(
			'input[name="assignment_id"]'
		) as HTMLInputElement | null;
		if (!idInput) return;
		idInput.value = deleteAssignment.id;
		deleteAssignmentFormEl.requestSubmit();
	}

	const deleteEnhance: SubmitFunction = () => {
		deletePending = true;
		return async ({ result, update }) => {
			deletePending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				deleteOpen = false;
				deleteCourse = null;
				deleteAssignment = null;
				await invalidate('app:classwork:list');
			}
		};
	};

	async function onSaved() {
		await invalidate('app:classwork:list');
	}

	function pushFilters(next: { group?: ClassworkGroup; courseId?: string | null }) {
		const params = new URLSearchParams();
		const group = next.group !== undefined ? next.group : data.filters.group;
		const courseId = next.courseId !== undefined ? next.courseId : data.filters.courseId;
		if (group !== 'date') params.set('group', group);
		if (courseId) params.set('course', courseId);
		const qs = params.toString();
		void goto(`/classwork${qs ? `?${qs}` : ''}`, { keepFocus: true, noScroll: true });
	}

	function formatDate(ymd: string): string {
		const [y, m, d] = ymd.split('-').map((x) => Number.parseInt(x, 10));
		if (!y || !m || !d) return ymd;
		return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
			timeZone: 'UTC',
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function daysLabel(a: AssignmentListRow): string | null {
		if (a.days_until == null) return null;
		if (a.days_until < 0) {
			const n = Math.abs(a.days_until);
			return n === 1 ? '1 day overdue' : `${n} days overdue`;
		}
		if (a.days_until === 0) return 'Due today';
		if (a.days_until === 1) return 'Due tomorrow';
		return `Due in ${a.days_until}d`;
	}

	const deleteTitle = $derived(
		deleteKind === 'course' ? 'Delete course?' : 'Delete assignment?'
	);
	const deleteDescription = $derived.by(() => {
		if (deleteKind === 'course' && deleteCourse) {
			return `Soft-delete “${deleteCourse.name}”? Only works when it has no live assignments.`;
		}
		if (deleteAssignment) {
			return `Soft-delete “${deleteAssignment.title}”? Clear child milestones first if any.`;
		}
		return 'This cannot be undone from this screen (audit log can restore).';
	});
</script>

<svelte:head>
	<title>Classwork — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 pb-tabbar">
	<PageHeader title="Classwork" subtitle="Courses and dated assignments — due dates live here, not in Tasks.">
		{#snippet actions()}
			{#if data.isOwner}
				<div class="flex flex-wrap items-center gap-2">
					<Button type="button" variant="outline" class="gap-2" onclick={openCreateCourse}>
						<GraduationCap class="size-4" />
						Course
					</Button>
					<Button
						type="button"
						class="gap-2"
						hotkey="b"
						disabled={data.courses.length === 0}
						onclick={openCreateAssignment}
					>
						<Plus class="size-4" />
						<HotkeyLabel label="New assignment" mnemonic="b" />
					</Button>
				</div>
			{/if}
		{/snippet}
	</PageHeader>

	{#if data.loadError}
		<p class="mt-4 text-sm text-destructive" role="alert">{data.loadError}</p>
	{/if}

	{#if deleteError}
		<p class="mt-4 text-sm text-destructive" role="alert">{deleteError}</p>
	{/if}

	<div class="mt-4 flex flex-wrap gap-2">
		<button
			type="button"
			class={cn(
				'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
				data.filters.group === 'date'
					? 'border-foreground bg-foreground text-background'
					: 'border-border text-muted-foreground hover:bg-muted/80'
			)}
			onclick={() => pushFilters({ group: 'date' })}
		>
			By date
		</button>
		<button
			type="button"
			class={cn(
				'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
				data.filters.group === 'course'
					? 'border-foreground bg-foreground text-background'
					: 'border-border text-muted-foreground hover:bg-muted/80'
			)}
			onclick={() => pushFilters({ group: 'course' })}
		>
			By course
		</button>
	</div>

	{#if data.courses.length}
		<div class="mt-2">
			<label for="classwork-course-filter" class="sr-only">Course</label>
			<select
				id="classwork-course-filter"
				class="h-9 max-w-full rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground"
				value={data.filters.courseId ?? ''}
				onchange={(e) => {
					const v = (e.currentTarget as HTMLSelectElement).value;
					pushFilters({ courseId: v || null });
				}}
			>
				<option value="">All courses</option>
				{#each data.courses as c (c.id)}
					<option value={c.id}>{c.code ? `${c.code} · ${c.name}` : c.name}</option>
				{/each}
			</select>
		</div>
	{/if}

	{#if data.courses.length === 0}
		<div class="mt-8 rounded-lg border border-dashed border-border px-4 py-10 text-center">
			<BookOpen class="mx-auto size-8 text-muted-foreground" />
			<p class="mt-3 text-sm font-medium">No courses yet</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Add a course first, then enter assignments when syllabi land.
			</p>
			{#if data.isOwner}
				<div class="mt-4">
					<Button type="button" class="gap-2" onclick={openCreateCourse}>
						<Plus class="size-4" />
						Add course
					</Button>
				</div>
			{/if}
		</div>
	{:else if data.assignments.length === 0}
		<div class="mt-8 rounded-lg border border-dashed border-border px-4 py-10 text-center">
			<p class="text-sm font-medium">No assignments</p>
			<p class="mt-1 text-sm text-muted-foreground">
				{#if data.filters.courseId}
					Nothing for this course filter.
				{:else}
					Add dated deliverables from the syllabus.
				{/if}
			</p>
		</div>
	{:else if data.filters.group === 'date'}
		<div class="mt-6 space-y-6">
			{#each data.dateGroups as g (g.due_date)}
				<section>
					<h2
						class={cn(
							'mb-2 text-sm font-semibold',
							g.hasOverdue ? 'text-destructive' : 'text-foreground'
						)}
					>
						{formatDate(g.due_date)}
					</h2>
					<ul class="space-y-2">
						{#each g.assignments as a (a.id)}
							{@render assignmentRow(a, true)}
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{:else}
		<div class="mt-6 space-y-6">
			{#each data.courseGroups as g (g.course_id)}
				<section>
					<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
						<h2 class="text-sm font-semibold">
							{g.course_code ? `${g.course_code} · ` : ''}{g.course_name}
						</h2>
						{#if data.isOwner}
							{@const course = data.courses.find((c) => c.id === g.course_id)}
							{#if course}
								<div class="flex gap-1">
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										aria-label="Edit course"
										onclick={() => openEditCourse(course)}
									>
										<Pencil class="size-3.5" />
									</Button>
									<Button
										type="button"
										variant="outline"
										size="icon-sm"
										class="text-destructive"
										aria-label="Delete course"
										onclick={() => askDeleteCourse(course)}
									>
										<Trash2 class="size-3.5" />
									</Button>
								</div>
							{/if}
						{/if}
					</div>
					<ul class="space-y-2">
						{#each g.assignments as a (a.id)}
							{@render assignmentRow(a, false)}
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}

	{#if data.courses.length > 0 && data.filters.group === 'date'}
		<section class="mt-10 border-t border-border pt-6">
			<h2 class="mb-3 text-sm font-semibold text-muted-foreground">Courses</h2>
			<ul class="space-y-2">
				{#each data.courses as c (c.id)}
					<li
						class="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
					>
						<div class="min-w-0">
							<p class="truncate text-sm font-medium">
								{c.code ? `${c.code} · ` : ''}{c.name}
							</p>
							<p class="text-xs text-muted-foreground">
								{c.term ?? 'No term'}
								{#if c.instructor}
									· {c.instructor}
								{/if}
								· {c.assignmentCount} assignment{c.assignmentCount === 1 ? '' : 's'}
							</p>
						</div>
						{#if data.isOwner}
							<div class="flex shrink-0 gap-1">
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label="Edit course"
									onclick={() => openEditCourse(c)}
								>
									<Pencil class="size-3.5" />
								</Button>
								<Button
									type="button"
									variant="outline"
									size="icon-sm"
									class="text-destructive"
									aria-label="Delete course"
									onclick={() => askDeleteCourse(c)}
								>
									<Trash2 class="size-3.5" />
								</Button>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

{#snippet assignmentRow(a: AssignmentListRow, showCourse: boolean)}
	<li
		class={cn(
			'rounded-lg border border-border px-3 py-2.5',
			a.status === 'done' && 'opacity-60',
			a.days_until != null && a.days_until < 0 && a.status !== 'done' && 'border-destructive/40'
		)}
	>
		<div class="flex items-start justify-between gap-3">
			<button
				type="button"
				class="min-w-0 flex-1 text-left"
				onclick={() => data.isOwner && openEditAssignment(a)}
				disabled={!data.isOwner}
			>
				<p class="text-sm font-medium">
					{#if a.parent_id}
						<span class="text-muted-foreground">↳ </span>
					{/if}
					{a.title}
				</p>
				<p class="mt-0.5 text-xs text-muted-foreground">
					{ASSIGNMENT_KIND_LABELS[a.kind]}
					· {ASSIGNMENT_STATUS_LABELS[a.status]}
					{#if showCourse}
						· {a.course_code ?? a.course_name}
					{:else}
						· {formatDate(a.due_date)}
					{/if}
					{#if daysLabel(a)}
						· <span
							class={cn(
								a.days_until != null && a.days_until < 0 && 'font-medium text-destructive'
							)}>{daysLabel(a)}</span
						>
					{/if}
				</p>
			</button>
			{#if data.isOwner}
				<div class="flex shrink-0 gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Edit assignment"
						onclick={() => openEditAssignment(a)}
					>
						<Pencil class="size-3.5" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						class="text-destructive"
						aria-label="Delete assignment"
						onclick={() => askDeleteAssignment(a)}
					>
						<Trash2 class="size-3.5" />
					</Button>
				</div>
			{/if}
		</div>
	</li>
{/snippet}

{#if data.isOwner}
	<CourseFormSheet
		bind:open={courseSheetOpen}
		mode={courseSheetMode}
		course={editingCourse}
		projectOptions={data.projectOptions}
		errorMessage={courseSheetError}
		onSaved={onSaved}
	/>
	<AssignmentFormSheet
		bind:open={assignmentSheetOpen}
		mode={assignmentSheetMode}
		assignment={editingAssignment}
		courses={data.courses}
		allAssignments={data.assignments}
		defaultCourseId={data.filters.courseId}
		defaultDueDate={data.todayYmd}
		errorMessage={assignmentSheetError}
		onSaved={onSaved}
	/>

	<form
		bind:this={deleteCourseFormEl}
		method="POST"
		action="?/softDeleteCourse"
		use:enhance={deleteEnhance}
		class="hidden"
	>
		<input type="hidden" name="course_id" value="" />
	</form>
	<form
		bind:this={deleteAssignmentFormEl}
		method="POST"
		action="?/softDeleteAssignment"
		use:enhance={deleteEnhance}
		class="hidden"
	>
		<input type="hidden" name="assignment_id" value="" />
	</form>

	<ConfirmDialog
		bind:open={deleteOpen}
		title={deleteTitle}
		description={deleteDescription}
		confirmLabel="Delete"
		pending={deletePending}
		onConfirm={submitDelete}
	/>
{/if}

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
		COURSE_STATUSES,
		COURSE_STATUS_LABELS,
		type ClassworkProjectOption,
		type CourseRow,
		type CourseStatus
	} from '$lib/types/classwork';

	const NONE = '__none__';

	let {
		open = $bindable(false),
		mode,
		course = null,
		projectOptions = [],
		errorMessage = null,
		onSaved
	}: {
		open?: boolean;
		mode: 'create' | 'edit';
		course?: CourseRow | null;
		projectOptions?: ClassworkProjectOption[];
		errorMessage?: string | null;
		onSaved?: () => void | Promise<void>;
	} = $props();

	let sheetSide: 'right' | 'bottom' = $state('bottom');
	let pending = $state(false);

	let name = $state('');
	let code = $state('');
	let instructor = $state('');
	let term = $state('');
	let status = $state<CourseStatus>('active');
	let projectId = $state('');
	let notes = $state('');

	const formAction = $derived(mode === 'create' ? '?/createCourse' : '?/updateCourse');
	const sheetTitle = $derived(mode === 'create' ? 'New course' : 'Edit course');

	const projectSelectValue = $derived(projectId || NONE);
	const projectLabel = $derived.by(() => {
		if (!projectId) return 'No linked project';
		return projectOptions.find((p) => p.id === projectId)?.name ?? 'Select project';
	});

	const suggested = $derived(projectOptions.filter((p) => p.suggested));
	const otherProjects = $derived(projectOptions.filter((p) => !p.suggested));

	function seedFromCourse() {
		if (mode === 'edit' && course) {
			name = course.name;
			code = course.code ?? '';
			instructor = course.instructor ?? '';
			term = course.term ?? '';
			status = course.status;
			projectId = course.project_id ?? '';
			notes = course.notes ?? '';
		} else {
			name = '';
			code = '';
			instructor = '';
			term = '';
			status = 'active';
			projectId = '';
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
		untrack(() => seedFromCourse());
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
				Name is required. Code, instructor, and term are optional (non-academic courses OK).
			</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action={formAction}
			use:enhance={onSubmit}
			class="flex flex-1 flex-col gap-4 px-1 py-4"
		>
			{#if mode === 'edit' && course}
				<input type="hidden" name="course_id" value={course.id} />
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
				<Label for="course_name">Name</Label>
				<Input id="course_name" name="name" bind:value={name} required placeholder="Psalms and Wisdom Literature" />
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-2">
					<Label for="course_code">Code</Label>
					<Input id="course_code" name="code" bind:value={code} placeholder="OT512" />
				</div>
				<div class="space-y-2">
					<Label for="course_term">Term</Label>
					<Input id="course_term" name="term" bind:value={term} placeholder="Fall 2026" />
				</div>
			</div>

			<div class="space-y-2">
				<Label for="course_instructor">Instructor</Label>
				<Input id="course_instructor" name="instructor" bind:value={instructor} />
			</div>

			<div class="space-y-2">
				<Label>Status</Label>
				<input type="hidden" name="status" value={status} />
				<Select.Root
					type="single"
					value={status}
					onValueChange={(v) => {
						if (v && (COURSE_STATUSES as readonly string[]).includes(v)) {
							status = v as CourseStatus;
						}
					}}
				>
					<Select.Trigger class="w-full" size="lg">{COURSE_STATUS_LABELS[status]}</Select.Trigger>
					<Select.Content>
						{#each COURSE_STATUSES as s (s)}
							<Select.Item value={s}>{COURSE_STATUS_LABELS[s]}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<div class="space-y-2">
				<Label>Linked project</Label>
				<input type="hidden" name="project_id" value={projectId} />
				<Select.Root
					type="single"
					value={projectSelectValue}
					onValueChange={(v) => {
						projectId = !v || v === NONE ? '' : v;
					}}
				>
					<Select.Trigger class="w-full" size="lg">{projectLabel}</Select.Trigger>
					<Select.Content>
						<Select.Item value={NONE}>No linked project</Select.Item>
						{#if suggested.length}
							{#each suggested as p (p.id)}
								<Select.Item value={p.id}>
									{'—'.repeat(p.depth)} {p.name}
								</Select.Item>
							{/each}
						{/if}
						{#if otherProjects.length}
							{#each otherProjects as p (p.id)}
								<Select.Item value={p.id}>
									{'—'.repeat(p.depth)} {p.name}
								</Select.Item>
							{/each}
						{/if}
					</Select.Content>
				</Select.Root>
				<p class="text-xs text-muted-foreground">
					Education projects listed first; any project is allowed.
				</p>
			</div>

			<div class="space-y-2">
				<Label for="course_notes">Notes</Label>
				<textarea
					id="course_notes"
					name="notes"
					bind:value={notes}
					rows={3}
					class="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					placeholder="Syllabus link, room, etc."
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
					label={pending ? 'Saving…' : mode === 'create' ? 'Save course' : 'Update course'}
					disabled={pending || !name.trim()}
				/>
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>

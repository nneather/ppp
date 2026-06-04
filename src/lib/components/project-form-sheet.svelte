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
	import {
		LIFECYCLE_STATUSES,
		LIFECYCLE_STATUS_LABELS,
		type LifecycleStatus,
		type ProjectRow,
		type ProjectFlatOption,
		type ProjectLinkRow
	} from '$lib/types/projects';
	import { collectDescendantIds } from '$lib/projects/server/loaders';
	import ProjectLinksEditor from '$lib/components/project-links-editor.svelte';

	export type ProjectFormInitial = ProjectRow;

	let {
		open = $bindable(false),
		mode,
		project = null,
		parentOptions,
		allRows,
		errorMessage = null,
		defaultParentId = null,
		projectLinks = [],
		onSaved,
		onLinksChanged
	}: {
		open?: boolean;
		mode: 'create' | 'edit';
		project?: ProjectFormInitial | null;
		parentOptions: ProjectFlatOption[];
		allRows: ProjectRow[];
		errorMessage?: string | null;
		defaultParentId?: string | null;
		projectLinks?: ProjectLinkRow[];
		onSaved?: (info?: {
			projectId?: string;
			parentId?: string | null;
		}) => void | Promise<void>;
		onLinksChanged?: () => void | Promise<void>;
	} = $props();

	let sheetSide: 'right' | 'bottom' = $state('bottom');
	let pending = $state(false);

	let name = $state('');
	let parentId = $state<string | null>(null);
	let lifecycleStatus = $state<LifecycleStatus>('active');
	let startDate = $state('');
	let endDate = $state('');
	let description = $state('');

	const excludedParentIds = $derived.by(() => {
		if (mode !== 'edit' || !project) return new Set<string>();
		const desc = collectDescendantIds(allRows, project.id);
		desc.add(project.id);
		return desc;
	});

	const filteredParentOptions = $derived(
		parentOptions.filter((o) => !excludedParentIds.has(o.id))
	);

	const parentSelectItems = $derived([
		{ value: '__none__', label: '— Top level (domain) —' },
		...filteredParentOptions.map((o) => ({
			value: o.id,
			label: `${'—'.repeat(o.depth)} ${o.name}`.trim()
		}))
	]);

	const parentLabel = $derived.by(() => {
		if (!parentId) return '— Top level (domain) —';
		const o = filteredParentOptions.find((x) => x.id === parentId);
		return o?.name ?? 'Select parent';
	});

	const formAction = $derived(mode === 'create' ? '?/createProject' : '?/updateProject');
	const title = $derived(mode === 'create' ? 'New project' : 'Edit project');

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
		if (mode === 'edit' && project) {
			name = project.name;
			parentId = project.parent_id;
			lifecycleStatus = project.lifecycle_status;
			startDate = project.start_date ?? '';
			endDate = project.end_date ?? '';
			description = project.description ?? '';
		} else {
			name = '';
			parentId = defaultParentId;
			lifecycleStatus = 'active';
			startDate = '';
			endDate = '';
			description = '';
		}
	});

	const submitEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update();
			if (result.type === 'success') {
				open = false;
				if (mode === 'create' && result.data && typeof result.data === 'object') {
					const d = result.data as { projectId?: string };
					await onSaved?.({
						projectId: d.projectId,
						parentId
					});
				} else {
					await onSaved?.();
				}
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
		<Sheet.Header class="border-b border-border px-4 pt-2 pb-4">
			<Sheet.Title>{title}</Sheet.Title>
			<Sheet.Description class="text-muted-foreground">
				Name, parent, lifecycle, and dates. Weekly health is edited inline on the tree.
			</Sheet.Description>
		</Sheet.Header>

		<div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
			{#if errorMessage}
				<p
					class="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
					role="alert"
				>
					{errorMessage}
				</p>
			{/if}

			<form method="POST" action={formAction} use:enhance={submitEnhance} class="flex flex-col gap-5">
				{#if mode === 'edit' && project}
					<input type="hidden" name="id" value={project.id} />
				{/if}

				<div class="space-y-2">
					<Label for="proj-name">Name</Label>
					<Input id="proj-name" name="name" type="text" bind:value={name} required maxlength={300} />
				</div>

				<div class="space-y-2">
					<Label>Parent</Label>
					<Select.Root
						type="single"
						value={parentId ?? '__none__'}
						onValueChange={(v) => {
							parentId = v === '__none__' || !v ? null : v;
						}}
					>
						<Select.Trigger class="w-full">{parentLabel}</Select.Trigger>
						<Select.Content>
							{#each parentSelectItems as item (item.value)}
								<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="parent_id" value={parentId ?? ''} />
				</div>

				<div class="space-y-2">
					<Label>Lifecycle</Label>
					<Select.Root
						type="single"
						value={lifecycleStatus}
						onValueChange={(v) => {
							if (v && (LIFECYCLE_STATUSES as readonly string[]).includes(v)) {
								lifecycleStatus = v as LifecycleStatus;
							}
						}}
					>
						<Select.Trigger class="w-full">
							{LIFECYCLE_STATUS_LABELS[lifecycleStatus]}
						</Select.Trigger>
						<Select.Content>
							{#each LIFECYCLE_STATUSES as st (st)}
								<Select.Item value={st} label={LIFECYCLE_STATUS_LABELS[st]}>
									{LIFECYCLE_STATUS_LABELS[st]}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="lifecycle_status" value={lifecycleStatus} />
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-2">
						<Label for="proj-start">Start date</Label>
						<Input id="proj-start" name="start_date" type="date" bind:value={startDate} />
					</div>
					<div class="space-y-2">
						<Label for="proj-end">End date</Label>
						<Input id="proj-end" name="end_date" type="date" bind:value={endDate} />
					</div>
				</div>

				<div class="space-y-2">
					<Label for="proj-desc">Description</Label>
					<textarea
						id="proj-desc"
						name="description"
						rows="3"
						bind:value={description}
						class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[4rem] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					></textarea>
				</div>

				{#if mode === 'edit' && project}
					<ProjectLinksEditor
						projectId={project.id}
						links={projectLinks}
						onChanged={onLinksChanged}
					/>
				{/if}

				<div class="flex flex-wrap gap-2 border-t border-border pt-4">
					<Button type="submit" hotkey={mode === 'create' ? 's' : 'u'} disabled={pending}>
						{pending ? 'Saving…' : mode === 'create' ? 'Create project' : 'Update project'}
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
		</div>
	</Sheet.Content>
</Sheet.Root>

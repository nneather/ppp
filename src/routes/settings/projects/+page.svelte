<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import FolderKanban from '@lucide/svelte/icons/folder-kanban';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import {
		TASK_VIEW_MODES,
		type TaskSavedView,
		type TaskViewMode
	} from '$lib/projects/task-views';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const VIEW_MODE_LABELS: Record<TaskViewMode, string> = {
		include: 'Include projects',
		exclude: 'Exclude projects',
		only: 'Only these projects'
	};

	const f = $derived(form ?? null);

	const banner = $derived.by(() => {
		if (!f) return null;
		if (f.success) {
			if (f.kind === 'setDefaultTaskProject') return { tone: 'ok' as const, text: 'Default project saved.' };
			if (f.kind === 'upsertTaskSavedView') return { tone: 'ok' as const, text: 'Saved view updated.' };
			if (f.kind === 'deleteTaskSavedView') return { tone: 'ok' as const, text: 'Saved view deleted.' };
		}
		if (!f.success && 'message' in f && f.message) {
			return { tone: 'err' as const, text: f.message };
		}
		return null;
	});

	let editing = $state<TaskSavedView | null>(null);
	let creating = $state(false);
	let draftName = $state('');
	let draftMode = $state<TaskViewMode>('exclude');
	let draftProjectIds = $state<string[]>([]);
	let defaultProjectDraft = $state('__none__');
	let deleteOpen = $state(false);
	let deleteTarget = $state<TaskSavedView | null>(null);
	let deleteFormEl = $state<HTMLFormElement | null>(null);

	$effect(() => {
		defaultProjectDraft = data.defaultTaskProjectId ?? '__none__';
	});

	const draftModeLabel = $derived(VIEW_MODE_LABELS[draftMode]);

	const defaultProjectLabel = $derived.by(() => {
		if (defaultProjectDraft === '__none__') return 'None (first domain)';
		return data.projectOptions.find((o) => o.id === defaultProjectDraft)?.name ?? 'Selected project';
	});

	function startCreate() {
		creating = true;
		editing = null;
		draftName = '';
		draftMode = 'exclude';
		draftProjectIds = [];
	}

	function startEdit(view: TaskSavedView) {
		creating = false;
		editing = view;
		draftName = view.name;
		draftMode = view.mode;
		draftProjectIds = [...view.projectIds];
	}

	function cancelEditor() {
		creating = false;
		editing = null;
	}

	function openDelete(view: TaskSavedView) {
		deleteTarget = view;
		deleteOpen = true;
	}

	function confirmDelete() {
		deleteOpen = false;
		queueMicrotask(() => deleteFormEl?.requestSubmit());
	}

	const actionEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update();
			if (result.type === 'success') {
				cancelEditor();
			}
		};
	};
</script>

{#snippet lead()}
	<FolderKanban class="size-6 shrink-0 text-muted-foreground" />
{/snippet}

<div class="mx-auto max-w-2xl px-4 py-6 pb-tabbar md:px-6 md:py-8">
	<PageHeader title="Projects & tasks" lead={lead} />

	{#if data.notOwner}
		<div class="mt-6 rounded-lg border border-border bg-card p-4">
			<p class="text-sm font-medium">Owner-only</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Task defaults and saved views can only be edited by the account owner.
			</p>
		</div>
	{:else}
		{#if banner}
			<p
				class="mt-4 rounded-md border px-3 py-2 text-sm {banner.tone === 'ok'
					? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
					: 'border-destructive/40 bg-destructive/10 text-destructive'}"
			>
				{banner.text}
			</p>
		{/if}

		<section class="mt-6 space-y-3">
			<h2 class="text-sm font-semibold">Default project for New Task</h2>
			<p class="text-sm text-muted-foreground">
				Used when opening New Task with no project filter on <code class="text-xs">/tasks</code>.
			</p>
			<form method="POST" action="?/setDefaultTaskProject" use:enhance class="flex flex-col gap-3 sm:flex-row sm:items-end">
				<div class="min-w-0 flex-1 space-y-2">
					<Label>Default project</Label>
					<Select.Root
						type="single"
						value={defaultProjectDraft}
						onValueChange={(v) => {
							defaultProjectDraft = v === '__none__' || !v ? '__none__' : v;
						}}
					>
						<Select.Trigger class="w-full">{defaultProjectLabel}</Select.Trigger>
						<Select.Content class="max-h-72">
							<Select.Item value="__none__" label="None (first domain)">None (first domain)</Select.Item>
							{#each data.projectOptions as opt (opt.id)}
								<Select.Item value={opt.id} label={opt.name}>{opt.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="default_task_project_id" value={defaultProjectDraft} />
				</div>
				<Button type="submit" hotkey="s" label="Save default">Save default</Button>
			</form>
		</section>

		<section class="mt-10 space-y-3">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h2 class="text-sm font-semibold">Saved views</h2>
					<p class="text-sm text-muted-foreground">
						Named include / exclude / only presets. Apply them from the Tasks page.
					</p>
				</div>
				{#if !creating && !editing}
					<Button type="button" size="sm" class="gap-1.5" hotkey="b" onclick={startCreate}>
						<Plus class="size-4" />
						New view
					</Button>
				{/if}
			</div>

			{#if data.savedViews.length === 0 && !creating}
				<p class="text-sm italic text-muted-foreground">No saved views yet.</p>
			{:else}
				<ul class="divide-y divide-border rounded-lg border border-border bg-card">
					{#each data.savedViews as view (view.id)}
						<li class="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
							<div class="min-w-0">
								<p class="text-sm font-medium">{view.name}</p>
								<p class="text-xs text-muted-foreground">
									{VIEW_MODE_LABELS[view.mode]} · {view.projectIds.length} project{view.projectIds.length === 1
										? ''
										: 's'}
								</p>
							</div>
							<div class="flex shrink-0 gap-1">
								<Button type="button" variant="outline" size="sm" hotkey="e" label="Edit" onclick={() => startEdit(view)}>
									Edit
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									class="text-destructive"
									aria-label="Delete view"
									onclick={() => openDelete(view)}
								>
									<Trash2 class="size-4" />
								</Button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}

			{#if creating || editing}
				<form
					method="POST"
					action="?/upsertTaskSavedView"
					use:enhance={actionEnhance}
					class="mt-4 space-y-4 rounded-lg border border-border bg-muted/20 p-4"
				>
					<input type="hidden" name="id" value={editing?.id ?? ''} />
					<div class="space-y-2">
						<Label for="view-name">Name</Label>
						<Input id="view-name" name="name" bind:value={draftName} required maxlength={80} />
					</div>
					<div class="space-y-2">
						<Label>Mode</Label>
						<Select.Root
							type="single"
							value={draftMode}
							onValueChange={(v) => {
								if (v && (TASK_VIEW_MODES as readonly string[]).includes(v)) {
									draftMode = v as TaskViewMode;
								}
							}}
						>
							<Select.Trigger class="w-full">{draftModeLabel}</Select.Trigger>
							<Select.Content>
								{#each TASK_VIEW_MODES as m (m)}
									<Select.Item value={m} label={VIEW_MODE_LABELS[m]}>{VIEW_MODE_LABELS[m]}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="mode" value={draftMode} />
					</div>
					<div class="space-y-2">
						<Label>Projects (domain roots)</Label>
						<ul class="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border bg-card p-2">
							{#each data.projectOptions as opt (opt.id)}
								<li>
									<label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60">
										<input
											type="checkbox"
											checked={draftProjectIds.includes(opt.id)}
											onchange={(e) => {
												const on = (e.currentTarget as HTMLInputElement).checked;
												if (on) draftProjectIds = [...draftProjectIds, opt.id];
												else draftProjectIds = draftProjectIds.filter((x) => x !== opt.id);
											}}
											class="size-4 rounded border-border"
										/>
										{opt.name}
									</label>
								</li>
							{/each}
						</ul>
						{#each draftProjectIds as pid (pid)}
							<input type="hidden" name="project_ids" value={pid} />
						{/each}
						{#if draftMode === 'exclude' && draftProjectIds.length === 0}
							<p class="text-xs text-muted-foreground">Exclude with no projects selected = all projects.</p>
						{/if}
					</div>
					<div class="flex flex-wrap gap-2">
						<Button type="submit" hotkey="s" label={editing ? 'Update view' : 'Save view'}>
							{editing ? 'Update view' : 'Save view'}
						</Button>
						<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={cancelEditor}>
							Cancel
						</Button>
					</div>
				</form>
			{/if}
		</section>
	{/if}
</div>

<form bind:this={deleteFormEl} method="POST" action="?/deleteTaskSavedView" use:enhance class="hidden">
	{#if deleteTarget}
		<input type="hidden" name="id" value={deleteTarget.id} />
	{/if}
</form>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Delete saved view?"
	description={deleteTarget ? `Delete “${deleteTarget.name}”? This cannot be undone.` : ''}
	confirmLabel="Delete"
	destructive
	onConfirm={confirmDelete}
/>

<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { invalidate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import PageHeader from '$lib/components/page-header.svelte';
	import ProjectTree from '$lib/components/project-tree.svelte';
	import ProjectFormSheet from '$lib/components/project-form-sheet.svelte';
	import ProjectFilterBar from '$lib/components/project-filter-bar.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import FolderKanban from '@lucide/svelte/icons/folder-kanban';
	import Plus from '@lucide/svelte/icons/plus';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import type { PageProps } from './$types';
	import type { ProjectNode, WeeklyDraftRow } from '$lib/types/projects';
	import { formatWeekLabel, sundayContaining } from '$lib/projects/week';
	import { parseProjectFilters } from '$lib/projects/filter';

	let { data, form }: PageProps = $props();

	let drafts = $state<Record<string, WeeklyDraftRow>>({});
	let sheetOpen = $state(false);
	let sheetMode = $state<'create' | 'edit'>('create');
	let editingProject = $state<ProjectNode | null>(null);
	let defaultParentId = $state<string | null>(null);
	let savePending = $state(false);
	let deletePending = $state(false);
	let confirmDeleteOpen = $state(false);
	let deleteTarget = $state<ProjectNode | null>(null);
	let undoId = $state<string | null>(null);
	let undoTimer: ReturnType<typeof setTimeout> | null = null;
	let revealBranchFor = $state<string | null>(null);

	const f = $derived(form ?? null);

	const sheetError = $derived.by(() => {
		if (!f || f.success) return null;
		if (f.kind === 'createProject' || f.kind === 'updateProject') {
			return f.message ?? 'Something went wrong.';
		}
		return null;
	});

	const saveError = $derived(
		f && f.kind === 'saveCheckin' && !f.success ? (f.message ?? 'Could not save check-in.') : null
	);

	const saveSuccess = $derived(f && f.kind === 'saveCheckin' && f.success === true);

	const filters = $derived(parseProjectFilters(page.url.searchParams));

	const domainNames = $derived(
		data.tree.filter((n) => n.parent_id == null).map((n) => n.name)
	);

	function weekHref(ymd: string): string {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('week', ymd);
		params.delete('deleted');
		const q = params.toString();
		return `/projects${q ? `?${q}` : ''}`;
	}

	function shiftWeek(deltaWeeks: number) {
		const d = new Date(`${data.weekOf}T12:00:00Z`);
		d.setUTCDate(d.getUTCDate() + deltaWeeks * 7);
		const y = d.getUTCFullYear();
		const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
		const day = String(d.getUTCDate()).padStart(2, '0');
		goto(weekHref(`${y}-${mo}-${day}`), { keepFocus: true, noScroll: true });
	}

	function openCreate(parentId: string | null = null) {
		sheetMode = 'create';
		editingProject = null;
		defaultParentId = parentId;
		sheetOpen = true;
	}

	function openEdit(node: ProjectNode) {
		sheetMode = 'edit';
		editingProject = node;
		defaultParentId = null;
		sheetOpen = true;
	}

	function askDelete(node: ProjectNode) {
		deleteTarget = node;
		confirmDeleteOpen = true;
	}

	const saveEnhance: SubmitFunction = ({ formData }) => {
		savePending = true;
		formData.set('rows_json', JSON.stringify(Object.values(drafts)));
		return async ({ result, update }) => {
			savePending = false;
			await update();
			if (result.type === 'success') {
				await invalidate('app:projects:tree');
			}
		};
	};

	const deleteEnhance: SubmitFunction = () => {
		deletePending = true;
		return async ({ result, update }) => {
			deletePending = false;
			await update();
			if (result.type === 'success' && deleteTarget) {
				confirmDeleteOpen = false;
				const id = deleteTarget.id;
				deleteTarget = null;
				undoId = id;
				if (undoTimer) clearTimeout(undoTimer);
				undoTimer = setTimeout(() => {
					undoId = null;
				}, 10_000);
				await invalidate('app:projects:tree');
			}
		};
	};

	const undoEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update();
			if (result.type === 'success') {
				undoId = null;
				if (undoTimer) clearTimeout(undoTimer);
				await invalidate('app:projects:tree');
			}
		};
	};

	async function onProjectSaved(info?: { projectId?: string; parentId?: string | null }) {
		await invalidate('app:projects:tree');
		if (info?.parentId) {
			revealBranchFor = info.parentId;
		}
	}

	$effect(() => {
		if (!browser || !data.recentlyDeletedId) return;
		undoId = data.recentlyDeletedId;
		if (undoTimer) clearTimeout(undoTimer);
		undoTimer = setTimeout(() => {
			undoId = null;
		}, 10_000);
	});
</script>

{#snippet projectsLead()}
	<FolderKanban class="size-6 shrink-0 text-muted-foreground" />
{/snippet}

<div class="mx-auto max-w-4xl px-4 py-6 pb-tabbar md:px-6 md:py-8">
	<PageHeader title="Projects" lead={projectsLead} />

	<p class="mb-6 text-sm text-muted-foreground">
		Weekly health check-in across your project tree.
	</p>

	{#if data.recentlyDeletedId && !undoId}
		<p class="mb-4 text-sm text-muted-foreground">Project removed.</p>
	{/if}

	{#if undoId}
		<div
			class="bottom-tabbar fixed inset-x-4 z-40 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg md:inset-x-auto md:right-6 md:left-auto md:max-w-sm"
			role="status"
		>
			<span class="text-sm">Project deleted</span>
			<form method="POST" action="?/undoSoftDeleteProject" use:enhance={undoEnhance}>
				<input type="hidden" name="id" value={undoId} />
				<Button type="submit" variant="outline" size="sm" class="gap-1.5">
					<Undo2 class="size-4" />
					Undo
				</Button>
			</form>
		</div>
	{/if}

	<section class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
		<div class="space-y-1">
			<Label for="week-picker">Week of (Sunday)</Label>
			<div class="flex flex-wrap items-center gap-2">
				<Button type="button" variant="outline" size="sm" onclick={() => shiftWeek(-1)}>
					← Prev
				</Button>
				<Input
					id="week-picker"
					type="date"
					class="w-auto"
					value={data.weekOf}
					onchange={(e) => {
						const v = (e.currentTarget as HTMLInputElement).value;
						if (!v) return;
						goto(weekHref(sundayContaining(v)), { keepFocus: true, noScroll: true });
					}}
				/>
				<Button type="button" variant="outline" size="sm" onclick={() => shiftWeek(1)}>
					Next →
				</Button>
			</div>
			<p class="text-xs text-muted-foreground">{formatWeekLabel(data.weekOf)}</p>
		</div>

		<form method="POST" action="?/saveCheckin" use:enhance={saveEnhance} class="flex flex-col gap-2">
			<input type="hidden" name="week_of" value={data.weekOf} />
			<Button type="submit" hotkey="s" disabled={savePending || Object.keys(drafts).length === 0}>
				{savePending ? 'Saving…' : 'Save check-in'}
			</Button>
		</form>
	</section>

	{#if saveError}
		<p
			class="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
			role="alert"
		>
			{saveError}
		</p>
	{/if}

	{#if saveSuccess}
		<p
			class="mb-4 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground"
			role="status"
		>
			Weekly check-in saved.
		</p>
	{/if}

	<ProjectFilterBar {domainNames} />

	{#if data.tree.length === 0}
		<p class="text-sm text-muted-foreground">No projects yet. Add one under a domain.</p>
	{:else}
		<ProjectTree
			tree={data.tree}
			weekOf={data.weekOf}
			weekUpdates={data.weekUpdates}
			carryForward={data.carryForward}
			latestHealth={data.latestHealth}
			{filters}
			bind:drafts
			bind:revealBranchFor
			onEdit={openEdit}
			onDelete={askDelete}
			onAddChild={(n) => openCreate(n.id)}
		/>
	{/if}

	<div class="mt-6 flex justify-center border-t border-border pt-6 pb-2">
		<Button type="button" variant="outline" class="gap-2" hotkey="b" onclick={() => openCreate(null)}>
			<Plus class="size-4" />
			New project
		</Button>
	</div>
</div>

<ProjectFormSheet
	bind:open={sheetOpen}
	mode={sheetMode}
	project={editingProject}
	parentOptions={data.flatOptions}
	allRows={data.allRows}
	errorMessage={sheetError}
	{defaultParentId}
	onSaved={onProjectSaved}
/>

<ConfirmDialog
	bind:open={confirmDeleteOpen}
	title="Delete project?"
	description={deleteTarget
		? `Remove “${deleteTarget.name}”? Reparent or delete children first if any exist.`
		: ''}
	confirmLabel="Delete"
	destructive
	pending={deletePending}
	onConfirm={() => {
		const formEl = document.getElementById('delete-project-form') as HTMLFormElement | null;
		formEl?.requestSubmit();
	}}
/>

<form
	id="delete-project-form"
	method="POST"
	action="?/softDeleteProject"
	use:enhance={deleteEnhance}
	class="hidden"
>
	{#if deleteTarget}
		<input type="hidden" name="id" value={deleteTarget.id} />
	{/if}
</form>

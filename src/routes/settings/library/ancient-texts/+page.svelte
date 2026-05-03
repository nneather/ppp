<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate, invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import GitMerge from '@lucide/svelte/icons/git-merge';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import type { PageProps } from './$types';
	import type { AncientTextsSettingsListRow } from './+page.server';

	let { data, form }: PageProps = $props();

	type FormShape = {
		kind?: string;
		message?: string;
		success?: boolean;
		ancientTextId?: string;
		ancientText?: AncientTextsSettingsListRow;
	};
	const f = $derived((form ?? null) as FormShape | null);

	const enhanceMutation: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				editOpen = false;
				editRow = null;
				createOpen = false;
				deleteOpen = false;
				deleteTarget = null;
				mergeReviewOpen = false;
				mergeTyped = '';
				await invalidateAll();
				await invalidate('app:library:ancient_texts').catch(() => {});
			}
		};
	};

	let createOpen = $state(false);
	let createName = $state('');
	let createCategory = $state('');
	let createAbbrDraft = $state('');
	let createAbbrs = $state<string[]>([]);

	function addCreateAbbr() {
		const t = createAbbrDraft.trim();
		if (!t) return;
		if (!createAbbrs.includes(t)) createAbbrs = [...createAbbrs, t];
		createAbbrDraft = '';
	}

	let editOpen = $state(false);
	let editRow = $state<AncientTextsSettingsListRow | null>(null);
	let editName = $state('');
	let editCategory = $state('');
	let editAbbrDraft = $state('');
	let editAbbrs = $state<string[]>([]);

	function openEdit(r: AncientTextsSettingsListRow) {
		editRow = r;
		editName = r.canonical_name;
		editCategory = r.category ?? '';
		editAbbrs = [...r.abbreviations];
		editAbbrDraft = '';
		editOpen = true;
	}

	function addEditAbbr() {
		const t = editAbbrDraft.trim();
		if (!t) return;
		if (!editAbbrs.includes(t)) editAbbrs = [...editAbbrs, t];
		editAbbrDraft = '';
	}

	let deleteOpen = $state(false);
	let deleteTarget = $state<AncientTextsSettingsListRow | null>(null);
	let deletePending = $state(false);
	let deleteFormEl = $state<HTMLFormElement | null>(null);

	function askDelete(r: AncientTextsSettingsListRow) {
		deleteTarget = r;
		deleteOpen = true;
	}

	const deleteEnhance: SubmitFunction = () => {
		deletePending = true;
		return async ({ result, update }) => {
			deletePending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				deleteOpen = false;
				deleteTarget = null;
				await invalidateAll();
				await invalidate('app:library:ancient_texts').catch(() => {});
			}
		};
	};

	function submitDelete() {
		if (!deleteTarget || !deleteFormEl) return;
		const idInput = deleteFormEl.querySelector('input[name="id"]') as HTMLInputElement | null;
		if (!idInput) return;
		idInput.value = deleteTarget.id;
		deleteFormEl.requestSubmit();
	}

	let mergeCanonicalId = $state('');
	let mergeMergedAwayId = $state('');
	let mergeReviewOpen = $state(false);
	let mergeTyped = $state('');
	let mergePending = $state(false);
	let mergeFormEl = $state<HTMLFormElement | null>(null);

	const mergeCanonicalRow = $derived(
		data.rows.find((r) => r.id === mergeCanonicalId) ?? null
	);
	const mergeMergedAwayRow = $derived(
		data.rows.find((r) => r.id === mergeMergedAwayId) ?? null
	);
	const mergeReady = $derived(
		mergeCanonicalId &&
			mergeMergedAwayId &&
			mergeCanonicalId !== mergeMergedAwayId &&
			mergeCanonicalRow &&
			mergeMergedAwayRow
	);
	const mergeTypedOk = $derived(
		mergeCanonicalRow ? mergeTyped.trim() === mergeCanonicalRow.canonical_name : false
	);

	function openMergeReview() {
		if (!mergeReady) return;
		mergeTyped = '';
		mergeReviewOpen = true;
	}

	const mergeEnhance: SubmitFunction = () => {
		mergePending = true;
		return async ({ result, update }) => {
			mergePending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				mergeReviewOpen = false;
				mergeTyped = '';
				mergeCanonicalId = '';
				mergeMergedAwayId = '';
				await invalidateAll();
				await invalidate('app:library:ancient_texts').catch(() => {});
			}
		};
	};

	function submitMerge() {
		if (!mergeFormEl || !mergeCanonicalId || !mergeMergedAwayId) return;
		const c = mergeFormEl.querySelector('input[name="p_canonical"]') as HTMLInputElement | null;
		const m = mergeFormEl.querySelector('input[name="p_merged_away"]') as HTMLInputElement | null;
		if (!c || !m) return;
		c.value = mergeCanonicalId;
		m.value = mergeMergedAwayId;
		mergeFormEl.requestSubmit();
	}

	const updateErr = $derived(
		f?.kind === 'updateAncientText' && f.success !== true ? (f.message ?? null) : null
	);
	const createErr = $derived(
		f?.kind === 'createAncientText' && f.success !== true ? (f.message ?? null) : null
	);
	const deleteErr = $derived(
		f?.kind === 'softDeleteAncientText' && f.success !== true ? (f.message ?? null) : null
	);
	const mergeErr = $derived(
		f?.kind === 'mergeAncientTexts' && f.success !== true ? (f.message ?? null) : null
	);
</script>

<svelte:head>
	<title>Ancient texts — Library settings — ppp</title>
</svelte:head>

{#if data.loadError}
	<p class="text-sm text-destructive" role="alert">{data.loadError}</p>
{:else}
	<p class="text-sm text-muted-foreground">
		Canonical names power ancient-text coverage on book detail. Merging re-tags every book coverage row
		to the kept entry and cannot be reverted from the audit log.
	</p>

	{#if data.coverageCountError}
		<p class="mt-3 flex items-start gap-2 text-sm text-destructive" role="alert">
			<AlertCircle class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<span>{data.coverageCountError}</span>
		</p>
	{/if}

	{#if data.isOwner}
		<div class="mt-4 flex flex-wrap gap-2">
			<Button type="button" onclick={() => (createOpen = true)} variant="outline" class="gap-2">
				<Plus class="size-4" /> New ancient text
			</Button>
		</div>
	{/if}

	<div class="mt-6 overflow-hidden rounded-xl border border-border">
		<table class="min-w-full divide-y divide-border text-sm">
			<thead class="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
				<tr>
					<th class="px-4 py-2">Canonical name</th>
					<th class="px-4 py-2">Abbreviations</th>
					<th class="px-4 py-2">Category</th>
					<th class="px-4 py-2 text-right">Coverage</th>
					{#if data.isOwner}
						<th class="px-4 py-2 text-right">Actions</th>
					{/if}
				</tr>
			</thead>
			<tbody class="divide-y divide-border">
				{#each data.rows as r (r.id)}
					<tr>
						<td class="px-4 py-2 font-medium">{r.canonical_name}</td>
						<td class="max-w-[12rem] truncate px-4 py-2 text-muted-foreground">
							{r.abbreviations.length ? r.abbreviations.join(', ') : '—'}
						</td>
						<td class="px-4 py-2 text-muted-foreground">{r.category ?? '—'}</td>
						<td class="px-4 py-2 text-right tabular-nums text-muted-foreground">
							{r.coverage_count}
						</td>
						{#if data.isOwner}
							<td class="px-4 py-2 text-right">
								<div class="flex justify-end gap-1">
									<Button type="button" variant="ghost" size="icon" onclick={() => openEdit(r)}>
										<Pencil class="size-4" />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										class="text-destructive hover:text-destructive"
										onclick={() => askDelete(r)}
										disabled={r.coverage_count > 0}
										title={r.coverage_count > 0 ? 'Remove coverage first' : 'Remove'}
									>
										<Trash2 class="size-4" />
									</Button>
								</div>
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if data.rows.length === 0}
		<p class="mt-6 text-sm text-muted-foreground">No ancient texts yet.</p>
	{/if}

	{#if data.isOwner}
		<section class="mt-10 space-y-4 rounded-xl border border-border bg-muted/20 p-4">
			<h2 class="flex items-center gap-2 text-lg font-semibold text-foreground">
				<GitMerge class="size-5" aria-hidden="true" /> Merge ancient texts
			</h2>
			<p class="text-sm text-muted-foreground">
				Keep one canonical row and merge another into it. This will re-point
				<span class="font-medium text-foreground">all</span>
				<code class="rounded bg-muted px-1 text-xs">book_ancient_coverage</code> rows from the removed entry and
				cannot be reverted from the audit log.
			</p>
			<div class="grid max-w-xl gap-4">
				<div class="space-y-2">
					<Label for="at-keep">Keep (canonical)</Label>
					<select
						id="at-keep"
						bind:value={mergeCanonicalId}
						class="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						<option value="">— Select —</option>
						{#each data.rows as r (r.id)}
							<option value={r.id}>{r.canonical_name}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-2">
					<Label for="at-remove">Merge away (remove)</Label>
					<select
						id="at-remove"
						bind:value={mergeMergedAwayId}
						class="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						<option value="">— Select —</option>
						{#each data.rows as r (r.id)}
							<option value={r.id}>{r.canonical_name}</option>
						{/each}
					</select>
				</div>
				<Button
					type="button"
					variant="destructive"
					hotkey="d"
					label="Review merge…"
					disabled={!mergeReady}
					onclick={openMergeReview}
				/>
			</div>
		</section>
	{/if}
{/if}

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="sm:max-w-md">
		<form method="POST" action="?/createAncientText" use:enhance={enhanceMutation}>
			<Dialog.Header>
				<Dialog.Title>New ancient text</Dialog.Title>
			</Dialog.Header>
			<div class="grid gap-4 py-4">
				<div class="grid gap-2">
					<Label for="at-new-name">Canonical name</Label>
					<Input id="at-new-name" name="canonical_name" bind:value={createName} required maxlength={500} />
				</div>
				<div class="grid gap-2">
					<Label for="at-new-cat">Category</Label>
					<Input id="at-new-cat" name="category" bind:value={createCategory} maxlength={200} />
				</div>
				<div class="grid gap-2">
					<Label>Abbreviations</Label>
					<div class="flex gap-2">
						<Input bind:value={createAbbrDraft} maxlength={64} placeholder="Add abbreviation" />
						<Button type="button" variant="secondary" onclick={addCreateAbbr}>Add</Button>
					</div>
					{#if createAbbrs.length > 0}
						<ul class="flex flex-wrap gap-1 text-xs">
							{#each createAbbrs as a, i (a + String(i))}
								<li class="rounded-md border border-border bg-card px-2 py-1">
									{a}
									<button
										type="button"
										class="ml-1 text-muted-foreground hover:text-foreground"
										onclick={() => (createAbbrs = createAbbrs.filter((_, j) => j !== i))}
										aria-label="Remove abbreviation"
									>
										×
									</button>
								</li>
							{/each}
						</ul>
					{/if}
					{#each createAbbrs as a}
						<input type="hidden" name="abbreviations" value={a} />
					{/each}
				</div>
			</div>
			{#if createErr}
				<p class="text-sm text-destructive" role="alert">{createErr}</p>
			{/if}
			<Dialog.Footer class="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<Button type="button" variant="outline" onclick={() => (createOpen = false)} hotkey="Escape" label="Cancel" />
				<Button type="submit" hotkey="s" label="Save" />
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={editOpen}>
	<Dialog.Content class="sm:max-w-md">
		<form method="POST" action="?/updateAncientText" use:enhance={enhanceMutation}>
			<Dialog.Header>
				<Dialog.Title>Edit ancient text</Dialog.Title>
			</Dialog.Header>
			{#if editRow}
				<input type="hidden" name="id" value={editRow.id} />
				<div class="grid gap-4 py-4">
					<div class="grid gap-2">
						<Label for="at-edit-name">Canonical name</Label>
						<Input id="at-edit-name" name="canonical_name" bind:value={editName} required maxlength={500} />
					</div>
					<div class="grid gap-2">
						<Label for="at-edit-cat">Category</Label>
						<Input id="at-edit-cat" name="category" bind:value={editCategory} maxlength={200} />
					</div>
					<div class="grid gap-2">
						<Label>Abbreviations</Label>
						<div class="flex gap-2">
							<Input bind:value={editAbbrDraft} maxlength={64} placeholder="Add abbreviation" />
							<Button type="button" variant="secondary" onclick={addEditAbbr}>Add</Button>
						</div>
						{#if editAbbrs.length > 0}
							<ul class="flex flex-wrap gap-1 text-xs">
								{#each editAbbrs as a, i (a + String(i))}
									<li class="rounded-md border border-border bg-card px-2 py-1">
										{a}
										<button
											type="button"
											class="ml-1 text-muted-foreground hover:text-foreground"
											onclick={() => (editAbbrs = editAbbrs.filter((_, j) => j !== i))}
											aria-label="Remove abbreviation"
										>
											×
										</button>
									</li>
								{/each}
							</ul>
						{/if}
						{#each editAbbrs as a}
							<input type="hidden" name="abbreviations" value={a} />
						{/each}
					</div>
				</div>
				{#if updateErr}
					<p class="text-sm text-destructive" role="alert">{updateErr}</p>
				{/if}
			{/if}
			<Dialog.Footer class="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<Button type="button" variant="outline" onclick={() => (editOpen = false)} hotkey="Escape" label="Cancel" />
				<Button type="submit" hotkey="u" label="Update" />
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<form
	bind:this={deleteFormEl}
	method="POST"
	action="?/softDeleteAncientText"
	class="hidden"
	use:enhance={deleteEnhance}
	aria-hidden="true"
>
	<input type="hidden" name="id" value="" />
</form>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Remove ancient text?"
	description={deleteTarget
		? `Hide “${deleteTarget.canonical_name}” from pickers. Only allowed when nothing references it.`
		: undefined}
	destructive
	confirmLabel="Remove"
	pending={deletePending}
	onConfirm={submitDelete}
	onCancel={() => {
		deleteOpen = false;
		deleteTarget = null;
	}}
/>
{#if deleteErr}
	<p class="mt-2 text-sm text-destructive" role="alert">{deleteErr}</p>
{/if}

<form
	bind:this={mergeFormEl}
	method="POST"
	action="?/mergeAncientTexts"
	class="hidden"
	use:enhance={mergeEnhance}
	aria-hidden="true"
>
	<input type="hidden" name="p_canonical" value="" />
	<input type="hidden" name="p_merged_away" value="" />
</form>

<Dialog.Root bind:open={mergeReviewOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Merge permanently?</Dialog.Title>
			<Dialog.Description>
				{#if mergeMergedAwayRow && mergeCanonicalRow}
					This will re-point <strong>{mergeMergedAwayRow.coverage_count}</strong>
					<code class="rounded bg-muted px-1 text-xs">book_ancient_coverage</code> row(s) from
					<strong>{mergeMergedAwayRow.canonical_name}</strong> to
					<strong>{mergeCanonicalRow.canonical_name}</strong>. You cannot undo this from the audit log.
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		{#if mergeCanonicalRow}
			<div class="grid gap-2 py-4">
				<Label for="at-merge-type">
					Type the <strong>canonical name to keep</strong> exactly to confirm:
				</Label>
				<Input id="at-merge-type" bind:value={mergeTyped} autocomplete="off" />
			</div>
		{/if}
		{#if mergeErr}
			<p class="text-sm text-destructive" role="alert">{mergeErr}</p>
		{/if}
		<Dialog.Footer class="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
			<Button
				type="button"
				variant="outline"
				onclick={() => {
					mergeReviewOpen = false;
					mergeTyped = '';
				}}
				disabled={mergePending}
				hotkey="Escape"
				label="Cancel"
			/>
			<Button
				type="button"
				variant="destructive"
				disabled={!mergeTypedOk || mergePending}
				hotkey="d"
				label={mergePending ? 'Merging…' : 'Merge'}
				onclick={submitMerge}
			/>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

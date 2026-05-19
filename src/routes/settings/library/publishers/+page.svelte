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
	import type { PublishersSettingsListRow } from './+page.server';

	let { data, form }: PageProps = $props();

	type FormShape = {
		kind?: string;
		message?: string;
		success?: boolean;
		publisherId?: string;
	};
	const f = $derived((form ?? null) as FormShape | null);

	const enhanceMutation: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				createOpen = false;
				editOpen = false;
				editRow = null;
				deleteOpen = false;
				deleteTarget = null;
				mergeOpen = false;
				mergeCanonicalId = '';
				mergeAwayId = '';
				await invalidateAll();
				await invalidate('app:library:publishers').catch(() => {});
			}
		};
	};

	let createOpen = $state(false);
	let createName = $state('');
	let createLocation = $state('');
	let createParentId = $state('');
	let createAliasDraft = $state('');
	let createAliases = $state<string[]>([]);
	let createNotes = $state('');

	let editOpen = $state(false);
	let editRow = $state<PublishersSettingsListRow | null>(null);
	let editName = $state('');
	let editLocation = $state('');
	let editParentId = $state('');
	let editAliasDraft = $state('');
	let editAliases = $state<string[]>([]);
	let editNotes = $state('');

	let deleteOpen = $state(false);
	let deleteTarget = $state<PublishersSettingsListRow | null>(null);

	let mergeOpen = $state(false);
	let mergeCanonicalId = $state('');
	let mergeAwayId = $state('');

	function addAliasDraft(isCreate: boolean) {
		const t = (isCreate ? createAliasDraft : editAliasDraft).trim();
		if (!t) return;
		if (isCreate) {
			if (!createAliases.includes(t)) createAliases = [...createAliases, t];
			createAliasDraft = '';
		} else {
			if (!editAliases.includes(t)) editAliases = [...editAliases, t];
			editAliasDraft = '';
		}
	}

	function removeAlias(isCreate: boolean, alias: string) {
		if (isCreate) createAliases = createAliases.filter((a) => a !== alias);
		else editAliases = editAliases.filter((a) => a !== alias);
	}

	function openEdit(row: PublishersSettingsListRow) {
		editRow = row;
		editName = row.canonical_name;
		editLocation = row.default_location ?? '';
		editParentId = row.parent_id ?? '';
		editAliases = [...row.aliases];
		editNotes = row.notes ?? '';
		editOpen = true;
	}

	function openMerge(row: PublishersSettingsListRow) {
		mergeAwayId = row.id;
		mergeCanonicalId = row.parent_id ?? '';
		mergeOpen = true;
	}

	const parentOptions = $derived(
		data.flat.filter((p) => !editRow || p.id !== editRow.id)
	);
</script>

{#snippet publisherRow(row: PublishersSettingsListRow, depth: number)}
	<li class="flex flex-col gap-1 border-b border-border py-3 last:border-b-0">
		<div class="flex items-start gap-2" style={`padding-left: ${depth * 1.25}rem`}>
			<div class="min-w-0 flex-1">
				<p class="font-medium text-foreground">{row.canonical_name}</p>
				<p class="mt-0.5 text-sm text-muted-foreground">
					{row.default_location ?? '—'}
					<span class="mx-1">·</span>
					{row.book_count} book{row.book_count === 1 ? '' : 's'}
				</p>
				{#if row.aliases.length > 0}
					<p class="mt-1 text-xs text-muted-foreground">
						Aliases: {row.aliases.join('; ')}
					</p>
				{/if}
			</div>
			{#if data.isOwner}
				<div class="flex shrink-0 gap-1">
					<Button type="button" variant="ghost" size="icon" onclick={() => openEdit(row)}>
						<Pencil class="size-4" />
						<span class="sr-only">Edit</span>
					</Button>
					<Button type="button" variant="ghost" size="icon" onclick={() => openMerge(row)}>
						<GitMerge class="size-4" />
						<span class="sr-only">Merge</span>
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="text-destructive"
						onclick={() => {
							deleteTarget = row;
							deleteOpen = true;
						}}
					>
						<Trash2 class="size-4" />
						<span class="sr-only">Delete</span>
					</Button>
				</div>
			{/if}
		</div>
		{#if row.children.length > 0}
			<ul class="mt-1">
				{#each row.children as child (child.id)}
					{@render publisherRow(child, depth + 1)}
				{/each}
			</ul>
		{/if}
	</li>
{/snippet}

<svelte:head>
	<title>Publishers — Library settings — ppp</title>
</svelte:head>

{#if data.loadError}
	<p class="text-sm text-destructive" role="alert">{data.loadError}</p>
{:else}
	<div class="flex flex-wrap items-center justify-between gap-3">
		<p class="text-sm text-muted-foreground">
			Canonical imprints, default cities, and aliases for Open Library matching.
		</p>
		{#if data.isOwner}
			<Button type="button" hotkey="b" onclick={() => (createOpen = true)}>
				<Plus class="size-4" />
				New publisher
			</Button>
		{/if}
	</div>

	{#if data.countError}
		<p class="mt-2 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400" role="status">
			<AlertCircle class="size-4 shrink-0" />
			Book counts unavailable: {data.countError}
		</p>
	{/if}

	<ul class="mt-6 divide-y divide-border rounded-xl border border-border px-4">
		{#each data.tree as row (row.id)}
			{@render publisherRow(row, 0)}
		{/each}
	</ul>
{/if}

{#if data.isOwner}
	<Dialog.Root bind:open={createOpen}>
		<Dialog.Content class="max-w-md">
			<Dialog.Header>
				<Dialog.Title>New publisher</Dialog.Title>
			</Dialog.Header>
			<form method="POST" action="?/createPublisher" use:enhance={enhanceMutation} class="space-y-4">
				<div class="space-y-2">
					<Label for="pub-create-name">Canonical name</Label>
					<Input id="pub-create-name" name="canonical_name" bind:value={createName} required />
				</div>
				<div class="space-y-2">
					<Label for="pub-create-loc">Default location</Label>
					<Input
						id="pub-create-loc"
						name="default_location"
						bind:value={createLocation}
						placeholder="Grand Rapids, MI"
					/>
				</div>
				<div class="space-y-2">
					<Label for="pub-create-parent">Parent imprint (optional)</Label>
					<select
						id="pub-create-parent"
						name="parent_id"
						class="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
						bind:value={createParentId}
					>
						<option value="">— None —</option>
						{#each data.flat as p (p.id)}
							<option value={p.id}>{p.canonical_name}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-2">
					<Label>Aliases</Label>
					<div class="flex gap-2">
						<Input
							bind:value={createAliasDraft}
							placeholder="Wm. B. Eerdmans Publishing Co."
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									addAliasDraft(true);
								}
							}}
						/>
						<Button type="button" variant="secondary" onclick={() => addAliasDraft(true)}>Add</Button>
					</div>
					{#each createAliases as alias (alias)}
						<input type="hidden" name="aliases" value={alias} />
						<span
							class="mr-1 mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
						>
							{alias}
							<button
								type="button"
								class="text-muted-foreground hover:text-foreground"
								onclick={() => removeAlias(true, alias)}>×</button
							>
						</span>
					{/each}
				</div>
				<div class="space-y-2">
					<Label for="pub-create-notes">Notes</Label>
					<Input id="pub-create-notes" name="notes" bind:value={createNotes} />
				</div>
				<Dialog.Footer>
					<Button type="submit" hotkey="s">Save</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Root>

	<Dialog.Root bind:open={editOpen}>
		<Dialog.Content class="max-w-md">
			<Dialog.Header>
				<Dialog.Title>Edit publisher</Dialog.Title>
			</Dialog.Header>
			{#if editRow}
				<form method="POST" action="?/updatePublisher" use:enhance={enhanceMutation} class="space-y-4">
					<input type="hidden" name="id" value={editRow.id} />
					<div class="space-y-2">
						<Label for="pub-edit-name">Canonical name</Label>
						<Input id="pub-edit-name" name="canonical_name" bind:value={editName} required />
					</div>
					<div class="space-y-2">
						<Label for="pub-edit-loc">Default location</Label>
						<Input id="pub-edit-loc" name="default_location" bind:value={editLocation} />
					</div>
					<div class="space-y-2">
						<Label for="pub-edit-parent">Parent imprint</Label>
						<select
							id="pub-edit-parent"
							name="parent_id"
							class="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
							bind:value={editParentId}
						>
							<option value="">— None —</option>
							{#each parentOptions as p (p.id)}
								<option value={p.id}>{p.canonical_name}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-2">
						<Label>Aliases</Label>
						<div class="flex gap-2">
							<Input
								bind:value={editAliasDraft}
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										addAliasDraft(false);
									}
								}}
							/>
							<Button type="button" variant="secondary" onclick={() => addAliasDraft(false)}
								>Add</Button
							>
						</div>
						{#each editAliases as alias (alias)}
							<input type="hidden" name="aliases" value={alias} />
							<span
								class="mr-1 mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
							>
								{alias}
								<button
									type="button"
									class="text-muted-foreground hover:text-foreground"
									onclick={() => removeAlias(false, alias)}>×</button
								>
							</span>
						{/each}
					</div>
					<div class="space-y-2">
						<Label for="pub-edit-notes">Notes</Label>
						<Input id="pub-edit-notes" name="notes" bind:value={editNotes} />
					</div>
					<Dialog.Footer>
						<Button type="submit" hotkey="u">Update</Button>
					</Dialog.Footer>
				</form>
			{/if}
		</Dialog.Content>
	</Dialog.Root>

	<Dialog.Root bind:open={mergeOpen}>
		<Dialog.Content class="max-w-md">
			<Dialog.Header>
				<Dialog.Title>Merge publisher</Dialog.Title>
				<Dialog.Description>
					Repoint all books to the canonical imprint and remove the merged row.
				</Dialog.Description>
			</Dialog.Header>
			<form method="POST" action="?/mergePublishers" use:enhance={enhanceMutation} class="space-y-4">
				<div class="space-y-2">
					<Label for="merge-canonical">Keep (canonical)</Label>
					<select
						id="merge-canonical"
						name="p_canonical"
						class="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
						bind:value={mergeCanonicalId}
						required
					>
						<option value="" disabled>Select…</option>
						{#each data.flat as p (p.id)}
							{#if p.id !== mergeAwayId}
								<option value={p.id}>{p.canonical_name}</option>
							{/if}
						{/each}
					</select>
				</div>
				<input type="hidden" name="p_merged_away" value={mergeAwayId} />
				<Dialog.Footer>
					<Button type="submit" hotkey="g">Merge</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Root>

	<ConfirmDialog
		bind:open={deleteOpen}
		title="Remove publisher?"
		description={deleteTarget
			? `Soft-delete “${deleteTarget.canonical_name}”? Only allowed when no books reference it.`
			: ''}
		confirmLabel="Remove"
		onConfirm={() => {
			if (!deleteTarget) return;
			const form = document.getElementById('pub-delete-form') as HTMLFormElement | null;
			const idInput = form?.querySelector('input[name="id"]') as HTMLInputElement | null;
			if (idInput && form) {
				idInput.value = deleteTarget.id;
				form.requestSubmit();
			}
		}}
	/>
	<form id="pub-delete-form" method="POST" action="?/softDeletePublisher" use:enhance={enhanceMutation} class="hidden">
		<input type="hidden" name="id" value="" />
	</form>
{/if}

{#if f?.success !== true && f?.message}
	<p class="mt-4 text-sm text-destructive" role="alert">{f.message}</p>
{/if}

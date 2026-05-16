<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Search from '@lucide/svelte/icons/search';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import GitMerge from '@lucide/svelte/icons/git-merge';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import type { PageProps } from './$types';
	import type { PeopleSettingsListRow } from './+page.server';

	let { data, form }: PageProps = $props();

	type FormShape = {
		kind?: string;
		message?: string;
		success?: boolean;
		personId?: string;
	};
	const f = $derived((form ?? null) as FormShape | null);

	let editOpen = $state(false);
	let editPerson = $state<PeopleSettingsListRow | null>(null);
	let editLast = $state('');
	let editFirst = $state('');
	let editMiddle = $state('');
	let editSuffix = $state('');
	let editAliases = $state<string[]>([]);
	let aliasDraft = $state('');

	function openEdit(p: PeopleSettingsListRow) {
		editPerson = p;
		editLast = p.last_name;
		editFirst = p.first_name ?? '';
		editMiddle = p.middle_name ?? '';
		editSuffix = p.suffix ?? '';
		editAliases = [...p.aliases];
		aliasDraft = '';
		editOpen = true;
	}

	function addAlias() {
		const t = aliasDraft.trim();
		if (!t) return;
		if (editAliases.includes(t)) {
			aliasDraft = '';
			return;
		}
		editAliases = [...editAliases, t];
		aliasDraft = '';
	}

	function removeAlias(i: number) {
		editAliases = editAliases.filter((_, idx) => idx !== i);
	}

	const enhanceMutation: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				editOpen = false;
				editPerson = null;
				deleteOpen = false;
				deleteTarget = null;
				mergeOpen = false;
				mergeMergedAway = null;
				mergeCanonicalId = null;
				await invalidateAll();
				await invalidate('app:library:people').catch(() => {});
				await invalidate('app:library:facets').catch(() => {});
			}
		};
	};

	let deleteOpen = $state(false);
	let deleteTarget = $state<PeopleSettingsListRow | null>(null);
	let deletePending = $state(false);
	let deleteFormEl = $state<HTMLFormElement | null>(null);

	function askDelete(p: PeopleSettingsListRow) {
		deleteTarget = p;
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
				await invalidate('app:library:people').catch(() => {});
				await invalidate('app:library:facets').catch(() => {});
			}
		};
	};

	function submitDelete() {
		if (!deleteTarget || !deleteFormEl) return;
		const idInput = deleteFormEl.querySelector(
			'input[name="id"]'
		) as HTMLInputElement | null;
		if (!idInput) return;
		idInput.value = deleteTarget.id;
		deleteFormEl.requestSubmit();
	}

	let mergeOpen = $state(false);
	let mergeMergedAway = $state<PeopleSettingsListRow | null>(null);
	let mergeCanonicalId = $state<string | null>(null);
	let mergeCanonicalSearch = $state('');
	let mergePending = $state(false);
	let mergeFormEl = $state<HTMLFormElement | null>(null);

	function openMerge(p: PeopleSettingsListRow) {
		mergeMergedAway = p;
		mergeCanonicalId = null;
		mergeCanonicalSearch = '';
		mergeOpen = true;
	}

	const mergeCandidates = $derived.by(() => {
		const away = mergeMergedAway;
		if (!away) return [] as PeopleSettingsListRow[];
		const q = mergeCanonicalSearch.trim().toLowerCase();
		return data.people.filter((p) => {
			if (p.id === away.id) return false;
			if (!q) return true;
			return (
				p.last_name.toLowerCase().includes(q) ||
				(p.first_name?.toLowerCase().includes(q) ?? false) ||
				p.display_name.toLowerCase().includes(q)
			);
		});
	});

	const mergeEnhance: SubmitFunction = () => {
		mergePending = true;
		return async ({ result, update }) => {
			mergePending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				mergeOpen = false;
				mergeMergedAway = null;
				mergeCanonicalId = null;
				await invalidateAll();
				await invalidate('app:library:people').catch(() => {});
				await invalidate('app:library:facets').catch(() => {});
			}
		};
	};

	function submitMerge() {
		if (!mergeMergedAway || !mergeCanonicalId || !mergeFormEl) return;
		const c = mergeFormEl.querySelector(
			'input[name="p_canonical"]'
		) as HTMLInputElement | null;
		const m = mergeFormEl.querySelector(
			'input[name="p_merged_away"]'
		) as HTMLInputElement | null;
		if (!c || !m) return;
		c.value = mergeCanonicalId;
		m.value = mergeMergedAway.id;
		mergeFormEl.requestSubmit();
	}

	function searchHref(nextQ: string): string {
		const u = new URL(page.url.href);
		if (nextQ.trim()) u.searchParams.set('q', nextQ.trim());
		else u.searchParams.delete('q');
		return u.pathname + (u.search || '');
	}

	const updateErr = $derived(
		f?.kind === 'updatePerson' && f.success !== true ? (f.message ?? null) : null
	);
	const mergeErr = $derived(
		f?.kind === 'mergePeople' && f.success !== true ? (f.message ?? null) : null
	);

	let qInput = $state('');
	$effect(() => {
		qInput = data.q;
	});
</script>

<svelte:head>
	<title>People — Library settings — ppp</title>
</svelte:head>

{#if data.loadError}
	<p class="text-sm text-destructive" role="alert">{data.loadError}</p>
{:else}
	<p class="text-sm text-muted-foreground">
		Review, rename, or remove people created from book authors. Merging re-points every book (and
		essay) author link to the person you keep, then soft-deletes the duplicate — logged in the
		audit log without a one-click revert.
	</p>

	{#if data.isOwner}
		<p class="mt-2 text-sm">
			<a
				href="/settings/library/people/merge"
				class="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
			>
				Merge tab — suggested duplicates
			</a>
		</p>
	{/if}

	{#if data.bookCountError}
		<p
			class="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
			role="status"
		>
			<AlertCircle class="mt-0.5 size-4 shrink-0" />
			<span>Book counts could not be loaded ({data.bookCountError}). The “Books” column may show 0.</span>
		</p>
	{/if}

	<form class="mt-4 flex flex-wrap items-end gap-2" method="GET" action={page.url.pathname}>
		<div class="min-w-0 flex-1 space-y-1.5 sm:max-w-xs">
			<Label for="people-q">Search by last name</Label>
			<Input id="people-q" name="q" bind:value={qInput} placeholder="e.g. Bruce" autocomplete="off" />
		</div>
		<Button type="submit" variant="outline" class="gap-2">
			<Search class="size-4" />
			Search
		</Button>
		{#if data.q}
			<Button type="button" variant="ghost" href={searchHref('')} class="text-muted-foreground">
				Clear
			</Button>
		{/if}
	</form>

	{#if data.listTruncated}
		<p class="mt-3 text-xs text-amber-700 dark:text-amber-200" role="status">
			Showing the first {500} matches — refine search to narrow the list.
		</p>
	{/if}

	<div class="mt-6 overflow-hidden rounded-xl border border-border">
		<table class="min-w-full divide-y divide-border text-sm">
			<thead class="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
				<tr>
					<th class="px-4 py-2">Name</th>
					<th class="hidden px-4 py-2 sm:table-cell">Books</th>
					<th class="px-4 py-2 text-right">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-border">
				{#each data.people as p (p.id)}
					<tr>
						<td class="px-4 py-2">
							<span class="font-medium text-foreground">{p.display_name}</span>
							{#if p.aliases.length > 0}
								<span class="mt-0.5 block text-xs text-muted-foreground">
									Also known as: {p.aliases.join(', ')}
								</span>
							{/if}
						</td>
						<td class="hidden px-4 py-2 tabular-nums text-muted-foreground sm:table-cell">
							{p.book_count}
						</td>
						<td class="px-4 py-2 text-right">
							<div class="flex flex-wrap justify-end gap-1">
								<Button type="button" variant="outline" size="sm" class="gap-1" onclick={() => openEdit(p)}>
									<Pencil class="size-3.5" />
									<span class="sr-only sm:not-sr-only">Edit</span>
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									class="gap-1 text-destructive hover:text-destructive"
									onclick={() => askDelete(p)}
								>
									<Trash2 class="size-3.5" />
									<span class="sr-only sm:not-sr-only">Delete</span>
								</Button>
								{#if data.isOwner}
									<Button type="button" variant="secondary" size="sm" class="gap-1" onclick={() => openMerge(p)}>
										<GitMerge class="size-3.5" />
										<span class="sr-only sm:not-sr-only">Merge</span>
									</Button>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if data.people.length === 0}
		<p class="mt-6 text-center text-sm text-muted-foreground">No people match this search.</p>
	{/if}
{/if}

<form
	bind:this={deleteFormEl}
	method="POST"
	action="?/softDeletePerson"
	class="hidden"
	use:enhance={deleteEnhance}
>
	<input type="hidden" name="id" value="" />
</form>

<form
	bind:this={mergeFormEl}
	method="POST"
	action="?/mergePeople"
	class="hidden"
	use:enhance={mergeEnhance}
>
	<input type="hidden" name="p_canonical" value="" />
	<input type="hidden" name="p_merged_away" value="" />
</form>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Remove this person?"
	description={deleteTarget
		? `“${deleteTarget.display_name}” will be hidden from lists. Book links stay unchanged unless you merge first.`
		: ''}
	destructive
	confirmLabel="Remove"
	pending={deletePending}
	onConfirm={submitDelete}
/>

<Dialog.Root bind:open={editOpen}>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Edit person</Dialog.Title>
			<Dialog.Description>Names and aliases used in author pickers and citations.</Dialog.Description>
		</Dialog.Header>
		{#if editPerson}
			<form method="POST" action="?/updatePerson" use:enhance={enhanceMutation} class="space-y-4">
				<input type="hidden" name="id" value={editPerson.id} />
				{#each editAliases as a (a)}
					<input type="hidden" name="aliases" value={a} />
				{/each}
				<div class="grid gap-3 sm:grid-cols-2">
					<div class="space-y-1.5 sm:col-span-2">
						<Label for="edit-last">Last name</Label>
						<Input id="edit-last" name="last_name" bind:value={editLast} required maxlength={200} />
					</div>
					<div class="space-y-1.5">
						<Label for="edit-first">First name</Label>
						<Input id="edit-first" name="first_name" bind:value={editFirst} />
					</div>
					<div class="space-y-1.5">
						<Label for="edit-middle">Middle</Label>
						<Input id="edit-middle" name="middle_name" bind:value={editMiddle} />
					</div>
					<div class="space-y-1.5 sm:col-span-2">
						<Label for="edit-suffix">Suffix</Label>
						<Input id="edit-suffix" name="suffix" bind:value={editSuffix} />
					</div>
				</div>
				<div class="space-y-2">
					<Label for="alias-draft">Aliases</Label>
					<p class="text-xs text-muted-foreground">Alternate spellings or forms for search.</p>
					<div class="flex gap-2">
						<Input
							id="alias-draft"
							bind:value={aliasDraft}
							placeholder="Add alias"
							autocomplete="off"
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									addAlias();
								}
							}}
						/>
						<Button type="button" variant="secondary" onclick={addAlias}>Add</Button>
					</div>
					{#if editAliases.length > 0}
						<ul class="flex flex-wrap gap-1.5">
							{#each editAliases as a, i (a)}
								<li
									class="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 py-0.5 pl-2.5 pr-1 text-xs"
								>
									{a}
									<button
										type="button"
										class="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
										onclick={() => removeAlias(i)}
										aria-label={`Remove alias ${a}`}
									>
										×
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
				{#if updateErr}
					<p class="text-sm text-destructive" role="alert">{updateErr}</p>
				{/if}
				<Dialog.Footer class="gap-2 sm:justify-end">
					<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={() => (editOpen = false)} />
					<Button type="submit" hotkey="s" label="Save changes" />
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={mergeOpen}>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Merge people</Dialog.Title>
			<Dialog.Description>
				All author links on books and essays will point to the person you keep. The other person is
				removed from lists and cannot be restored from the audit log in one step.
			</Dialog.Description>
		</Dialog.Header>
		{#if mergeMergedAway}
			<div class="space-y-3 text-sm">
				<p>
					<span class="text-muted-foreground">Remove:</span>
					<strong class="text-foreground">{mergeMergedAway.display_name}</strong>
				</p>
				<div class="space-y-1.5">
					<Label for="merge-find">Keep (search by name)</Label>
					<Input
						id="merge-find"
						bind:value={mergeCanonicalSearch}
						placeholder="Type to filter…"
						autocomplete="off"
					/>
				</div>
				<div class="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
					{#each mergeCandidates as c (c.id)}
						<label
							class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
						>
							<input type="radio" name="merge-canonical-pick" value={c.id} bind:group={mergeCanonicalId} />
							<span>{c.display_name}</span>
							<span class="ml-auto text-xs text-muted-foreground">{c.book_count} books</span>
						</label>
					{:else}
						<p class="px-2 py-3 text-xs text-muted-foreground">No other people match this filter.</p>
					{/each}
				</div>
				{#if mergeErr}
					<p class="text-sm text-destructive" role="alert">{mergeErr}</p>
				{/if}
			</div>
			<Dialog.Footer class="gap-2 sm:justify-end">
				<Button
					type="button"
					variant="outline"
					hotkey="Escape"
					label="Cancel"
					onclick={() => (mergeOpen = false)}
				/>
				<Button
					type="button"
					variant="destructive"
					hotkey="d"
					label={mergePending ? 'Merging…' : 'Merge permanently'}
					disabled={!mergeCanonicalId || mergePending}
					onclick={submitMerge}
				/>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>

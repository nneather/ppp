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
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import type { PageProps } from './$types';
	import type { SeriesSettingsListRow } from './+page.server';

	let { data, form }: PageProps = $props();

	type FormShape = {
		kind?: string;
		message?: string;
		success?: boolean;
		seriesId?: string;
	};
	const f = $derived((form ?? null) as FormShape | null);

	let editOpen = $state(false);
	let editRow = $state<SeriesSettingsListRow | null>(null);
	let editName = $state('');
	let editAbbrev = $state('');

	function openEdit(s: SeriesSettingsListRow) {
		editRow = s;
		editName = s.name;
		editAbbrev = s.abbreviation ?? '';
		editOpen = true;
	}

	const enhanceMutation: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				editOpen = false;
				editRow = null;
				deleteOpen = false;
				deleteTarget = null;
				await invalidateAll();
				await invalidate('app:library:series').catch(() => {});
			}
		};
	};

	let deleteOpen = $state(false);
	let deleteTarget = $state<SeriesSettingsListRow | null>(null);
	let deletePending = $state(false);
	let deleteFormEl = $state<HTMLFormElement | null>(null);

	function askDelete(s: SeriesSettingsListRow) {
		deleteTarget = s;
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
				await invalidate('app:library:series').catch(() => {});
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

	const updateErr = $derived(
		f?.kind === 'updateSeries' && f.success !== true ? (f.message ?? null) : null
	);
	const deleteErr = $derived(
		f?.kind === 'softDeleteSeries' && f.success !== true ? (f.message ?? null) : null
	);
</script>

<svelte:head>
	<title>Series — Library settings — ppp</title>
</svelte:head>

{#if data.loadError}
	<p class="text-sm text-destructive" role="alert">{data.loadError}</p>
{:else}
	<p class="text-sm text-muted-foreground">
		Rename series or fix abbreviations. Series that still have books cannot be removed — reassign books
		first.
	</p>

	{#if data.bookCountError}
		<p class="mt-3 flex items-start gap-2 text-sm text-destructive" role="alert">
			<AlertCircle class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<span>{data.bookCountError}</span>
		</p>
	{/if}

	<div class="mt-6 overflow-hidden rounded-xl border border-border">
		<table class="min-w-full divide-y divide-border text-sm">
			<thead class="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
				<tr>
					<th class="px-4 py-2">Name</th>
					<th class="px-4 py-2">Abbreviation</th>
					<th class="px-4 py-2 text-right">Books</th>
					<th class="px-4 py-2 text-right">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-border">
				{#each data.series as s (s.id)}
					<tr>
						<td class="px-4 py-2 font-medium">{s.name}</td>
						<td class="px-4 py-2 text-muted-foreground">{s.abbreviation ?? '—'}</td>
						<td class="px-4 py-2 text-right tabular-nums text-muted-foreground">{s.book_count}</td>
						<td class="px-4 py-2 text-right">
							<div class="flex justify-end gap-1">
								<Button type="button" variant="ghost" size="icon" onclick={() => openEdit(s)} title="Edit">
									<Pencil class="size-4" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									class="text-destructive hover:text-destructive"
									onclick={() => askDelete(s)}
									disabled={s.book_count > 0}
									title={s.book_count > 0
										? 'Detach books before removing'
										: 'Remove series'}
								>
									<Trash2 class="size-4" />
								</Button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if data.series.length === 0}
		<p class="mt-6 text-sm text-muted-foreground">No series yet. Create one from a book form.</p>
	{/if}
{/if}

<Dialog.Root bind:open={editOpen}>
	<Dialog.Content class="sm:max-w-md">
		<form method="POST" action="?/updateSeries" use:enhance={enhanceMutation}>
			<Dialog.Header>
				<Dialog.Title>Edit series</Dialog.Title>
				<Dialog.Description>Changes apply to the series picker on book forms.</Dialog.Description>
			</Dialog.Header>
			{#if editRow}
				<input type="hidden" name="id" value={editRow.id} />
				<div class="grid gap-4 py-4">
					<div class="grid gap-2">
						<Label for="series-name">Name</Label>
						<Input id="series-name" name="name" bind:value={editName} maxlength={300} required />
					</div>
					<div class="grid gap-2">
						<Label for="series-abbrev">Abbreviation</Label>
						<Input id="series-abbrev" name="abbreviation" bind:value={editAbbrev} maxlength={32} />
					</div>
				</div>
				{#if updateErr}
					<p class="text-sm text-destructive" role="alert">{updateErr}</p>
				{/if}
			{/if}
			<Dialog.Footer class="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<Button
					type="button"
					variant="outline"
					onclick={() => {
						editOpen = false;
						editRow = null;
					}}
					hotkey="Escape"
					label="Cancel"
				/>
				<Button type="submit" hotkey="u" label="Update series" />
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<form
	bind:this={deleteFormEl}
	method="POST"
	action="?/softDeleteSeries"
	class="hidden"
	use:enhance={deleteEnhance}
	aria-hidden="true"
>
	<input type="hidden" name="id" value="" />
</form>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Remove series?"
	description={deleteTarget
		? `Hide “${deleteTarget.name}” from series pickers. You can only remove a series when no books use it.`
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

<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate, invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import VenueFormFields from '$lib/components/venue-form-fields.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { formatVenueLogistics } from '$lib/sermons/venue-logistics';
	import {
		CONTEXT_TYPE_BADGE_CLASSES,
		CONTEXT_TYPE_LABELS,
		CONTEXT_TYPE_SHORT,
		type ContextType,
		type Hymnal,
		type SermonVenueRow
	} from '$lib/types/sermons';
	import { cn } from '$lib/utils';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type FormShape = {
		kind?: string;
		message?: string;
		success?: boolean;
		venueId?: string;
	};
	const f = $derived((form ?? null) as FormShape | null);

	let createOpen = $state(false);
	let createName = $state('');
	let createNotes = $state('');
	let createContextType = $state<ContextType | ''>('');
	let createServiceStart = $state('');
	let createDriveMinutes = $state('');
	let createDepartBy = $state('');
	let createHymnal = $state<Hymnal | ''>('');

	let editOpen = $state(false);
	let editRow = $state<SermonVenueRow | null>(null);
	let editName = $state('');
	let editNotes = $state('');
	let editContextType = $state<ContextType | ''>('');
	let editServiceStart = $state('');
	let editDriveMinutes = $state('');
	let editDepartBy = $state('');
	let editHymnal = $state<Hymnal | ''>('');

	let deleteOpen = $state(false);
	let deleteTarget = $state<SermonVenueRow | null>(null);
	let deletePending = $state(false);
	let deleteFormEl = $state<HTMLFormElement | null>(null);

	function openCreate() {
		createName = '';
		createNotes = '';
		createContextType = '';
		createServiceStart = '';
		createDriveMinutes = '';
		createDepartBy = '';
		createHymnal = '';
		createOpen = true;
	}

	function openEdit(v: SermonVenueRow) {
		editRow = v;
		editName = v.name;
		editNotes = v.notes ?? '';
		editContextType = v.context_type ?? '';
		editServiceStart = v.service_start ?? '';
		editDriveMinutes = v.drive_minutes != null ? String(v.drive_minutes) : '';
		editDepartBy = v.depart_by ?? '';
		editHymnal = v.hymnal ?? '';
		editOpen = true;
	}

	const enhanceMutation: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				createOpen = false;
				editOpen = false;
				editRow = null;
				deleteOpen = false;
				deleteTarget = null;
				await invalidateAll();
				await invalidate('app:sermons:venues').catch(() => {});
				await invalidate('app:sermons:list').catch(() => {});
			}
		};
	};

	function askDelete(v: SermonVenueRow) {
		deleteTarget = v;
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
				await invalidate('app:sermons:venues').catch(() => {});
				await invalidate('app:sermons:list').catch(() => {});
			}
		};
	};

	function submitDelete() {
		if (!deleteTarget || !deleteFormEl) return;
		const idInput = deleteFormEl.querySelector(
			'input[name="venue_id"]'
		) as HTMLInputElement | null;
		if (!idInput) return;
		idInput.value = deleteTarget.id;
		deleteFormEl.requestSubmit();
	}

	const createErr = $derived(
		f?.kind === 'createVenue' && f.success !== true ? (f.message ?? null) : null
	);
	const updateErr = $derived(
		f?.kind === 'updateVenue' && f.success !== true ? (f.message ?? null) : null
	);
	const deleteErr = $derived(
		f?.kind === 'softDeleteVenue' && f.success !== true ? (f.message ?? null) : null
	);
</script>

<svelte:head>
	<title>Venues — Sermons settings — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
	<PageHeader
		title="Venues"
		subtitle="Churches and organizations where you have preached."
		back={{ href: '/settings', label: 'Settings' }}
	/>

	{#if data.notOwner}
		<div class="mt-6 rounded-lg border border-border bg-card p-5 text-card-foreground">
			<p class="font-medium">Owner-only</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Venue management is limited to the account owner.
			</p>
		</div>
	{:else if data.loadError}
		<p class="mt-4 text-sm text-destructive" role="alert">{data.loadError}</p>
	{:else}
		<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
			<p class="text-sm text-muted-foreground">
				{data.venues.length} venue{data.venues.length === 1 ? '' : 's'}
			</p>
			<Button type="button" class="gap-2" hotkey="b" onclick={openCreate}>
				<Plus class="size-4" /> New venue
			</Button>
		</div>

		{#if deleteErr}
			<p class="mt-3 text-sm text-destructive" role="alert">{deleteErr}</p>
		{/if}

		<ul class="mt-4 space-y-2">
			{#each data.venues as v (v.id)}
				{@const logistics = formatVenueLogistics(v)}
				<li
					class="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-card-foreground"
				>
					<div class="min-w-0">
						<p class="flex items-center gap-2 truncate text-sm font-medium">
							{v.name}
							{#if v.context_type}
								<span
									class={cn(
										'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium',
										CONTEXT_TYPE_BADGE_CLASSES[v.context_type]
									)}
									title={CONTEXT_TYPE_LABELS[v.context_type]}
								>
									{CONTEXT_TYPE_SHORT[v.context_type]}
								</span>
							{/if}
						</p>
						{#if logistics}
							<p class="text-xs text-muted-foreground">{logistics}</p>
						{/if}
						<p class="text-xs text-muted-foreground">
							{v.sermonCount} sermon{v.sermonCount === 1 ? '' : 's'}
						</p>
						{#if v.notes}
							<p class="mt-0.5 line-clamp-3 text-xs whitespace-pre-line text-muted-foreground">
								{v.notes}
							</p>
						{/if}
					</div>
					<div class="flex shrink-0 gap-1">
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label="Edit venue"
							onclick={() => openEdit(v)}
						>
							<Pencil class="size-4" />
						</Button>
						<Button
							type="button"
							variant="outline"
							size="icon-sm"
							class="text-destructive"
							aria-label="Delete venue"
							onclick={() => askDelete(v)}
						>
							<Trash2 class="size-4" />
						</Button>
					</div>
				</li>
			{:else}
				<li
					class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
				>
					No venues yet.
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if !data.notOwner}
	<Dialog.Root bind:open={createOpen}>
		<Dialog.Content class="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
			<Dialog.Header>
				<Dialog.Title>New venue</Dialog.Title>
			</Dialog.Header>
			<form method="POST" action="?/createVenue" use:enhance={enhanceMutation} class="space-y-4">
				{#if createErr}
					<p class="text-sm text-destructive" role="alert">{createErr}</p>
				{/if}
				<VenueFormFields
					idPrefix="create"
					bind:name={createName}
					bind:contextType={createContextType}
					bind:serviceStart={createServiceStart}
					bind:driveMinutes={createDriveMinutes}
					bind:departBy={createDepartBy}
					bind:hymnal={createHymnal}
					bind:notes={createNotes}
				/>
				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={() => (createOpen = false)} />
					<Button type="submit" hotkey="s" label="Save venue" />
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Root>

	<Dialog.Root bind:open={editOpen}>
		<Dialog.Content class="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
			<Dialog.Header>
				<Dialog.Title>Edit venue</Dialog.Title>
			</Dialog.Header>
			<form method="POST" action="?/updateVenue" use:enhance={enhanceMutation} class="space-y-4">
				<input type="hidden" name="venue_id" value={editRow?.id ?? ''} />
				{#if updateErr}
					<p class="text-sm text-destructive" role="alert">{updateErr}</p>
				{/if}
				<VenueFormFields
					idPrefix="edit"
					bind:name={editName}
					bind:contextType={editContextType}
					bind:serviceStart={editServiceStart}
					bind:driveMinutes={editDriveMinutes}
					bind:departBy={editDepartBy}
					bind:hymnal={editHymnal}
					bind:notes={editNotes}
				/>
				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={() => (editOpen = false)} />
					<Button type="submit" hotkey="u" label="Update venue" />
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Root>

	<form
		bind:this={deleteFormEl}
		method="POST"
		action="?/softDeleteVenue"
		class="hidden"
		use:enhance={deleteEnhance}
	>
		<input type="hidden" name="venue_id" value="" />
	</form>

	<ConfirmDialog
		bind:open={deleteOpen}
		title="Delete venue?"
		description={deleteTarget
			? `Remove “${deleteTarget.name}”? Venues with sermons cannot be deleted.`
			: ''}
		confirmLabel={deletePending ? 'Deleting…' : 'Delete'}
		onConfirm={submitDelete}
	/>
{/if}

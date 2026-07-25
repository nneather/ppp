<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { ContactListDef } from '$lib/types/contacts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type FormShape = {
		kind?: string;
		message?: string;
		success?: boolean;
		listId?: string;
		memberId?: string;
	};
	const f = $derived((form ?? null) as FormShape | null);

	let createOpen = $state(false);
	let createName = $state('');
	let createNotes = $state('');

	let editOpen = $state(false);
	let editRow = $state<ContactListDef | null>(null);
	let editName = $state('');
	let editNotes = $state('');

	let deleteOpen = $state(false);
	let deleteTarget = $state<ContactListDef | null>(null);
	let deletePending = $state(false);
	let deleteFormEl = $state<HTMLFormElement | null>(null);

	let memberKind = $state<'household' | 'contact'>('household');
	let memberId = $state('');

	const createErr = $derived(
		f?.kind === 'createContactList' && f.success !== true ? (f.message ?? null) : null
	);
	const updateErr = $derived(
		f?.kind === 'updateContactList' && f.success !== true ? (f.message ?? null) : null
	);
	const deleteErr = $derived(
		f?.kind === 'softDeleteContactList' && f.success !== true ? (f.message ?? null) : null
	);
	const memberErr = $derived(
		(f?.kind === 'addContactListMember' || f?.kind === 'softDeleteContactListMember') &&
			f.success !== true
			? (f.message ?? null)
			: null
	);

	const selectedList = $derived(
		data.lists.find((l) => l.id === data.selectedListId) ?? null
	);

	const memberOptions = $derived.by(() => {
		if (memberKind === 'household') {
			return data.households.map((h) => ({ id: h.id, label: h.name }));
		}
		return data.contacts.map((c) => ({ id: c.id, label: c.display_name }));
	});

	function openCreate() {
		createName = '';
		createNotes = '';
		createOpen = true;
	}

	function openEdit(row: ContactListDef) {
		editRow = row;
		editName = row.name;
		editNotes = row.notes ?? '';
		editOpen = true;
	}

	function askDelete(row: ContactListDef) {
		deleteTarget = row;
		deleteOpen = true;
	}

	function selectList(id: string) {
		void goto(`/settings/contacts/lists?list=${id}`, { keepFocus: true, noScroll: true });
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
				memberId = '';
				await invalidate('app:contacts:lists');
			}
		};
	};

	const deleteEnhance: SubmitFunction = () => {
		deletePending = true;
		return async ({ result, update }) => {
			deletePending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				deleteOpen = false;
				deleteTarget = null;
				await invalidate('app:contacts:lists');
			}
		};
	};

	function submitDelete() {
		if (!deleteTarget || !deleteFormEl) return;
		const idInput = deleteFormEl.querySelector(
			'input[name="list_id"]'
		) as HTMLInputElement | null;
		if (!idInput) return;
		idInput.value = deleteTarget.id;
		deleteFormEl.requestSubmit();
	}
</script>

<svelte:head>
	<title>Contact lists — Settings — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
	<PageHeader
		title="Contact lists"
		subtitle="Christmas cards and other seasonal / mailing lists. Card lists hold households."
		back={{ href: '/settings', label: 'Settings' }}
	/>

	{#if data.notOwner}
		<div class="mt-6 rounded-lg border border-border bg-card p-5 text-card-foreground">
			<p class="font-medium">Owner-only</p>
			<p class="mt-1 text-sm text-muted-foreground">
				List management is limited to the account owner.
			</p>
		</div>
	{:else if data.loadError}
		<p class="mt-4 text-sm text-destructive" role="alert">{data.loadError}</p>
	{:else}
		<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
			<p class="text-sm text-muted-foreground">
				{data.lists.length} list{data.lists.length === 1 ? '' : 's'}
			</p>
			<Button type="button" class="gap-2" hotkey="b" onclick={openCreate}>
				<Plus class="size-4" /> New list
			</Button>
		</div>

		{#if deleteErr}
			<p class="mt-3 text-sm text-destructive" role="alert">{deleteErr}</p>
		{/if}

		<ul class="mt-4 space-y-2">
			{#each data.lists as list (list.id)}
				<li
					class="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-card-foreground"
				>
					<button
						type="button"
						class="min-w-0 flex-1 text-left"
						onclick={() => selectList(list.id)}
					>
						<p class="truncate text-sm font-medium">
							{list.name}
							{#if list.id === data.selectedListId}
								<span class="ml-1 text-xs font-normal text-primary">(selected)</span>
							{/if}
						</p>
						<p class="text-xs text-muted-foreground">
							{list.memberCount} member{list.memberCount === 1 ? '' : 's'}
							{#if list.notes}
								· {list.notes}
							{/if}
						</p>
					</button>
					<div class="flex shrink-0 gap-1">
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label="Edit list"
							onclick={() => openEdit(list)}
						>
							<Pencil class="size-4" />
						</Button>
						<Button
							type="button"
							variant="outline"
							size="icon-sm"
							class="text-destructive"
							aria-label="Delete list"
							onclick={() => askDelete(list)}
						>
							<Trash2 class="size-4" />
						</Button>
					</div>
				</li>
			{:else}
				<li
					class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
				>
					No lists yet.
				</li>
			{/each}
		</ul>

		{#if selectedList}
			<section class="mt-8">
				<h2 class="text-lg font-semibold tracking-tight">{selectedList.name} — members</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					Christmas cards should use households. Contact membership is for future email lists.
				</p>

				{#if memberErr}
					<p class="mt-3 text-sm text-destructive" role="alert">{memberErr}</p>
				{/if}

				<form
					method="POST"
					action="?/addContactListMember"
					use:enhance={enhanceMutation}
					class="mt-4 flex flex-wrap items-end gap-2"
				>
					<input type="hidden" name="list_id" value={selectedList.id} />
					<input type="hidden" name="member_kind" value={memberKind} />
					<div class="space-y-1">
						<Label>Type</Label>
						<Select.Root
							type="single"
							value={memberKind}
							onValueChange={(v) => {
								if (v === 'contact' || v === 'household') {
									memberKind = v;
									memberId = '';
								}
							}}
						>
							<Select.Trigger class="w-36" size="lg">
								{memberKind === 'household' ? 'Household' : 'Contact'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="household">Household</Select.Item>
								<Select.Item value="contact">Contact</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
					<div class="min-w-[12rem] flex-1 space-y-1">
						<Label>Member</Label>
						{#if memberKind === 'household'}
							<input type="hidden" name="household_id" value={memberId} />
						{:else}
							<input type="hidden" name="contact_id" value={memberId} />
						{/if}
						<Select.Root
							type="single"
							value={memberId || '__none__'}
							onValueChange={(v) => {
								memberId = !v || v === '__none__' ? '' : v;
							}}
						>
							<Select.Trigger class="w-full" size="lg">
								{memberOptions.find((o) => o.id === memberId)?.label ?? 'Select…'}
							</Select.Trigger>
							<Select.Content class="max-h-72">
								<Select.Item value="__none__">Select…</Select.Item>
								{#each memberOptions as o (o.id)}
									<Select.Item value={o.id}>{o.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<Button type="submit" hotkey="s" label="Add" disabled={!memberId} />
				</form>

				<ul class="mt-4 space-y-2">
					{#each data.members as m (m.id)}
						<li
							class="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
						>
							<div class="min-w-0">
								<p class="truncate text-sm font-medium">{m.label}</p>
								<p class="text-xs text-muted-foreground">
									{m.kind === 'household' ? 'Household' : 'Contact'}
								</p>
							</div>
							<form method="POST" action="?/softDeleteContactListMember" use:enhance={enhanceMutation}>
								<input type="hidden" name="member_id" value={m.id} />
								<Button
									type="submit"
									variant="outline"
									size="icon-sm"
									class="text-destructive"
									aria-label="Remove member"
								>
									<Trash2 class="size-4" />
								</Button>
							</form>
						</li>
					{:else}
						<li class="text-sm text-muted-foreground">No members on this list yet.</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</div>

{#if !data.notOwner}
	<Dialog.Root bind:open={createOpen}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>New list</Dialog.Title>
			</Dialog.Header>
			<form method="POST" action="?/createContactList" use:enhance={enhanceMutation} class="space-y-4">
				{#if createErr}
					<p class="text-sm text-destructive" role="alert">{createErr}</p>
				{/if}
				<div class="space-y-2">
					<Label for="create-name">Name</Label>
					<Input id="create-name" name="name" bind:value={createName} required />
				</div>
				<div class="space-y-2">
					<Label for="create-notes">Notes</Label>
					<Input id="create-notes" name="notes" bind:value={createNotes} />
				</div>
				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={() => (createOpen = false)} />
					<Button type="submit" hotkey="s" label="Save list" />
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Root>

	<Dialog.Root bind:open={editOpen}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>Edit list</Dialog.Title>
			</Dialog.Header>
			<form method="POST" action="?/updateContactList" use:enhance={enhanceMutation} class="space-y-4">
				<input type="hidden" name="list_id" value={editRow?.id ?? ''} />
				{#if updateErr}
					<p class="text-sm text-destructive" role="alert">{updateErr}</p>
				{/if}
				<div class="space-y-2">
					<Label for="edit-name">Name</Label>
					<Input id="edit-name" name="name" bind:value={editName} required />
				</div>
				<div class="space-y-2">
					<Label for="edit-notes">Notes</Label>
					<Input id="edit-notes" name="notes" bind:value={editNotes} />
				</div>
				<div class="flex justify-end gap-2">
					<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={() => (editOpen = false)} />
					<Button type="submit" hotkey="u" label="Update list" />
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Root>

	<form
		bind:this={deleteFormEl}
		method="POST"
		action="?/softDeleteContactList"
		class="hidden"
		use:enhance={deleteEnhance}
	>
		<input type="hidden" name="list_id" value="" />
	</form>

	<ConfirmDialog
		bind:open={deleteOpen}
		title="Delete list?"
		description={deleteTarget
			? `Remove “${deleteTarget.name}” and soft-delete its memberships?`
			: ''}
		confirmLabel={deletePending ? 'Deleting…' : 'Delete'}
		onConfirm={submitDelete}
	/>
{/if}

<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import ContactListAddPanel from '$lib/components/contact-list-add-panel.svelte';
	import LogCardsDialog from '$lib/components/log-cards-dialog.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import type {
		ContactListCandidate,
		HouseholdListCandidate
	} from '$lib/contacts/list-candidates';
	import {
		CONTACT_LIST_KIND_LABELS,
		CONTACT_LIST_KINDS,
		type ContactListDef,
		type ContactListKind,
		type ContactListMemberRow
	} from '$lib/types/contacts';
	import Copy from '@lucide/svelte/icons/copy';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let {
		lists,
		selectedListId,
		members,
		hiddenRetiredOnlyCount,
		householdCandidates = [],
		contactCandidates = [],
		todayYmd,
		isOwner,
		form
	}: {
		lists: ContactListDef[];
		selectedListId: string | null;
		members: ContactListMemberRow[];
		hiddenRetiredOnlyCount: number;
		householdCandidates?: HouseholdListCandidate[];
		contactCandidates?: ContactListCandidate[];
		/** @deprecated Rolling cadence UI removed — meet frequency is per-contact. */
		profileCadenceDefault?: number | null;
		todayYmd: string;
		isOwner: boolean;
		form: {
			kind?: string;
			message?: string;
			success?: boolean;
			listId?: string;
			memberId?: string;
			count?: number;
		} | null;
	} = $props();

	let createOpen = $state(false);
	let createName = $state('');
	let createNotes = $state('');
	let createKind = $state<ContactListKind>('standing');

	let editOpen = $state(false);
	let editRow = $state<ContactListDef | null>(null);
	let editName = $state('');
	let editNotes = $state('');
	let editKind = $state<ContactListKind>('standing');

	let cloneOpen = $state(false);
	let cloneRow = $state<ContactListDef | null>(null);
	let cloneName = $state('');

	let deleteOpen = $state(false);
	let deleteTarget = $state<ContactListDef | null>(null);
	let deletePending = $state(false);
	let deleteFormEl = $state<HTMLFormElement | null>(null);

	let cardsDialogOpen = $state(false);

	const createErr = $derived(
		form?.kind === 'createContactList' && form.success !== true ? (form.message ?? null) : null
	);
	const updateErr = $derived(
		form?.kind === 'updateContactList' && form.success !== true ? (form.message ?? null) : null
	);
	const cloneErr = $derived(
		form?.kind === 'cloneContactList' && form.success !== true ? (form.message ?? null) : null
	);
	const deleteErr = $derived(
		form?.kind === 'softDeleteContactList' && form.success !== true
			? (form.message ?? null)
			: null
	);
	const batchErr = $derived(
		(form?.kind === 'addContactListMembersBatch' || form?.kind === 'addContactListMember') &&
			form.success !== true
			? (form.message ?? null)
			: null
	);
	const removeMemberErr = $derived(
		form?.kind === 'softDeleteContactListMember' && form.success !== true
			? (form.message ?? null)
			: null
	);
	const batchOk = $derived(
		form?.kind === 'addContactListMembersBatch' && form.success === true
			? `Added ${form.count ?? 0} to the list.`
			: null
	);
	const cardsErr = $derived(
		form?.kind === 'logListCards' && form.success !== true ? (form.message ?? null) : null
	);

	const selectedList = $derived(lists.find((l) => l.id === selectedListId) ?? null);

	function openCreate() {
		createName = '';
		createNotes = '';
		createKind = 'standing';
		createOpen = true;
	}

	function openEdit(row: ContactListDef) {
		editRow = row;
		editName = row.name;
		editNotes = row.notes ?? '';
		editKind = row.kind ?? 'standing';
		editOpen = true;
	}

	function openClone(row: ContactListDef) {
		cloneRow = row;
		const year = new Date().getFullYear();
		cloneName = `${row.name} ${year}`;
		cloneOpen = true;
	}

	function askDelete(row: ContactListDef) {
		deleteTarget = row;
		deleteOpen = true;
	}

	function selectList(id: string) {
		void goto(`/contacts?tab=lists&list=${id}`, { keepFocus: true, noScroll: true });
	}

	const enhanceMutation: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				createOpen = false;
				editOpen = false;
				editRow = null;
				cloneOpen = false;
				cloneRow = null;
				deleteOpen = false;
				deleteTarget = null;
				await invalidate('app:contacts:list');
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
				await invalidate('app:contacts:list');
			}
		};
	};

	const cardsQuickEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				await invalidate('app:contacts:list');
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

	async function onCardsSaved() {
		await invalidate('app:contacts:list');
	}

	async function onMembersAdded() {
		await invalidate('app:contacts:list');
	}
</script>

{#if !isOwner}
	<div class="mt-4 rounded-lg border border-border bg-card p-5 text-card-foreground">
		<p class="font-medium">Owner-only</p>
		<p class="mt-1 text-sm text-muted-foreground">
			List management and card logging are limited to the account owner.
		</p>
	</div>
{:else}
	<p class="mt-4 text-xs text-muted-foreground">
		Meet frequency is set per contact (quarterly / semester / annual). The old profile cadence
		default no longer applies.
	</p>

	<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
		<p class="text-sm text-muted-foreground">
			{lists.length} list{lists.length === 1 ? '' : 's'}
		</p>
		<Button type="button" class="gap-2" onclick={openCreate}>
			<Plus class="size-4" /> New list
		</Button>
	</div>

	{#if deleteErr}
		<p class="mt-3 text-sm text-destructive" role="alert">{deleteErr}</p>
	{/if}
	{#if cardsErr && !cardsDialogOpen}
		<p class="mt-3 text-sm text-destructive" role="alert">{cardsErr}</p>
	{/if}
	{#if cloneErr && !cloneOpen}
		<p class="mt-3 text-sm text-destructive" role="alert">{cloneErr}</p>
	{/if}

	<ul class="mt-4 space-y-2">
		{#each lists as list (list.id)}
			<li
				class="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-card-foreground"
			>
				<button
					type="button"
					class="min-w-0 flex-1 text-left"
					onclick={() => selectList(list.id)}
				>
					<p class="flex flex-wrap items-center gap-1.5 truncate text-sm font-medium">
						{list.name}
						<Badge variant="secondary">{CONTACT_LIST_KIND_LABELS[list.kind]}</Badge>
						{#if list.id === selectedListId}
							<span class="text-xs font-normal text-primary">(selected)</span>
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
					{#if list.kind === 'ad_hoc'}
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label="Clone list"
							onclick={() => openClone(list)}
						>
							<Copy class="size-4" />
						</Button>
					{/if}
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
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<h2 class="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
						{selectedList.name}
						<Badge variant="outline">{CONTACT_LIST_KIND_LABELS[selectedList.kind]}</Badge>
					</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						Christmas cards use households. Contact membership is for future email lists.
						Households with no active members are hidden (membership kept).
					</p>
					{#if hiddenRetiredOnlyCount > 0}
						<p class="mt-2 text-xs text-muted-foreground">
							{hiddenRetiredOnlyCount} retired-only household{hiddenRetiredOnlyCount === 1
								? ''
								: 's'} hidden.
						</p>
					{/if}
				</div>
				<div class="flex shrink-0 flex-wrap gap-2">
					{#if selectedList.kind === 'ad_hoc'}
						<Button
							type="button"
							size="sm"
							variant="outline"
							onclick={() => openClone(selectedList)}
						>
							Clone list
						</Button>
					{/if}
					<form method="POST" action="?/logListCards" use:enhance={cardsQuickEnhance}>
						<input type="hidden" name="list_id" value={selectedList.id} />
						<Button type="submit" size="sm" variant="secondary">Log cards sent</Button>
					</form>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onclick={() => (cardsDialogOpen = true)}
					>
						Details…
					</Button>
				</div>
			</div>

			{#if batchErr}
				<p class="mt-3 text-sm text-destructive" role="alert">{batchErr}</p>
			{/if}
			{#if removeMemberErr}
				<p class="mt-3 text-sm text-destructive" role="alert">{removeMemberErr}</p>
			{/if}
			{#if batchOk}
				<p class="mt-3 text-sm text-emerald-700 dark:text-emerald-400" role="status">{batchOk}</p>
			{/if}

			<ContactListAddPanel
				listId={selectedList.id}
				{householdCandidates}
				{contactCandidates}
				errorMessage={batchErr}
				onAdded={onMembersAdded}
			/>

			<ul class="mt-4 space-y-2">
				{#each members as m (m.id)}
					<li
						class="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
					>
						<div class="min-w-0">
							<p class="truncate text-sm font-medium">{m.label}</p>
							<p class="text-xs text-muted-foreground">
								{m.kind === 'household' ? 'Household' : 'Contact'}
							</p>
						</div>
						<form
							method="POST"
							action="?/softDeleteContactListMember"
							use:enhance={enhanceMutation}
						>
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

	<Dialog.Root bind:open={createOpen}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>New list</Dialog.Title>
			</Dialog.Header>
			<form
				method="POST"
				action="?/createContactList"
				use:enhance={enhanceMutation}
				class="space-y-4"
			>
				{#if createErr}
					<p class="text-sm text-destructive" role="alert">{createErr}</p>
				{/if}
				<div class="space-y-2">
					<Label for="create-list-name">Name</Label>
					<Input id="create-list-name" name="name" bind:value={createName} required />
				</div>
				<div class="space-y-2">
					<Label>Kind</Label>
					<input type="hidden" name="kind" value={createKind} />
					<Select.Root
						type="single"
						value={createKind}
						onValueChange={(v) => {
							if (v && (CONTACT_LIST_KINDS as readonly string[]).includes(v)) {
								createKind = v as ContactListKind;
							}
						}}
					>
						<Select.Trigger class="w-full" size="lg">
							{CONTACT_LIST_KIND_LABELS[createKind]}
						</Select.Trigger>
						<Select.Content>
							{#each CONTACT_LIST_KINDS as k (k)}
								<Select.Item value={k}>{CONTACT_LIST_KIND_LABELS[k]}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2">
					<Label for="create-list-notes">Notes</Label>
					<Input id="create-list-notes" name="notes" bind:value={createNotes} />
				</div>
				<div class="flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						hotkey="Escape"
						label="Cancel"
						onclick={() => (createOpen = false)}
					/>
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
			<form
				method="POST"
				action="?/updateContactList"
				use:enhance={enhanceMutation}
				class="space-y-4"
			>
				<input type="hidden" name="list_id" value={editRow?.id ?? ''} />
				{#if updateErr}
					<p class="text-sm text-destructive" role="alert">{updateErr}</p>
				{/if}
				<div class="space-y-2">
					<Label for="edit-list-name">Name</Label>
					<Input id="edit-list-name" name="name" bind:value={editName} required />
				</div>
				<div class="space-y-2">
					<Label>Kind</Label>
					<input type="hidden" name="kind" value={editKind} />
					<Select.Root
						type="single"
						value={editKind}
						onValueChange={(v) => {
							if (v && (CONTACT_LIST_KINDS as readonly string[]).includes(v)) {
								editKind = v as ContactListKind;
							}
						}}
					>
						<Select.Trigger class="w-full" size="lg">
							{CONTACT_LIST_KIND_LABELS[editKind]}
						</Select.Trigger>
						<Select.Content>
							{#each CONTACT_LIST_KINDS as k (k)}
								<Select.Item value={k}>{CONTACT_LIST_KIND_LABELS[k]}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2">
					<Label for="edit-list-notes">Notes</Label>
					<Input id="edit-list-notes" name="notes" bind:value={editNotes} />
				</div>
				<div class="flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						hotkey="Escape"
						label="Cancel"
						onclick={() => (editOpen = false)}
					/>
					<Button type="submit" hotkey="u" label="Update list" />
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Root>

	<Dialog.Root bind:open={cloneOpen}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>Clone list</Dialog.Title>
				<Dialog.Description class="text-sm text-muted-foreground">
					Copies memberships into a new ad hoc list.
				</Dialog.Description>
			</Dialog.Header>
			<form
				method="POST"
				action="?/cloneContactList"
				use:enhance={enhanceMutation}
				class="space-y-4"
			>
				<input type="hidden" name="list_id" value={cloneRow?.id ?? ''} />
				{#if cloneErr}
					<p class="text-sm text-destructive" role="alert">{cloneErr}</p>
				{/if}
				<div class="space-y-2">
					<Label for="clone-list-name">New name</Label>
					<Input id="clone-list-name" name="name" bind:value={cloneName} required />
				</div>
				<div class="flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						hotkey="Escape"
						label="Cancel"
						onclick={() => (cloneOpen = false)}
					/>
					<Button type="submit" hotkey="s" label="Clone list" />
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

	<LogCardsDialog
		bind:open={cardsDialogOpen}
		list={selectedList}
		{todayYmd}
		errorMessage={cardsErr}
		onSaved={onCardsSaved}
	/>
{/if}

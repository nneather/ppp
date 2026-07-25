<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import ContactCadenceFields from '$lib/components/contact-cadence-fields.svelte';
	import ContactListAddPanel from '$lib/components/contact-list-add-panel.svelte';
	import LogCardsDialog from '$lib/components/log-cards-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { daysToCadence, formatCadenceLabel, type CadenceUnit } from '$lib/contacts/cadence';
	import type {
		ContactListCandidate,
		HouseholdListCandidate
	} from '$lib/contacts/list-candidates';
	import type {
		ContactListDef,
		ContactListMemberRow
	} from '$lib/types/contacts';
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
		profileCadenceDefault,
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
		profileCadenceDefault: number | null;
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

	let editOpen = $state(false);
	let editRow = $state<ContactListDef | null>(null);
	let editName = $state('');
	let editNotes = $state('');

	let deleteOpen = $state(false);
	let deleteTarget = $state<ContactListDef | null>(null);
	let deletePending = $state(false);
	let deleteFormEl = $state<HTMLFormElement | null>(null);

	let cardsDialogOpen = $state(false);

	let defaultAmount = $state('');
	let defaultUnit = $state<CadenceUnit>('months');

	$effect(() => {
		const parsed = daysToCadence(profileCadenceDefault ?? 90);
		defaultAmount = parsed ? String(parsed.amount) : '3';
		defaultUnit = parsed?.unit ?? 'months';
	});

	const createErr = $derived(
		form?.kind === 'createContactList' && form.success !== true ? (form.message ?? null) : null
	);
	const updateErr = $derived(
		form?.kind === 'updateContactList' && form.success !== true ? (form.message ?? null) : null
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
	const cadenceDefaultErr = $derived(
		form?.kind === 'updateContactCadenceDefault' && form.success !== true
			? (form.message ?? null)
			: null
	);
	const cadenceDefaultOk = $derived(
		form?.kind === 'updateContactCadenceDefault' && form.success === true
	);

	const selectedList = $derived(lists.find((l) => l.id === selectedListId) ?? null);

	const defaultLabel = $derived(
		formatCadenceLabel(profileCadenceDefault ?? 90)
	);

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
		void goto(`/contacts?tab=lists&list=${id}`, { keepFocus: true, noScroll: true });
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
	<section class="mt-4 rounded-lg border border-border bg-card px-3 py-3 text-card-foreground">
		<p class="text-sm font-medium">Default meet cadence</p>
		<p class="mt-0.5 text-xs text-muted-foreground">
			Used when a contact has no override. Currently every {defaultLabel}.
		</p>
		<form
			method="POST"
			action="?/updateContactCadenceDefault"
			use:enhance={enhanceMutation}
			class="mt-3 space-y-3"
		>
			{#if cadenceDefaultErr}
				<p class="text-sm text-destructive" role="alert">{cadenceDefaultErr}</p>
			{/if}
			{#if cadenceDefaultOk}
				<p class="text-sm text-emerald-700 dark:text-emerald-400" role="status">
					Default cadence saved.
				</p>
			{/if}
			<ContactCadenceFields
				bind:amount={defaultAmount}
				bind:unit={defaultUnit}
				amountId="profile_cadence_amount"
				unitId="profile_cadence_unit"
				label="Amount"
				allowEmpty={false}
				hint="Applies to new contacts and anyone without an override."
			/>
			<Button type="submit" size="sm" label="Save default" />
		</form>
	</section>

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
					<p class="truncate text-sm font-medium">
						{list.name}
						{#if list.id === selectedListId}
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
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<h2 class="text-lg font-semibold tracking-tight">{selectedList.name}</h2>
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

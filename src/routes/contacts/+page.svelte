<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import PageHeader from '$lib/components/page-header.svelte';
	import ContactFormSheet from '$lib/components/contact-form-sheet.svelte';
	import ContactsListsPanel from '$lib/components/contacts-lists-panel.svelte';
	import HouseholdFormSheet from '$lib/components/household-form-sheet.svelte';
	import LogContactDialog from '$lib/components/log-contact-dialog.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import { Input } from '$lib/components/ui/input';
	import {
		CONTACT_STATUS_LABELS,
		type ContactListFilter,
		type ContactListRow,
		type HouseholdRow
	} from '$lib/types/contacts';
	import { formatEffectiveCadence, formatHouseholdAddress } from '$lib/contacts/names';
	import { cn } from '$lib/utils';
	import Home from '@lucide/svelte/icons/home';
	import List from '@lucide/svelte/icons/list';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Users from '@lucide/svelte/icons/users';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type FormShape = {
		kind?: string;
		message?: string;
		success?: boolean;
		contactId?: string;
		householdId?: string;
		listId?: string;
		memberId?: string;
	};
	const f = $derived((form ?? null) as FormShape | null);

	let searchQ = $state('');

	$effect(() => {
		searchQ = data.filters.q ?? '';
	});

	let contactSheetOpen = $state(false);
	let contactSheetMode = $state<'create' | 'edit'>('create');
	let editingContact = $state<ContactListRow | null>(null);

	let householdSheetOpen = $state(false);
	let householdSheetMode = $state<'create' | 'edit'>('create');
	let editingHousehold = $state<HouseholdRow | null>(null);

	let logDialogOpen = $state(false);
	let logContact = $state<ContactListRow | null>(null);

	let deleteOpen = $state(false);
	let deleteKind = $state<'contact' | 'household'>('contact');
	let deleteContact = $state<ContactListRow | null>(null);
	let deleteHousehold = $state<HouseholdRow | null>(null);
	let deletePending = $state(false);
	let deleteContactFormEl = $state<HTMLFormElement | null>(null);
	let deleteHouseholdFormEl = $state<HTMLFormElement | null>(null);

	const contactSheetError = $derived.by(() => {
		if (!f || f.success === true) return null;
		if (f.kind === 'createContact' || f.kind === 'updateContact') return f.message ?? null;
		return null;
	});

	const householdSheetError = $derived.by(() => {
		if (!f || f.success === true) return null;
		if (f.kind === 'createHousehold' || f.kind === 'updateHousehold') return f.message ?? null;
		return null;
	});

	const logDialogError = $derived.by(() => {
		if (!f || f.success === true) return null;
		if (f.kind === 'logContactDetailed') return f.message ?? null;
		return null;
	});

	const deleteError = $derived.by(() => {
		if (!f || f.success === true) return null;
		if (f.kind === 'softDeleteContact' || f.kind === 'softDeleteHousehold')
			return f.message ?? null;
		return null;
	});

	const flashOk = $derived.by(() => {
		if (!f || f.success !== true) return null;
		if (f.kind === 'logContactQuick' || f.kind === 'logContactDetailed') return 'Contact logged.';
		if (f.kind === 'logHouseholdTouch') return 'Household touch logged.';
		if (f.kind === 'logListCards') {
			return 'Cards logged (does not clear due-to-meet).';
		}
		return null;
	});

	function openCreateContact() {
		contactSheetMode = 'create';
		editingContact = null;
		contactSheetOpen = true;
	}

	function openEditContact(c: ContactListRow) {
		contactSheetMode = 'edit';
		editingContact = c;
		contactSheetOpen = true;
	}

	function openCreateHousehold() {
		householdSheetMode = 'create';
		editingHousehold = null;
		householdSheetOpen = true;
	}

	function openEditHousehold(h: HouseholdRow) {
		householdSheetMode = 'edit';
		editingHousehold = h;
		householdSheetOpen = true;
	}

	function openLogDetailed(c: ContactListRow) {
		logContact = c;
		logDialogOpen = true;
	}

	function askDeleteContact(c: ContactListRow) {
		deleteKind = 'contact';
		deleteContact = c;
		deleteHousehold = null;
		deleteOpen = true;
	}

	function askDeleteHousehold(h: HouseholdRow) {
		deleteKind = 'household';
		deleteHousehold = h;
		deleteContact = null;
		deleteOpen = true;
	}

	function submitDelete() {
		if (deleteKind === 'household') {
			if (!deleteHousehold || !deleteHouseholdFormEl) return;
			const idInput = deleteHouseholdFormEl.querySelector(
				'input[name="household_id"]'
			) as HTMLInputElement | null;
			if (!idInput) return;
			idInput.value = deleteHousehold.id;
			deleteHouseholdFormEl.requestSubmit();
			return;
		}
		if (!deleteContact || !deleteContactFormEl) return;
		const idInput = deleteContactFormEl.querySelector(
			'input[name="contact_id"]'
		) as HTMLInputElement | null;
		if (!idInput) return;
		idInput.value = deleteContact.id;
		deleteContactFormEl.requestSubmit();
	}

	const deleteEnhance: SubmitFunction = () => {
		deletePending = true;
		return async ({ result, update }) => {
			deletePending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				deleteOpen = false;
				deleteContact = null;
				deleteHousehold = null;
				await invalidate('app:contacts:list');
			}
		};
	};

	const quickLogEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				await invalidate('app:contacts:list');
			}
		};
	};

	async function onSaved() {
		await invalidate('app:contacts:list');
	}

	function pushFilters(next: { status?: ContactListFilter; q?: string | null }) {
		const params = new URLSearchParams();
		params.set('tab', 'contacts');
		const status = next.status !== undefined ? next.status : data.filters.status;
		const q = next.q !== undefined ? next.q : data.filters.q;
		if (status !== 'active') params.set('status', status);
		if (q) params.set('q', q);
		const qs = params.toString();
		void goto(`/contacts?${qs}`, { keepFocus: true, noScroll: true });
	}

	function setTab(tab: 'contacts' | 'households' | 'lists') {
		const params = new URLSearchParams();
		if (tab !== 'contacts') params.set('tab', tab);
		if (tab === 'contacts') {
			if (data.filters.status !== 'active') params.set('status', data.filters.status);
			if (data.filters.q) params.set('q', data.filters.q);
		}
		if (tab === 'lists' && data.selectedListId) {
			params.set('list', data.selectedListId);
		}
		const qs = params.toString();
		void goto(`/contacts${qs ? `?${qs}` : ''}`, { keepFocus: true, noScroll: true });
	}

	function formatTouch(ymd: string | null): string {
		if (!ymd) return 'Never';
		const [y, m, d] = ymd.split('-').map((x) => Number.parseInt(x, 10));
		if (!y || !m || !d) return ymd;
		return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
			timeZone: 'UTC',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	const deleteTitle = $derived(
		deleteKind === 'household' ? 'Delete household?' : 'Delete contact?'
	);
	const deleteDescription = $derived.by(() => {
		if (deleteKind === 'household' && deleteHousehold) {
			return `Soft-delete “${deleteHousehold.name}”? Only works when it has no live members.`;
		}
		if (deleteContact) {
			return `Soft-delete “${deleteContact.display_name}”?`;
		}
		return 'This cannot be undone from this screen (audit log can restore).';
	});

	const tab = $derived(data.tab);
</script>

<svelte:head>
	<title>Contacts — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 pb-tabbar">
	<PageHeader
		title="Contacts"
		subtitle="Meet cadence and Christmas-card households."
	>
		{#snippet actions()}
			{#if data.isOwner}
				<div class="flex flex-wrap gap-2">
					<Button type="button" variant="outline" class="gap-2" onclick={openCreateHousehold}>
						<Home class="size-4" /> Household
					</Button>
					<Button type="button" class="gap-2" hotkey="b" onclick={openCreateContact}>
						<Plus class="size-4" />
						<HotkeyLabel label="New contact" mnemonic="b" />
					</Button>
				</div>
			{/if}
		{/snippet}
	</PageHeader>

	{#if data.loadError}
		<p class="mt-4 text-sm text-destructive" role="alert">{data.loadError}</p>
	{/if}

	{#if flashOk}
		<p class="mt-3 text-sm text-emerald-700 dark:text-emerald-400" role="status">{flashOk}</p>
	{/if}
	{#if deleteError}
		<p class="mt-3 text-sm text-destructive" role="alert">{deleteError}</p>
	{/if}

	<div class="mt-4 flex gap-1 overflow-x-auto border-b border-border sm:gap-2">
		<button
			type="button"
			class={cn(
				'-mb-px shrink-0 border-b-2 px-2.5 py-2 text-sm font-medium sm:px-3',
				tab === 'contacts'
					? 'border-foreground text-foreground'
					: 'border-transparent text-muted-foreground'
			)}
			onclick={() => setTab('contacts')}
		>
			<Users class="mr-1 inline size-4" />
			Contacts
		</button>
		<button
			type="button"
			class={cn(
				'-mb-px shrink-0 border-b-2 px-2.5 py-2 text-sm font-medium sm:px-3',
				tab === 'households'
					? 'border-foreground text-foreground'
					: 'border-transparent text-muted-foreground'
			)}
			onclick={() => setTab('households')}
		>
			<Home class="mr-1 inline size-4" />
			Households
		</button>
		<button
			type="button"
			class={cn(
				'-mb-px shrink-0 border-b-2 px-2.5 py-2 text-sm font-medium sm:px-3',
				tab === 'lists'
					? 'border-foreground text-foreground'
					: 'border-transparent text-muted-foreground'
			)}
			onclick={() => setTab('lists')}
		>
			<List class="mr-1 inline size-4" />
			Lists
		</button>
	</div>

	{#if tab === 'contacts'}
		<div class="mt-4 flex flex-wrap items-center gap-2">
			<div class="flex gap-1 rounded-lg border border-border p-0.5">
				{#each [
					{ value: 'active' as const, label: 'Active' },
					{ value: 'retired' as const, label: 'Retired' },
					{ value: 'all' as const, label: 'All' }
				] as opt (opt.value)}
					<button
						type="button"
						class={cn(
							'rounded-md px-2.5 py-1 text-xs font-medium',
							data.filters.status === opt.value
								? 'bg-foreground text-background'
								: 'text-muted-foreground hover:text-foreground'
						)}
						onclick={() => pushFilters({ status: opt.value })}
					>
						{opt.label}
					</button>
				{/each}
			</div>
			<form
				class="min-w-[10rem] flex-1"
				onsubmit={(e) => {
					e.preventDefault();
					pushFilters({ q: searchQ.trim() || null });
				}}
			>
				<Input
					type="search"
					placeholder="Search name, email, phone…"
					bind:value={searchQ}
					class="h-9"
				/>
			</form>
		</div>

		<ul class="mt-4 space-y-2">
			{#each data.contacts as c (c.id)}
				<li
					class="rounded-lg border border-border bg-card px-3 py-3 text-card-foreground"
				>
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="truncate font-medium">{c.display_name}</p>
							<p class="mt-0.5 text-xs text-muted-foreground">
								{CONTACT_STATUS_LABELS[c.status]}
								{#if c.household_name}
									· {c.household_name}
								{/if}
								{#if c.no_reminders}
									· no reminders
								{/if}
							</p>
							<p class="mt-0.5 text-xs text-muted-foreground">
								Last meet: {formatTouch(c.last_touched_on)}
								· {formatEffectiveCadence(c.effective_cadence_days)}
							</p>
							{#if c.email || c.phone}
								<p class="mt-0.5 truncate text-xs text-muted-foreground">
									{[c.email, c.phone].filter(Boolean).join(' · ')}
								</p>
							{/if}
						</div>
						{#if data.isOwner}
							<div class="flex shrink-0 flex-col items-end gap-1">
								<form method="POST" action="?/logContactQuick" use:enhance={quickLogEnhance}>
									<input type="hidden" name="contact_id" value={c.id} />
									<Button type="submit" size="sm" variant="secondary">Log Contact</Button>
								</form>
								<div class="flex gap-1">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onclick={() => openLogDetailed(c)}
									>
										Details
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										aria-label="Edit contact"
										onclick={() => openEditContact(c)}
									>
										<Pencil class="size-4" />
									</Button>
									<Button
										type="button"
										variant="outline"
										size="icon-sm"
										class="text-destructive"
										aria-label="Delete contact"
										onclick={() => askDeleteContact(c)}
									>
										<Trash2 class="size-4" />
									</Button>
								</div>
							</div>
						{/if}
					</div>
				</li>
			{:else}
				<li
					class="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground"
				>
					No contacts yet. Add people before Thanksgiving for Christmas cards.
				</li>
			{/each}
		</ul>
	{:else if tab === 'households'}
		<ul class="mt-4 space-y-2">
			{#each data.households as h (h.id)}
				{@const addr = formatHouseholdAddress(h)}
				<li
					class="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3 text-card-foreground"
				>
					<div class="min-w-0">
						<p class="truncate font-medium">{h.name}</p>
						<p class="mt-0.5 text-xs text-muted-foreground">
							{h.memberCount} member{h.memberCount === 1 ? '' : 's'}
							{#if addr}
								· {addr}
							{/if}
						</p>
					</div>
					{#if data.isOwner}
						<div class="flex shrink-0 gap-1">
							<form method="POST" action="?/logHouseholdTouch" use:enhance={quickLogEnhance}>
								<input type="hidden" name="household_id" value={h.id} />
								<Button type="submit" size="sm" variant="secondary">Log all</Button>
							</form>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label="Edit household"
								onclick={() => openEditHousehold(h)}
							>
								<Pencil class="size-4" />
							</Button>
							<Button
								type="button"
								variant="outline"
								size="icon-sm"
								class="text-destructive"
								aria-label="Delete household"
								onclick={() => askDeleteHousehold(h)}
							>
								<Trash2 class="size-4" />
							</Button>
						</div>
					{/if}
				</li>
			{:else}
				<li
					class="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground"
				>
					No households yet. Create one for Christmas cards, or add a mailing address on a contact.
				</li>
			{/each}
		</ul>
	{:else}
		<ContactsListsPanel
			lists={data.lists}
			selectedListId={data.selectedListId}
			members={data.members}
			hiddenRetiredOnlyCount={data.hiddenRetiredOnlyCount}
			householdCandidates={data.householdCandidates}
			contactCandidates={data.contactCandidates}
			profileCadenceDefault={data.profileCadenceDefault}
			todayYmd={data.todayYmd}
			isOwner={data.isOwner}
			form={f}
		/>
	{/if}
</div>

{#if data.isOwner}
	<ContactFormSheet
		bind:open={contactSheetOpen}
		mode={contactSheetMode}
		contact={editingContact}
		households={data.households}
		lists={data.lists}
		memberListIds={editingContact
			? (data.listIdsByContactId[editingContact.id] ?? [])
			: []}
		profileCadenceDefault={data.profileCadenceDefault}
		errorMessage={contactSheetError}
		onSaved={onSaved}
	/>
	<HouseholdFormSheet
		bind:open={householdSheetOpen}
		mode={householdSheetMode}
		household={editingHousehold}
		lists={data.lists}
		memberListIds={editingHousehold
			? (data.listIdsByHouseholdId[editingHousehold.id] ?? [])
			: []}
		errorMessage={householdSheetError}
		onSaved={onSaved}
	/>
	<LogContactDialog
		bind:open={logDialogOpen}
		contact={logContact}
		todayYmd={data.todayYmd}
		errorMessage={logDialogError}
		onSaved={onSaved}
	/>

	<form
		bind:this={deleteContactFormEl}
		method="POST"
		action="?/softDeleteContact"
		class="hidden"
		use:enhance={deleteEnhance}
	>
		<input type="hidden" name="contact_id" value="" />
	</form>
	<form
		bind:this={deleteHouseholdFormEl}
		method="POST"
		action="?/softDeleteHousehold"
		class="hidden"
		use:enhance={deleteEnhance}
	>
		<input type="hidden" name="household_id" value="" />
	</form>

	<ConfirmDialog
		bind:open={deleteOpen}
		title={deleteTitle}
		description={deleteDescription}
		confirmLabel={deletePending ? 'Deleting…' : 'Delete'}
		onConfirm={submitDelete}
	/>
{/if}

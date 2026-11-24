<script lang="ts">
	/**
	 * One contact list's members — the body of /contacts/lists/[listId].
	 * Households first (address + confirm status, filter chips, find box);
	 * adding members sits collapsed at the bottom.
	 */
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ContactListAddPanel from '$lib/components/contact-list-add-panel.svelte';
	import LogCardsDialog from '$lib/components/log-cards-dialog.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { ContactListCandidate, HouseholdListCandidate } from '$lib/contacts/list-candidates';
	import {
		CONTACT_LIST_KIND_LABELS,
		type ContactListDef,
		type ContactListMemberRow
	} from '$lib/types/contacts';
	import Check from '@lucide/svelte/icons/check';
	import Search from '@lucide/svelte/icons/search';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let {
		list,
		members,
		hiddenRetiredOnlyCount,
		householdCandidates = [],
		contactCandidates = [],
		todayYmd,
		form,
		onEditHousehold
	}: {
		list: ContactListDef;
		members: ContactListMemberRow[];
		hiddenRetiredOnlyCount: number;
		householdCandidates?: HouseholdListCandidate[];
		contactCandidates?: ContactListCandidate[];
		todayYmd: string;
		form: { kind?: string; message?: string; success?: boolean; count?: number } | null;
		/** Opens the household sheet (address edits stamp `address_updated_on`). */
		onEditHousehold?: (householdId: string) => void;
	} = $props();

	const errFor = (...kinds: string[]) =>
		form?.kind && kinds.includes(form.kind) && form.success !== true
			? (form.message ?? null)
			: null;
	const batchErr = $derived(errFor('addContactListMembersBatch', 'addContactListMember'));
	const removeMemberErr = $derived(errFor('softDeleteContactListMember'));
	const cardsErr = $derived(errFor('logListCards'));
	const confirmErr = $derived(errFor('setHouseholdAddressConfirmed'));
	const batchOk = $derived(
		form?.kind === 'addContactListMembersBatch' && form.success === true
			? `Added ${form.count ?? 0} to the list.`
			: null
	);

	let cardsDialogOpen = $state(false);

	/* ── Filter + find ──────────────────────────────────────────────────── */
	const ADDRESS_FILTERS = ['all', 'confirmed', 'unconfirmed', 'none'] as const;
	type AddressFilter = (typeof ADDRESS_FILTERS)[number];
	const ADDRESS_FILTER_LABELS: Record<AddressFilter, string> = {
		all: 'All',
		confirmed: 'Confirmed',
		unconfirmed: 'Needs confirm',
		none: 'No address'
	};
	let addressFilter = $state<AddressFilter>('all');
	let query = $state('');

	const hasHouseholds = $derived(members.some((m) => m.kind === 'household'));
	const addressCounts = $derived.by(() => {
		const c: Record<AddressFilter, number> = {
			all: members.length,
			confirmed: 0,
			unconfirmed: 0,
			none: 0
		};
		for (const m of members) if (m.kind === 'household' && m.addressStatus) c[m.addressStatus] += 1;
		return c;
	});
	const visibleMembers = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return members
			.filter(
				(m) =>
					addressFilter === 'all' || (m.kind === 'household' && m.addressStatus === addressFilter)
			)
			.filter(
				(m) =>
					!q || m.label.toLowerCase().includes(q) || (m.address ?? '').toLowerCase().includes(q)
			)
			.sort((a, b) => a.label.localeCompare(b.label));
	});

	/* ── Confirm / Undo ─────────────────────────────────────────────────── */
	/** household_id → prior address_updated_on, for Undo after a Confirm this session. */
	let undoPrev = $state<Record<string, string | null>>({});

	function shortDate(ymd: string): string {
		const [, mo, d] = ymd.split('-');
		return `${Number(mo)}/${Number(d)}`;
	}

	const confirmEnhance: SubmitFunction = ({ formData }) => {
		const hid = String(formData.get('household_id') ?? '');
		const isUndo = formData.get('undo') === '1';
		return async ({ result, update }) => {
			await update({ reset: false, invalidateAll: false });
			if (result.type === 'success') {
				if (isUndo) {
					const { [hid]: _drop, ...rest } = undoPrev;
					undoPrev = rest;
				} else {
					const prev = (result.data as { previous?: string | null } | undefined)?.previous;
					undoPrev = { ...undoPrev, [hid]: prev ?? null };
				}
				await invalidate('app:contacts:list');
			}
		};
	};

	const refreshEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') await invalidate('app:contacts:list');
		};
	};

	async function refresh() {
		await invalidate('app:contacts:list');
	}
</script>

<div class="flex flex-wrap items-start justify-between gap-3">
	<div class="min-w-0">
		<h1 class="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
			{list.name}
			<Badge variant="outline">{CONTACT_LIST_KIND_LABELS[list.kind]}</Badge>
		</h1>
		{#if hiddenRetiredOnlyCount > 0}
			<p class="mt-1 text-xs text-muted-foreground">
				{hiddenRetiredOnlyCount} retired-only household{hiddenRetiredOnlyCount === 1 ? '' : 's'} hidden.
			</p>
		{/if}
	</div>
	<div class="flex shrink-0 flex-wrap gap-2">
		{#if list.kind === 'ad_hoc'}
			<Button href="/contacts/postcards/{list.id}" size="sm">Send postcards</Button>
		{/if}
		<form method="POST" action="?/logListCards" use:enhance={refreshEnhance}>
			<input type="hidden" name="list_id" value={list.id} />
			<Button type="submit" size="sm" variant="secondary">Log cards sent</Button>
		</form>
		<Button type="button" size="sm" variant="outline" onclick={() => (cardsDialogOpen = true)}>
			Details…
		</Button>
	</div>
</div>

{#if cardsErr && !cardsDialogOpen}
	<p class="mt-3 text-sm text-destructive" role="alert">{cardsErr}</p>
{/if}
{#if removeMemberErr}
	<p class="mt-3 text-sm text-destructive" role="alert">{removeMemberErr}</p>
{/if}

<div class="mt-4 flex flex-wrap items-center gap-1.5">
	{#if hasHouseholds}
		<div class="flex flex-wrap gap-1.5" role="group" aria-label="Address filter">
			{#each ADDRESS_FILTERS as fl (fl)}
				<Button
					type="button"
					size="sm"
					variant={addressFilter === fl ? 'default' : 'outline'}
					onclick={() => (addressFilter = fl)}
				>
					{ADDRESS_FILTER_LABELS[fl]}
					<span class="tabular-nums opacity-70">{addressCounts[fl]}</span>
				</Button>
			{/each}
		</div>
	{/if}
	<div class="relative w-full sm:ml-auto sm:w-56">
		<Search
			class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
		/>
		<Input
			type="search"
			placeholder="Find a name or address…"
			aria-label="Find on this list"
			class="h-8 pl-8"
			bind:value={query}
		/>
	</div>
</div>
{#if confirmErr}
	<p class="mt-2 text-sm text-destructive" role="alert">{confirmErr}</p>
{/if}

<ul class="mt-3 divide-y divide-border rounded-lg border border-border">
	{#each visibleMembers as m (m.id)}
		<li class="flex items-center gap-2 px-3 py-1.5">
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium">{m.label}</p>
				{#if m.kind === 'household'}
					<p class="truncate text-xs text-muted-foreground">{m.address || '— no address'}</p>
				{:else}
					<p class="text-xs text-muted-foreground">Contact</p>
				{/if}
			</div>
			{#if m.kind === 'household' && m.household_id}
				{@const hid = m.household_id}
				{#if m.addressStatus === 'confirmed'}
					<Badge variant="secondary" class="shrink-0 text-emerald-700 dark:text-emerald-400">
						✓ {m.addressUpdatedOn ? shortDate(m.addressUpdatedOn) : ''}
					</Badge>
					{#if hid in undoPrev}
						<form
							method="POST"
							action="?/setHouseholdAddressConfirmed"
							use:enhance={confirmEnhance}
						>
							<input type="hidden" name="household_id" value={hid} />
							<input type="hidden" name="undo" value="1" />
							<input type="hidden" name="restore_to" value={undoPrev[hid] ?? ''} />
							<Button type="submit" size="sm" variant="ghost">Undo</Button>
						</form>
					{/if}
				{:else if m.addressStatus === 'unconfirmed'}
					<Badge
						variant="outline"
						class="hidden shrink-0 text-amber-700 sm:inline-flex dark:text-amber-400"
					>
						Unconfirmed
					</Badge>
					<form method="POST" action="?/setHouseholdAddressConfirmed" use:enhance={confirmEnhance}>
						<input type="hidden" name="household_id" value={hid} />
						<Button type="submit" size="sm" variant="secondary" class="gap-1">
							<Check class="size-3.5" /> Confirm
						</Button>
					</form>
				{/if}
				{#if onEditHousehold}
					<Button type="button" size="sm" variant="ghost" onclick={() => onEditHousehold?.(hid)}>
						{m.addressStatus === 'none' ? 'Add address' : 'Edit'}
					</Button>
				{/if}
			{/if}
			<form method="POST" action="?/softDeleteContactListMember" use:enhance={refreshEnhance}>
				<input type="hidden" name="member_id" value={m.id} />
				<Button
					type="submit"
					variant="outline"
					size="icon-sm"
					class="text-destructive"
					aria-label="Remove from list"
				>
					<Trash2 class="size-4" />
				</Button>
			</form>
		</li>
	{:else}
		<li class="px-3 py-2 text-sm text-muted-foreground">
			{members.length ? 'Nothing matches.' : 'No members on this list yet.'}
		</li>
	{/each}
</ul>

<details class="mt-4 rounded-lg border border-border px-3 py-2" open={members.length === 0}>
	<summary class="cursor-pointer text-sm font-medium"
		>Add households or contacts to this list</summary
	>
	{#if batchErr}
		<p class="mt-3 text-sm text-destructive" role="alert">{batchErr}</p>
	{/if}
	{#if batchOk}
		<p class="mt-3 text-sm text-emerald-700 dark:text-emerald-400" role="status">{batchOk}</p>
	{/if}
	<ContactListAddPanel
		listId={list.id}
		{householdCandidates}
		{contactCandidates}
		errorMessage={batchErr}
		onAdded={refresh}
	/>
	<p class="mt-2 text-xs text-muted-foreground">
		Christmas cards use households. Households with no active members are hidden (membership kept).
	</p>
</details>

<LogCardsDialog
	bind:open={cardsDialogOpen}
	{list}
	{todayYmd}
	errorMessage={cardsErr}
	onSaved={refresh}
/>

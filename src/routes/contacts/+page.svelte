<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
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
		CONTACT_FREQUENCY_SHORT_LABELS,
		CONTACT_SORT_KEY_LABELS,
		CONTACT_SORT_KEYS,
		CONTACT_STATUS_LABELS,
		HOUSEHOLD_SORT_KEYS,
		type ContactListFilter,
		type ContactListRow,
		type ContactSortKey,
		type ContactsListFilters,
		type HouseholdRow
	} from '$lib/types/contacts';
	import { formatHouseholdAddress } from '$lib/contacts/names';
	import { contactMatchesQuery, householdMatchesQuery } from '$lib/contacts/search';
	import {
		applicableSortKeys,
		buildSortContext,
		contactGroupLabel,
		contactSortEquals,
		contactsListFiltersToSearchParams,
		groupSortedRows,
		householdGroupLabel,
		listNamesForContact,
		listNamesForHousehold,
		sortContacts,
		sortHouseholds,
		uniqueGroupHeaders
	} from '$lib/contacts/sort';
	import { cn } from '$lib/utils';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Home from '@lucide/svelte/icons/home';
	import List from '@lucide/svelte/icons/list';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Users from '@lucide/svelte/icons/users';
	import X from '@lucide/svelte/icons/x';
	import type { PageProps } from './$types';

	const Q_DEBOUNCE_MS = 300;

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

	let searchQ = $state(page.url.searchParams.get('q') ?? '');
	let lastUrlQ = $state(page.url.searchParams.get('q') ?? '');
	let dueOpen = $state(false);
	let qDebounce: number | null = null;

	$effect(() => {
		const urlQ = page.url.searchParams.get('q') ?? '';
		if (urlQ === lastUrlQ) return;
		lastUrlQ = urlQ;
		searchQ = urlQ;
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
		if (f.kind === 'skipContactPeriod') return 'Skipped for this period.';
		if (f.kind === 'setContactsDefaultSort') return 'Default grouping saved.';
		if (f.kind === 'importSheet') {
			const r = f as FormShape & {
				contactsCreated?: number;
				householdsCreated?: number;
			};
			return `Import done: ${r.householdsCreated ?? 0} households, ${r.contactsCreated ?? 0} contacts.`;
		}
		if (f.kind === 'applyVCardImport') {
			const r = f as FormShape & { updated?: number; unmatchedCount?: number };
			return `vCard: updated ${r.updated ?? 0}; unmatched ${r.unmatchedCount ?? 0}.`;
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

	const defaultSortEnhance: SubmitFunction = () => {
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

	function gotoFilters(next: {
		tab?: 'contacts' | 'households' | 'lists';
		status?: ContactListFilter;
		q?: string | null;
		listId?: string | null;
		sort?: ContactSortKey[];
	}) {
		const filters: ContactsListFilters = {
			status: next.status !== undefined ? next.status : data.filters.status,
			q: next.q !== undefined ? next.q : searchQ.trim() || null,
			listId: next.listId !== undefined ? next.listId : data.filters.listId,
			sort: next.sort !== undefined ? next.sort : data.filters.sort
		};
		const params = contactsListFiltersToSearchParams({
			tab: next.tab ?? data.tab,
			filters,
			selectedListId: data.selectedListId,
			defaultSort: data.defaultSort
		});
		const qs = params.toString();
		lastUrlQ = filters.q ?? '';
		void goto(`/contacts${qs ? `?${qs}` : ''}`, { keepFocus: true, noScroll: true });
	}

	function pushFilters(next: {
		status?: ContactListFilter;
		q?: string | null;
		listId?: string | null;
	}) {
		gotoFilters({ tab: 'contacts', ...next });
	}

	function setTab(tab: 'contacts' | 'households' | 'lists') {
		gotoFilters({ tab });
	}

	function setPrimarySort(entity: 'contact' | 'household', key: ContactSortKey) {
		const current = applicableSortKeys(data.filters.sort, entity);
		const then = current[1];
		const sort: ContactSortKey[] = [key];
		if (then && then !== key) sort.push(then);
		gotoFilters({ sort });
	}

	function setThenSort(entity: 'contact' | 'household', key: ContactSortKey | '') {
		const current = applicableSortKeys(data.filters.sort, entity);
		const primary = current[0] ?? 'name';
		const sort: ContactSortKey[] = [primary];
		if (key && key !== primary) sort.push(key);
		gotoFilters({ sort });
	}

	function onSearchInput(e: Event & { currentTarget: HTMLInputElement }) {
		searchQ = e.currentTarget.value;
		if (!browser) return;
		if (qDebounce != null) clearTimeout(qDebounce);
		qDebounce = window.setTimeout(() => {
			gotoFilters({ q: searchQ.trim() || null });
		}, Q_DEBOUNCE_MS);
	}

	function clearSearch() {
		searchQ = '';
		if (qDebounce != null) clearTimeout(qDebounce);
		qDebounce = null;
		gotoFilters({ q: null });
	}

	const sortCtx = $derived(
		buildSortContext(data.lists, {
			listIdsByContactId: data.listIdsByContactId,
			listIdsByHouseholdId: data.listIdsByHouseholdId
		})
	);

	const searchActive = $derived(searchQ.trim().length > 0);

	const memberNamesByHouseholdId = $derived.by(() => {
		const map: Record<string, string[]> = {};
		for (const c of data.contacts) {
			if (!c.household_id) continue;
			const arr = map[c.household_id] ?? [];
			arr.push(c.display_name);
			map[c.household_id] = arr;
		}
		return map;
	});

	const filteredContacts = $derived.by(() => {
		if (!searchActive) return data.contacts;
		const q = searchQ;
		return data.contacts.filter((c) =>
			contactMatchesQuery(c, q, listNamesForContact(c.id, c.household_id, sortCtx))
		);
	});

	const filteredHouseholds = $derived.by(() => {
		if (!searchActive) return data.households;
		const q = searchQ;
		return data.households.filter((h) =>
			householdMatchesQuery(h, q, {
				listNames: listNamesForHousehold(h.id, sortCtx),
				memberNames: memberNamesByHouseholdId[h.id] ?? []
			})
		);
	});

	const contactGroups = $derived.by(() => {
		const spec = applicableSortKeys(data.filters.sort, 'contact');
		const primary = spec[0] ?? 'name';
		return groupSortedRows(sortContacts(filteredContacts, spec, sortCtx), (c) =>
			contactGroupLabel(c, primary, sortCtx)
		);
	});

	const householdGroups = $derived.by(() => {
		const spec = applicableSortKeys(data.filters.sort, 'household');
		const primary = spec[0] ?? 'name';
		return groupSortedRows(sortHouseholds(filteredHouseholds, spec, sortCtx), (h) =>
			householdGroupLabel(h, primary, sortCtx)
		);
	});

	const contactPrimary = $derived(
		applicableSortKeys(data.filters.sort, 'contact')[0] ?? 'name'
	);
	const householdPrimary = $derived(
		applicableSortKeys(data.filters.sort, 'household')[0] ?? 'name'
	);

	const contactGroupIndex = $derived.by(() => {
		if (searchActive) return [] as string[];
		return uniqueGroupHeaders(contactGroups.map((g) => g.header));
	});

	const householdGroupIndex = $derived.by(() => {
		if (searchActive) return [] as string[];
		return uniqueGroupHeaders(householdGroups.map((g) => g.header));
	});

	function contactMetaLine(c: ContactListRow, listLabels: string[]): string {
		const spec = applicableSortKeys(data.filters.sort, 'contact');
		const parts: string[] = [];
		if (contactPrimary !== 'frequency') parts.push(CONTACT_FREQUENCY_SHORT_LABELS[c.frequency]);
		const household = c.household_name?.trim();
		if (household && household.toLowerCase() !== c.display_name.trim().toLowerCase()) {
			parts.push(household);
		}
		parts.push(formatTouch(c.last_touched_on));
		if (spec.includes('list') && contactPrimary !== 'list' && listLabels.length > 0) {
			parts.push(listLabels.join(' · '));
		}
		if (c.status !== 'active') parts.push(CONTACT_STATUS_LABELS[c.status]);
		if (spec.includes('giving') && contactPrimary !== 'giving' && c.giving_grade) {
			parts.push(`Giving ${c.giving_grade}`);
		}
		if (spec.includes('relationship') && contactPrimary !== 'relationship' && c.relationship_grade) {
			parts.push(`Rel ${c.relationship_grade}`);
		}
		return parts.join(' · ');
	}

	function householdMetaLine(h: HouseholdRow, listLabels: string[]): string {
		const spec = applicableSortKeys(data.filters.sort, 'household');
		const parts = [`${h.memberCount} member${h.memberCount === 1 ? '' : 's'}`];
		if (spec.includes('list') && householdPrimary !== 'list' && listLabels.length > 0) {
			parts.push(listLabels.join(' · '));
		}
		if (spec.includes('giving') && householdPrimary !== 'giving' && h.giving_grade) {
			parts.push(`Giving ${h.giving_grade}`);
		}
		if (spec.includes('relationship') && householdPrimary !== 'relationship' && h.relationship_grade) {
			parts.push(`Rel ${h.relationship_grade}`);
		}
		const addr = formatHouseholdAddress(h);
		if (addr) parts.push(addr);
		return parts.join(' · ');
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

	function letterAnchorId(entity: 'contact' | 'household', letter: string): string {
		return `${entity}-letter-${encodeURIComponent(letter)}`;
	}
</script>

<svelte:head>
	<title>Contacts — ppp</title>
</svelte:head>

{#snippet sortControls(entity: 'contact' | 'household')}
	{@const keys = entity === 'household' ? HOUSEHOLD_SORT_KEYS : CONTACT_SORT_KEYS}
	{@const spec = applicableSortKeys(data.filters.sort, entity)}
	{@const primary = spec[0] ?? 'name'}
	{@const thenKey = spec[1] ?? ''}
	<div class="flex flex-wrap items-center gap-1.5">
		<span class="text-xs text-muted-foreground">Group</span>
		<label class="sr-only" for={`contact-sort-${entity}`}>Group by</label>
		<select
			id={`contact-sort-${entity}`}
			class="h-9 rounded-md border border-border bg-background px-2 text-xs"
			value={primary}
			onchange={(e) =>
				setPrimarySort(entity, (e.currentTarget as HTMLSelectElement).value as ContactSortKey)}
		>
			{#each keys as k (k)}
				<option value={k}>{CONTACT_SORT_KEY_LABELS[k]}</option>
			{/each}
		</select>
		<span class="text-xs text-muted-foreground">then</span>
		<label class="sr-only" for={`contact-sort-then-${entity}`}>Then by</label>
		<select
			id={`contact-sort-then-${entity}`}
			class="h-9 rounded-md border border-border bg-background px-2 text-xs"
			value={thenKey}
			onchange={(e) =>
				setThenSort(entity, (e.currentTarget as HTMLSelectElement).value as ContactSortKey | '')}
		>
			<option value="">—</option>
			{#each keys as k (k)}
				{#if k !== primary}
					<option value={k}>{CONTACT_SORT_KEY_LABELS[k]}</option>
				{/if}
			{/each}
		</select>
		{#if entity === 'contact' && data.isOwner}
			{#if contactSortEquals(data.filters.sort, data.defaultSort)}
				<span class="text-xs text-muted-foreground">Default</span>
			{:else}
				<form method="POST" action="?/setContactsDefaultSort" use:enhance={defaultSortEnhance}>
					<input type="hidden" name="sort" value={data.filters.sort.join(',')} />
					<button
						type="submit"
						class="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
					>
						Set default
					</button>
				</form>
			{/if}
		{/if}
	</div>
{/snippet}

{#snippet groupJump(entity: 'contact' | 'household', letters: string[], label: string)}
	{#if letters.length > 1}
		<nav class="flex flex-wrap gap-1" aria-label={label}>
			{#each letters as L (L)}
				<a
					href={`#${letterAnchorId(entity, L)}`}
					class="inline-flex min-w-6 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					{L}
				</a>
			{/each}
		</nav>
	{/if}
{/snippet}

{#snippet rosterGroupHeader(entity: 'contact' | 'household', header: string, count: number)}
	<li class="list-none bg-muted/50 px-3 py-1">
		<p
			id={letterAnchorId(entity, header)}
			class="scroll-mt-40 flex items-baseline justify-between gap-3 text-xs font-semibold text-muted-foreground"
		>
			<span class={header.length <= 2 ? 'uppercase tracking-wide' : ''}>{header}</span>
			<span class="font-normal tabular-nums">{count}</span>
		</p>
	</li>
{/snippet}

{#snippet rosterSearch(placeholder: string, resultLabel: string, shown: number, total: number)}
	<div class="relative min-w-0 flex-1">
		<Search
			class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
		/>
		<Input
			type="search"
			placeholder={placeholder}
			value={searchQ}
			oninput={onSearchInput}
			class="h-9 pl-9 pr-9"
			aria-label={placeholder}
		/>
		{#if searchActive}
			<button
				type="button"
				class="absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
				aria-label="Clear search"
				onclick={clearSearch}
			>
				<X class="size-4" />
			</button>
		{/if}
	</div>
	<p class="w-full text-xs text-muted-foreground sm:w-auto sm:shrink-0">
		{#if searchActive}
			{shown} of {total} {resultLabel}
		{:else}
			{total} {resultLabel}
		{/if}
	</p>
{/snippet}

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 pb-tabbar">
	<PageHeader title="Contacts">
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
		<div
			class="sticky top-0 z-10 -mx-4 mt-3 space-y-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm"
		>
			<div class="flex flex-wrap items-center gap-2">
				{@render rosterSearch(
					'Search name, household, phone…',
					'contacts',
					filteredContacts.length,
					data.contacts.length
				)}
			</div>
			<div class="flex flex-wrap items-center gap-2">
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
				<label class="sr-only" for="contact-list-filter">Standing group</label>
				<select
					id="contact-list-filter"
					class="h-9 rounded-md border border-border bg-background px-2 text-xs"
					value={data.filters.listId ?? ''}
					onchange={(e) =>
						pushFilters({ listId: (e.currentTarget as HTMLSelectElement).value || null })}
				>
					<option value="">All lists</option>
					{#each data.lists.filter((l) => l.kind === 'standing') as l (l.id)}
						<option value={l.id}>{l.name}</option>
					{/each}
				</select>
			</div>
			{@render sortControls('contact')}
			{@render groupJump(
				'contact',
				contactGroupIndex,
				contactPrimary === 'name' ? 'Jump to last name' : 'Jump to group'
			)}
		</div>

		{#if data.duePace && !searchActive}
			<details
				class="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
				aria-label="Meet pace"
				bind:open={dueOpen}
			>
				<summary class="cursor-pointer select-none text-sm font-medium text-foreground">
					Due this period: {data.duePace.remaining} remaining of {data.duePace.total}
				</summary>
				{#if dueOpen}
				{#if data.periodHistory.length > 0}
					<details class="mt-2 text-xs text-muted-foreground">
						<summary class="cursor-pointer select-none">Past periods</summary>
						<ul class="mt-1 space-y-0.5 pl-1">
							{#each data.periodHistory as h (h.period_key)}
								<li>
									{h.period_key}: {h.hit} hit · {h.skipped} skipped · {h.missed} missed
								</li>
							{/each}
						</ul>
					</details>
				{/if}
				{#if data.dueContacts.length > 0}
					<ul class="mt-2 divide-y border-t border-border">
						{#each data.dueContacts as d (d.id)}
							<li class="flex items-center justify-between gap-2 py-1.5">
								<div class="min-w-0">
									<p class="truncate text-sm font-medium">{d.display_name}</p>
									<p class="truncate text-xs text-muted-foreground">
										{CONTACT_FREQUENCY_SHORT_LABELS[d.frequency]} · due {formatTouch(d.period_end)}
										· last {formatTouch(d.last_touched_on)}
									</p>
								</div>
								{#if data.isOwner}
									<div class="flex shrink-0 gap-1">
										<form method="POST" action="?/logContactQuick" use:enhance={quickLogEnhance}>
											<input type="hidden" name="contact_id" value={d.contact_id} />
											{#if d.household_id}
												<input type="hidden" name="household_id" value={d.household_id} />
											{/if}
											<Button type="submit" size="sm" variant="secondary" label="Log" />
										</form>
										<form method="POST" action="?/skipContactPeriod" use:enhance={quickLogEnhance}>
											<input type="hidden" name="contact_id" value={d.contact_id} />
											{#if d.household_id}
												<input type="hidden" name="household_id" value={d.household_id} />
											{/if}
											<Button type="submit" size="sm" variant="outline" label="Skip" />
										</form>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
				{/if}
			</details>
		{/if}

		<ul class="mt-3 divide-y overflow-hidden rounded-lg border border-border">
			{#if data.contacts.length === 0}
				<li class="px-4 py-10 text-center text-sm text-muted-foreground">
					No contacts yet. Add people before Thanksgiving for Christmas cards.
				</li>
			{:else if filteredContacts.length === 0}
				<li class="px-4 py-10 text-center text-sm text-muted-foreground">
					No contacts match “{searchQ.trim()}”.
				</li>
			{:else}
				{#each contactGroups as group, gi (`g-${gi}`)}
					{#if group.header}
						{@render rosterGroupHeader('contact', group.header, group.rows.length)}
					{/if}
					{#each group.rows as c (c.id)}
						{@const listLabels = listNamesForContact(c.id, c.household_id, sortCtx)}
						<li class="bg-card px-3 py-2 text-card-foreground">
							<div class="flex items-center justify-between gap-2">
								<button
									type="button"
									class={cn('min-w-0 flex-1 text-left', data.isOwner && 'cursor-pointer')}
									onclick={() => {
										if (data.isOwner) openEditContact(c);
									}}
								>
									<p class="flex min-w-0 items-center gap-1.5">
										<span class="truncate font-medium">{c.display_name}</span>
										{#if c.period_current}
											<span
												class="inline-flex shrink-0"
												title="Up to date this period"
											>
												<CircleCheck
													class="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
													aria-hidden="true"
												/>
												<span class="sr-only">Up to date this period</span>
											</span>
										{/if}
									</p>
									<p class="truncate text-xs text-muted-foreground">
										{contactMetaLine(c, listLabels)}
									</p>
									{#if searchActive && (c.email || c.phone)}
										<p class="truncate text-xs text-muted-foreground">
											{[c.email, c.phone].filter(Boolean).join(' · ')}
										</p>
									{/if}
								</button>
								{#if data.isOwner}
									<div class="flex shrink-0 items-center gap-0.5">
										<form method="POST" action="?/logContactQuick" use:enhance={quickLogEnhance}>
											<input type="hidden" name="contact_id" value={c.id} />
											<Button type="submit" size="sm" variant="secondary" label="Log" />
										</form>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											class="hidden sm:inline-flex"
											onclick={() => openLogDetailed(c)}
										>
											Note
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
											variant="ghost"
											size="icon-sm"
											class="text-muted-foreground hover:text-destructive"
											aria-label="Delete contact"
											onclick={() => askDeleteContact(c)}
										>
											<Trash2 class="size-4" />
										</Button>
									</div>
								{/if}
							</div>
						</li>
					{/each}
				{/each}
			{/if}
		</ul>

		{#if data.isOwner && !searchActive}
			<details class="mt-4 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
				<summary class="cursor-pointer font-medium text-foreground">Import sheet / vCard</summary>
				<form
					method="POST"
					action="?/importSheet"
					enctype="multipart/form-data"
					class="mt-2 space-y-2"
					use:enhance={quickLogEnhance}
				>
					<label class="block text-xs text-muted-foreground">
						Sheet1 CSV
						<input type="file" name="sheet1" accept=".csv,text/csv" class="mt-1 block w-full text-xs" />
					</label>
					<label class="block text-xs text-muted-foreground">
						People for Things CSV (optional → Potential Invite)
						<input
							type="file"
							name="people_for_things"
							accept=".csv,text/csv"
							class="mt-1 block w-full text-xs"
						/>
					</label>
					<Button type="submit" size="sm" label="Import CSV" />
				</form>
				<form
					method="POST"
					action="?/applyVCardImport"
					enctype="multipart/form-data"
					class="mt-3 space-y-2 border-t border-border pt-2"
					use:enhance={quickLogEnhance}
				>
					<label class="block text-xs text-muted-foreground">
						Mac Contacts .vcf (birthday + empty email/phone)
						<input type="file" name="vcard" accept=".vcf,text/vcard" class="mt-1 block w-full text-xs" />
					</label>
					<Button type="submit" size="sm" variant="outline" label="Apply vCard" />
				</form>
			</details>
		{/if}
	{:else if tab === 'households'}
		<div
			class="sticky top-0 z-10 -mx-4 mt-3 space-y-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm"
		>
			<div class="flex flex-wrap items-center gap-2">
				{@render rosterSearch(
					'Search household, address, member…',
					'households',
					filteredHouseholds.length,
					data.households.length
				)}
			</div>
			{@render sortControls('household')}
			{@render groupJump(
				'household',
				householdGroupIndex,
				householdPrimary === 'name' ? 'Jump to household name' : 'Jump to group'
			)}
		</div>
		<ul class="mt-3 divide-y overflow-hidden rounded-lg border border-border">
			{#if data.households.length === 0}
				<li class="px-4 py-10 text-center text-sm text-muted-foreground">
					No households yet. Create one for Christmas cards, or add a mailing address on a contact.
				</li>
			{:else if filteredHouseholds.length === 0}
				<li class="px-4 py-10 text-center text-sm text-muted-foreground">
					No households match “{searchQ.trim()}”.
				</li>
			{:else}
				{#each householdGroups as group, gi (`hg-${gi}`)}
					{#if group.header}
						{@render rosterGroupHeader('household', group.header, group.rows.length)}
					{/if}
					{#each group.rows as h (h.id)}
						{@const listLabels = listNamesForHousehold(h.id, sortCtx)}
						<li class="bg-card px-3 py-2 text-card-foreground">
							<div class="flex items-center justify-between gap-2">
								<button
									type="button"
									class={cn('min-w-0 flex-1 text-left', data.isOwner && 'cursor-pointer')}
									onclick={() => {
										if (data.isOwner) openEditHousehold(h);
									}}
								>
									<p class="truncate font-medium">{h.name}</p>
									<p class="truncate text-xs text-muted-foreground">
										{householdMetaLine(h, listLabels)}
									</p>
								</button>
								{#if data.isOwner}
									<div class="flex shrink-0 items-center gap-0.5">
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
											variant="ghost"
											size="icon-sm"
											class="text-muted-foreground hover:text-destructive"
											aria-label="Delete household"
											onclick={() => askDeleteHousehold(h)}
										>
											<Trash2 class="size-4" />
										</Button>
									</div>
								{/if}
							</div>
						</li>
					{/each}
				{/each}
			{/if}
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
		gradeChanges={editingHousehold
			? (data.gradeChangesByHouseholdId[editingHousehold.id] ?? [])
			: []}
		children={editingHousehold
			? (data.childrenByHouseholdId[editingHousehold.id] ?? [])
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

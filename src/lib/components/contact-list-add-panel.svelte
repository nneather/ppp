<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		filterContactListCandidates,
		filterHouseholdListCandidates,
		type ContactListCandidate,
		type HouseholdListCandidate,
		type ListAddCandidateScope
	} from '$lib/contacts/list-candidates';
	import { cn } from '$lib/utils';

	let {
		listId,
		householdCandidates = [],
		contactCandidates = [],
		errorMessage = null,
		onAdded
	}: {
		listId: string;
		householdCandidates?: HouseholdListCandidate[];
		contactCandidates?: ContactListCandidate[];
		errorMessage?: string | null;
		onAdded?: () => void | Promise<void>;
	} = $props();

	let mode = $state<'household' | 'contact'>('household');
	let showContacts = $state(false);
	let scope = $state<ListAddCandidateScope>('not_on_list');
	let searchQ = $state('');
	let selected = $state<string[]>([]);
	let pending = $state(false);

	$effect(() => {
		// Reset selection when list or mode/scope changes.
		listId;
		mode;
		scope;
		selected = [];
	});

	const filteredHouseholds = $derived(
		filterHouseholdListCandidates(householdCandidates, {
			scope,
			q: searchQ
		})
	);

	const contactScope = $derived(scope === 'all' ? 'all' : 'not_on_list');
	const filteredContacts = $derived(
		filterContactListCandidates(contactCandidates, {
			scope: contactScope,
			q: searchQ
		})
	);

	const visible = $derived(mode === 'household' ? filteredHouseholds : filteredContacts);
	const selectableIds = $derived(
		mode === 'household'
			? filteredHouseholds.filter((c) => !c.onList).map((c) => c.id)
			: filteredContacts.filter((c) => !c.onList).map((c) => c.id)
	);

	const selectedCount = $derived(selected.length);
	const fieldName = $derived(mode === 'household' ? 'household_id' : 'contact_id');

	function toggleId(id: string, checked: boolean, disabled: boolean) {
		if (disabled) return;
		if (checked) {
			if (!selected.includes(id)) selected = [...selected, id];
			return;
		}
		selected = selected.filter((x) => x !== id);
	}

	function selectAllVisible() {
		selected = [...new Set([...selected, ...selectableIds])];
	}

	function clearSelection() {
		selected = [];
	}

	const onSubmit: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				selected = [];
				await onAdded?.();
			}
		};
	};
</script>

<section class="mt-4 rounded-lg border border-border bg-card px-3 py-3 text-card-foreground">
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<div>
			<h3 class="text-sm font-medium">Add to list</h3>
			<p class="mt-0.5 text-xs text-muted-foreground">
				{#if mode === 'household'}
					Check households not yet on this list, then add them in one step.
				{:else}
					Check contacts not yet on this list (for future email lists).
				{/if}
			</p>
		</div>
		{#if !showContacts && mode === 'household'}
			<button
				type="button"
				class="text-xs font-medium text-primary underline-offset-4 hover:underline"
				onclick={() => {
					showContacts = true;
					mode = 'contact';
					scope = 'not_on_list';
					searchQ = '';
				}}
			>
				Add contacts instead…
			</button>
		{:else if mode === 'contact'}
			<button
				type="button"
				class="text-xs font-medium text-primary underline-offset-4 hover:underline"
				onclick={() => {
					mode = 'household';
					showContacts = false;
					scope = 'not_on_list';
					searchQ = '';
				}}
			>
				Back to households
			</button>
		{/if}
	</div>

	{#if errorMessage}
		<p class="mt-2 text-sm text-destructive" role="alert">{errorMessage}</p>
	{/if}

	<div class="mt-3 flex flex-wrap items-center gap-2">
		<div class="flex gap-1 rounded-lg border border-border p-0.5">
			{#each [
				{ value: 'not_on_list' as const, label: 'Not on list' },
				{ value: 'has_address' as const, label: 'Has address', householdOnly: true },
				{ value: 'all' as const, label: 'All' }
			] as opt (opt.value)}
				{#if !opt.householdOnly || mode === 'household'}
					<button
						type="button"
						class={cn(
							'rounded-md px-2 py-1 text-xs font-medium',
							scope === opt.value
								? 'bg-foreground text-background'
								: 'text-muted-foreground hover:text-foreground'
						)}
						onclick={() => (scope = opt.value)}
					>
						{opt.label}
					</button>
				{/if}
			{/each}
		</div>
		<Input
			type="search"
			placeholder={mode === 'household' ? 'Search households…' : 'Search contacts…'}
			bind:value={searchQ}
			class="h-8 min-w-[10rem] flex-1"
		/>
	</div>

	<div class="mt-2 flex flex-wrap gap-2 text-xs">
		<button
			type="button"
			class="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-40"
			disabled={selectableIds.length === 0}
			onclick={selectAllVisible}
		>
			Select all visible ({selectableIds.length})
		</button>
		{#if selectedCount > 0}
			<button
				type="button"
				class="text-muted-foreground underline-offset-4 hover:underline"
				onclick={clearSelection}
			>
				Clear
			</button>
		{/if}
	</div>

	<form method="POST" action="?/addContactListMembersBatch" use:enhance={onSubmit} class="mt-3">
		<input type="hidden" name="list_id" value={listId} />
		<input type="hidden" name="member_kind" value={mode} />
		{#each selected as id (id)}
			<input type="hidden" name={fieldName} value={id} />
		{/each}

		<ul
			class="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border px-2 py-2"
		>
			{#each visible as c (c.id)}
				{@const onList = 'onList' in c ? c.onList : false}
				{@const label = 'name' in c ? c.name : c.display_name}
				{@const checked = onList || selected.includes(c.id)}
				<li>
					<label
						class={cn(
							'flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm',
							onList ? 'opacity-60' : 'hover:bg-muted/60'
						)}
					>
						<input
							type="checkbox"
							class="size-4 rounded border-input"
							checked={checked}
							disabled={onList}
							onchange={(e) => toggleId(c.id, e.currentTarget.checked, onList)}
						/>
						<span class="min-w-0 flex-1 truncate">{label}</span>
						{#if onList}
							<span class="shrink-0 text-xs text-muted-foreground">On list</span>
						{:else if mode === 'household' && 'hasAddress' in c && c.hasAddress}
							<span class="shrink-0 text-xs text-muted-foreground">Address</span>
						{/if}
					</label>
				</li>
			{:else}
				<li class="px-1.5 py-6 text-center text-sm text-muted-foreground">
					{#if mode === 'household' && scope === 'has_address'}
						No households with a mailing address left to add.
					{:else if scope === 'not_on_list' || scope === 'has_address'}
						Everyone matching this filter is already on the list.
					{:else}
						No matches.
					{/if}
				</li>
			{/each}
		</ul>

		<div
			class="sticky bottom-0 mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card pt-3"
		>
			<p class="text-xs text-muted-foreground">
				{selectedCount} selected
			</p>
			<Button
				type="submit"
				size="sm"
				hotkey="s"
				label={pending
					? 'Adding…'
					: mode === 'household'
						? `Add ${selectedCount || ''} household${selectedCount === 1 ? '' : 's'}`.trim()
						: `Add ${selectedCount || ''} contact${selectedCount === 1 ? '' : 's'}`.trim()}
				disabled={pending || selectedCount === 0}
			/>
		</div>
	</form>
</section>

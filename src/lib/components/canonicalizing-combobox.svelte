<script lang="ts">
	import { tick } from 'svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn } from '$lib/utils.js';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';

	/**
	 * <CanonicalizingCombobox>
	 *
	 * Shared typeahead for two surfaces:
	 *   - `ancient_texts` picker (canonical_name + abbreviations[])
	 *   - `book_topics.topic` autocomplete
	 *
	 * Shape mirrors <PersonAutocomplete> (Session 1.5 prototype): chip mode
	 * when a value is selected, search mode when not. B14-style collision +
	 * fuzzy-warn surface as inline amber hints below the input.
	 *
	 * Value identity: the host binds `value` to whatever stable key the
	 * backing data carries — for ancient_texts, that's the UUID; for topics,
	 * that's the (lowercased) topic string itself. An `items[]` row matches
	 * via `item.id === value`.
	 *
	 * Create path: when `onCreate` is set AND `showCreate !== false`, a
	 * "+ Create …" row appears in the dropdown when the typed text has no
	 * exact match. Host opens a dialog / handles the insert. Owner-only
	 * surfaces (ancient_texts per Session 0 A2) pass `showCreate={isOwner}`.
	 *
	 * Typo-warn: optional `fuzzyWarn` callback returns
	 * `{ suggestion, score }` when the typed text looks like a typo of an
	 * existing row. The host decides what to show — we just render the
	 * suggestion beneath the input.
	 */

	export type ComboboxItem = {
		id: string;
		canonical_name: string;
		abbreviations?: string[];
		count?: number;
	};

	let {
		value = $bindable<string | null>(null),
		items,
		onCreate,
		fuzzyWarn,
		showCreate = true,
		placeholder = 'Type to search…',
		ariaLabel = 'Select'
	}: {
		value?: string | null;
		items: ComboboxItem[];
		onCreate?: (rawText: string) => void;
		fuzzyWarn?: (rawText: string) => { suggestion: string; count: number } | null;
		showCreate?: boolean;
		placeholder?: string;
		ariaLabel?: string;
	} = $props();

	let queryRaw = $state('');
	let dropdownOpen = $state(false);
	let highlightIdx = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);
	let searchMode = $state(false);
	let prevValue = $state<string | null>(null);
	let suppressBlurAction = $state(false);

	const selectedItem = $derived.by<ComboboxItem | null>(() => {
		if (!value) return null;
		return items.find((i) => i.id === value) ?? null;
	});
	const selectedLabel = $derived(selectedItem?.canonical_name ?? '');
	const showInput = $derived(!value || searchMode);

	const queryLower = $derived(queryRaw.trim().toLowerCase());

	function matchesQuery(item: ComboboxItem, q: string): boolean {
		if (item.canonical_name.toLowerCase().includes(q)) return true;
		if (item.abbreviations?.some((a) => a.toLowerCase().includes(q))) return true;
		return false;
	}

	const filtered = $derived.by(() => {
		const q = queryLower;
		if (!q) return items.slice(0, 8);
		const out: ComboboxItem[] = [];
		for (const it of items) {
			if (matchesQuery(it, q)) {
				out.push(it);
				if (out.length >= 8) break;
			}
		}
		return out;
	});

	const hasExactMatch = $derived(
		queryLower.length > 0 &&
			items.some(
				(i) =>
					i.canonical_name.toLowerCase() === queryLower ||
					(i.abbreviations?.some((a) => a.toLowerCase() === queryLower) ?? false)
			)
	);

	const showCreateRow = $derived(
		dropdownOpen &&
			queryRaw.trim().length > 0 &&
			!hasExactMatch &&
			!!onCreate &&
			showCreate
	);

	const fuzzyHint = $derived.by(() => {
		if (!fuzzyWarn) return null;
		const text = queryRaw.trim();
		if (!text) return null;
		if (hasExactMatch) return null;
		return fuzzyWarn(text);
	});

	$effect(() => {
		if (highlightIdx > filtered.length) highlightIdx = 0;
	});

	$effect(() => {
		if (value !== prevValue) {
			if (value !== null) {
				searchMode = false;
				queryRaw = '';
				dropdownOpen = false;
				highlightIdx = 0;
			}
			prevValue = value;
		}
	});

	function selectItem(it: ComboboxItem) {
		value = it.id;
	}

	function handleCreate() {
		const text = queryRaw.trim();
		if (!text || !onCreate) return;
		dropdownOpen = false;
		suppressBlurAction = true;
		setTimeout(() => {
			suppressBlurAction = false;
		}, 200);
		onCreate(text);
	}

	async function enterSearchMode() {
		searchMode = true;
		await tick();
		inputEl?.focus();
		dropdownOpen = true;
		highlightIdx = 0;
	}

	function cancelSearchMode() {
		if (!value) return;
		searchMode = false;
		queryRaw = '';
		dropdownOpen = false;
	}

	function clear() {
		value = null;
		queryRaw = '';
		dropdownOpen = false;
		highlightIdx = 0;
		searchMode = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!dropdownOpen) {
			if (e.key === 'ArrowDown' || e.key === 'Enter') {
				dropdownOpen = true;
				highlightIdx = 0;
				e.preventDefault();
			}
			return;
		}
		const total = filtered.length + (showCreateRow ? 1 : 0);
		if (e.key === 'ArrowDown') {
			highlightIdx = Math.min(total - 1, highlightIdx + 1);
			e.preventDefault();
		} else if (e.key === 'ArrowUp') {
			highlightIdx = Math.max(0, highlightIdx - 1);
			e.preventDefault();
		} else if (e.key === 'Enter') {
			if (highlightIdx < filtered.length) {
				selectItem(filtered[highlightIdx]);
			} else if (showCreateRow) {
				handleCreate();
			}
			e.preventDefault();
		} else if (e.key === 'Escape') {
			if (value) {
				cancelSearchMode();
			} else {
				dropdownOpen = false;
			}
			e.preventDefault();
		}
	}

	function handleFocus() {
		dropdownOpen = true;
		highlightIdx = 0;
	}

	function handleBlur() {
		setTimeout(() => {
			dropdownOpen = false;
			if (suppressBlurAction || value) return;
			if (filtered.length > 0) {
				selectItem(filtered[0]);
			}
		}, 150);
	}
</script>

{#if !showInput && selectedItem}
	<div class="flex w-full items-stretch gap-2">
		<button
			type="button"
			onclick={enterSearchMode}
			class="flex h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-md border border-input bg-background px-3 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
			aria-label={`${ariaLabel}: ${selectedLabel}. Click to change.`}
		>
			<span class="truncate font-medium">{selectedLabel}</span>
			<span class="shrink-0 text-xs text-muted-foreground">Change</span>
		</button>
		<button
			type="button"
			onclick={clear}
			class="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
			aria-label="Clear selection"
		>
			<X class="size-4" />
		</button>
	</div>
{:else}
	<div class="relative">
		<Input
			bind:ref={inputEl}
			bind:value={queryRaw}
			{placeholder}
			class={cn('h-11 w-full text-base', value && 'pr-20')}
			aria-label={ariaLabel}
			aria-autocomplete="list"
			aria-expanded={dropdownOpen}
			role="combobox"
			onkeydown={handleKeydown}
			onfocus={handleFocus}
			onblur={handleBlur}
		/>
		{#if value}
			<button
				type="button"
				onmousedown={(e) => {
					e.preventDefault();
					cancelSearchMode();
				}}
				class="absolute top-1/2 right-2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
				aria-label="Cancel search and keep current selection"
			>
				Cancel
			</button>
		{/if}

		{#if dropdownOpen && (filtered.length > 0 || showCreateRow)}
			<div
				class="absolute top-full right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
				role="listbox"
			>
				{#each filtered as it, i (it.id)}
					<button
						type="button"
						role="option"
						aria-selected={highlightIdx === i}
						class={cn(
							'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors',
							highlightIdx === i ? 'bg-muted text-foreground' : 'hover:bg-muted/60'
						)}
						onmousedown={(e) => {
							e.preventDefault();
							selectItem(it);
						}}
						onmouseenter={() => (highlightIdx = i)}
					>
						<span class="font-medium">{it.canonical_name}</span>
						<span class="flex items-center gap-2 text-xs text-muted-foreground">
							{#if it.count != null}
								<span>{it.count} use{it.count === 1 ? '' : 's'}</span>
							{/if}
							{#if it.abbreviations && it.abbreviations.length > 0}
								<span class="truncate">{it.abbreviations.join(', ')}</span>
							{/if}
						</span>
					</button>
				{/each}

				{#if showCreateRow}
					{@const i = filtered.length}
					<button
						type="button"
						role="option"
						aria-selected={highlightIdx === i}
						class={cn(
							'flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm font-medium',
							highlightIdx === i ? 'bg-muted text-foreground' : 'text-foreground hover:bg-muted/60'
						)}
						onmousedown={(e) => {
							e.preventDefault();
							handleCreate();
						}}
						onmouseenter={() => (highlightIdx = i)}
					>
						<Plus class="size-4 text-muted-foreground" />
						Create &quot;{queryRaw.trim()}&quot;
					</button>
				{/if}
			</div>
		{/if}
	</div>

	{#if fuzzyHint}
		<p class="mt-1 text-xs text-amber-700 dark:text-amber-300">
			Did you mean <button
				type="button"
				class="font-semibold underline underline-offset-2"
				onmousedown={(e) => {
					e.preventDefault();
					const match = items.find(
						(i) =>
							i.canonical_name.toLowerCase() === fuzzyHint!.suggestion.toLowerCase()
					);
					if (match) selectItem(match);
				}}
			>
				&ldquo;{fuzzyHint.suggestion}&rdquo;
			</button>
			? ({fuzzyHint.count} existing use{fuzzyHint.count === 1 ? '' : 's'})
		</p>
	{/if}
{/if}

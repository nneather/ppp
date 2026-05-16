<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn } from '$lib/utils.js';
	import X from '@lucide/svelte/icons/x';

	/**
	 * <MultiCombobox>
	 *
	 * Multi-select typeahead facet. Used for the `/library` Series filter
	 * (post-Pass-1: 55 chips is unusable) and the new Author filter
	 * (911-entry people set).
	 *
	 * Items can opt into secondary search via `sublabel` + `keywords[]`.
	 * Filtering is a case-insensitive substring scan against all three.
	 * Optional `matcher` replaces that with a custom score (higher = better);
	 * items with score &gt; 0 are sorted by score descending.
	 * Selected values render as removable chips above the input.
	 *
	 * No create path — filter facets pull from existing data only. If a
	 * create affordance is ever needed (new series on the fly, etc.), use
	 * <CanonicalizingCombobox> instead.
	 */

	export type MultiComboboxItem = {
		id: string;
		label: string;
		sublabel?: string | null;
		keywords?: string[];
	};

	let {
		values = $bindable<string[]>([]),
		items,
		placeholder = 'Type to filter…',
		ariaLabel = 'Filter',
		onChange,
		matcher
	}: {
		values?: string[];
		items: MultiComboboxItem[];
		placeholder?: string;
		ariaLabel?: string;
		/** Fired after any add/remove. Host uses this to drive URL-param sync. */
		onChange?: (next: string[]) => void;
		/** When set, filter/sort by score instead of label/keyword substring match. */
		matcher?: (item: MultiComboboxItem, query: string) => number;
	} = $props();

	let queryRaw = $state('');
	let dropdownOpen = $state(false);
	let highlightIdx = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);

	const valuesSet = $derived(new Set(values));

	const selectedItems = $derived.by<MultiComboboxItem[]>(() => {
		const byId = new Map(items.map((it) => [it.id, it]));
		return values
			.map((id) => byId.get(id))
			.filter((it): it is MultiComboboxItem => it != null);
	});

	function itemMatches(it: MultiComboboxItem, q: string): boolean {
		if (it.label.toLowerCase().includes(q)) return true;
		if (it.sublabel && it.sublabel.toLowerCase().includes(q)) return true;
		if (it.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
		return false;
	}

	const filtered = $derived.by(() => {
		const qTrim = queryRaw.trim();
		const pool = items.filter((it) => !valuesSet.has(it.id));
		if (!qTrim) return pool.slice(0, 10);
		if (matcher) {
			const scored = pool
				.map((it) => ({ it, s: matcher(it, qTrim) }))
				.filter((x) => x.s > 0)
				.sort((a, b) => b.s - a.s);
			return scored.slice(0, 10).map((x) => x.it);
		}
		const q = qTrim.toLowerCase();
		const out: MultiComboboxItem[] = [];
		for (const it of pool) {
			if (itemMatches(it, q)) {
				out.push(it);
				if (out.length >= 10) break;
			}
		}
		return out;
	});

	$effect(() => {
		if (highlightIdx >= filtered.length) highlightIdx = 0;
	});

	function addValue(id: string) {
		if (valuesSet.has(id)) return;
		const next = [...values, id];
		values = next;
		queryRaw = '';
		highlightIdx = 0;
		onChange?.(next);
	}

	function removeValue(id: string) {
		const next = values.filter((v) => v !== id);
		values = next;
		onChange?.(next);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'Enter') {
			if (!dropdownOpen) {
				dropdownOpen = true;
				highlightIdx = 0;
				e.preventDefault();
				return;
			}
		}
		if (e.key === 'ArrowDown') {
			highlightIdx = Math.min(filtered.length - 1, highlightIdx + 1);
			e.preventDefault();
		} else if (e.key === 'ArrowUp') {
			highlightIdx = Math.max(0, highlightIdx - 1);
			e.preventDefault();
		} else if (e.key === 'Enter') {
			const pick = filtered[highlightIdx];
			if (pick) addValue(pick.id);
			e.preventDefault();
		} else if (e.key === 'Escape') {
			dropdownOpen = false;
			e.preventDefault();
		} else if (e.key === 'Backspace' && queryRaw === '' && values.length > 0) {
			const next = values.slice(0, -1);
			values = next;
			onChange?.(next);
		}
	}

	function handleFocus() {
		dropdownOpen = true;
		highlightIdx = 0;
	}

	function handleBlur() {
		setTimeout(() => {
			dropdownOpen = false;
		}, 150);
	}
</script>

<div class="flex w-full flex-col gap-1.5">
	{#if selectedItems.length > 0}
		<div class="flex flex-wrap gap-1.5">
			{#each selectedItems as it (it.id)}
				<button
					type="button"
					class="inline-flex max-w-full items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary/15"
					onclick={() => removeValue(it.id)}
					aria-label={`Remove ${it.label}`}
					title={it.sublabel ?? it.label}
				>
					<span class="max-w-[14rem] truncate">{it.label}</span>
					<X class="size-3 shrink-0" />
				</button>
			{/each}
		</div>
	{/if}

	<div class="relative">
		<Input
			bind:ref={inputEl}
			bind:value={queryRaw}
			{placeholder}
			class={cn('h-9 w-full text-sm')}
			aria-label={ariaLabel}
			aria-autocomplete="list"
			aria-expanded={dropdownOpen}
			role="combobox"
			onkeydown={handleKeydown}
			onfocus={handleFocus}
			onblur={handleBlur}
		/>

		{#if dropdownOpen && filtered.length > 0}
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
							addValue(it.id);
						}}
						onmouseenter={() => (highlightIdx = i)}
					>
						<span class="font-medium">{it.label}</span>
						{#if it.sublabel}
							<span class="truncate text-xs text-muted-foreground">{it.sublabel}</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

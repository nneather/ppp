<script lang="ts">
	import { tick } from 'svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn } from '$lib/utils.js';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import X from '@lucide/svelte/icons/x';
	import type { PersonRow } from '$lib/types/library';

	/**
	 * <PersonAutocomplete>
	 *
	 * Typeahead picker for `people`. Search-style replacement for the
	 * per-author `<Select>` in `<BookFormSheet>`. Prototype for the
	 * `<CanonicalizingCombobox>` shipping in Session 5.
	 *
	 * Two visual modes:
	 *   - Chip mode (value !== null && !searchMode): shows the selected
	 *     person's full name as a button-styled "chip" with a Change
	 *     affordance. Click anywhere on the chip to switch to search mode.
	 *   - Search mode (value is null/empty OR user clicked Change): shows the
	 *     input + dropdown of matches. If a person was previously selected,
	 *     a small Cancel link restores the chip without changing the value.
	 *
	 * Behavior:
	 *   - Type to filter on `last_name`, `first_name`, full display, and any
	 *     `aliases[]` element. Top 8 matches.
	 *   - B14 dedup warning rendered inline per result row.
	 *   - "+ Create '<typed>'" affordance when typed text doesn't match any
	 *     existing person — fires `onCreate(rawText)` so the host can open a
	 *     creation dialog pre-filled.
	 *   - Keyboard: Arrow up/down to highlight, Enter to select highlighted
	 *     match (or trigger create when no matches), Escape to cancel.
	 *   - **Tab-away (blur):** if the dropdown has at least one filtered
	 *     match, auto-select the top suggestion. If the user typed text but
	 *     nothing matched, fire `onCreate(text)` so the host can open the
	 *     create dialog pre-filled. If the input is empty, no-op.
	 *   - When `value` transitions to non-null (in-component selection OR
	 *     externally set after a Create dialog), automatically exit search
	 *     mode and clear the typed query.
	 *   - **`initialQuery` + `seedKey`:** when the host row identity (`seedKey`)
	 *     changes and `value` is empty, copy `initialQuery` into the input.
	 *     **`autoOpenOnSeed`:** when true (default), also open the dropdown
	 *     (ISBN prefill on `<BookForm>`); when false, keep the list closed until
	 *     the user focuses the field.
	 */

	let {
		value = $bindable<string | null>(null),
		people,
		personBookCounts,
		onCreate,
		placeholder = 'Search by name…',
		ariaLabel = 'Person',
		/** When `seedKey` changes and `value` is empty, pre-fill the search box (Open Library author hint). */
		initialQuery = '',
		/** Stable row id from the host — changing it re-applies `initialQuery`. */
		seedKey = '',
		/** When seeding from `initialQuery`, open the dropdown (multi-author prefill only opens for the first unresolved row). */
		autoOpenOnSeed = true
	}: {
		value?: string | null;
		people: PersonRow[];
		personBookCounts: Record<string, number>;
		/** Fired when the user clicks the explicit "+ Create" dropdown row OR
		 * when they tab away with non-empty text that doesn't match anyone.
		 * Host typically opens a confirmation Dialog with the parsed name. */
		onCreate?: (rawText: string) => void;
		placeholder?: string;
		ariaLabel?: string;
		initialQuery?: string;
		seedKey?: string;
		autoOpenOnSeed?: boolean;
	} = $props();

	let queryRaw = $state('');
	let dropdownOpen = $state(false);
	let highlightIdx = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);
	/** True when the user explicitly opened the search field after a person
	 * was already selected. False = chip mode (the default once a value exists). */
	let searchMode = $state(false);
	let prevValue = $state<string | null>(null);
	/** Set true by handleCreate (and any other path that already resolved the
	 * field) so the immediately-following blur doesn't also fire its own
	 * action — which would race-select the top match while the create dialog
	 * is opening, or double-fire onCreate. Cleared after 200ms. */
	let suppressBlurAction = $state(false);

	/** When the host row identity changes, seed the query from `initialQuery` once per empty `value`. */
	let prevSeedKey = $state<string | null>(null);
	$effect(() => {
		void autoOpenOnSeed;
		if (value) {
			prevSeedKey = null;
			return;
		}
		if (seedKey !== prevSeedKey) {
			prevSeedKey = seedKey;
			const q = initialQuery.trim();
			if (q) {
				queryRaw = q;
				void tick().then(() => {
					highlightIdx = 0;
					if (autoOpenOnSeed) {
						dropdownOpen = true;
					}
				});
			}
		}
	});

	const selectedPerson = $derived.by<PersonRow | null>(() => {
		if (!value) return null;
		return people.find((p) => p.id === value) ?? null;
	});
	const selectedLabel = $derived(selectedPerson ? formatPersonLong(selectedPerson) : '');
	const showInput = $derived(!value || searchMode);

	function formatPersonLong(p: PersonRow): string {
		return [p.first_name, p.middle_name, p.last_name, p.suffix]
			.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
			.join(' ');
	}

	// B14 dedup map: last_name + first_initial → count.
	const collisionMap = $derived.by(() => {
		const m = new Map<string, number>();
		for (const p of people) {
			const initial = p.first_name?.trim().charAt(0).toLowerCase() ?? '';
			const key = `${p.last_name.toLowerCase()}|${initial}`;
			m.set(key, (m.get(key) ?? 0) + 1);
		}
		return m;
	});

	function collisionsForPerson(p: PersonRow): number {
		const initial = p.first_name?.trim().charAt(0).toLowerCase() ?? '';
		const key = `${p.last_name.toLowerCase()}|${initial}`;
		return Math.max(0, (collisionMap.get(key) ?? 0) - 1);
	}

	const queryLower = $derived(queryRaw.trim().toLowerCase());
	const filtered = $derived.by(() => {
		const q = queryLower;
		if (!q) return people.slice(0, 8);
		const matches: PersonRow[] = [];
		for (const p of people) {
			const haystacks = [
				p.last_name,
				p.first_name ?? '',
				p.middle_name ?? '',
				formatPersonLong(p),
				...(p.aliases ?? [])
			];
			if (haystacks.some((h) => h.toLowerCase().includes(q))) {
				matches.push(p);
				if (matches.length >= 8) break;
			}
		}
		return matches;
	});

	const hasExactMatch = $derived(
		queryLower.length > 0 &&
			people.some((p) => formatPersonLong(p).toLowerCase() === queryLower)
	);
	const showCreateRow = $derived(
		dropdownOpen && queryRaw.trim().length > 0 && !hasExactMatch && !!onCreate
	);

	$effect(() => {
		if (highlightIdx > filtered.length) highlightIdx = 0;
	});

	// When `value` transitions to non-null (selected or set externally after
	// a Create dialog), exit search mode and reset query state. Tracks the
	// previous value so we don't loop on legitimate clears via clear().
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

	function selectPerson(p: PersonRow) {
		value = p.id;
		// queryRaw / searchMode reset is handled by the value-watch effect
		// above so the chip-mode transition is uniform across paths.
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
		// queryRaw stays so the user can see what they typed if the dialog
		// is cancelled. If the dialog succeeds and value is set, the
		// value-watch effect clears it.
	}

	async function enterSearchMode() {
		searchMode = true;
		await tick();
		inputEl?.focus();
		dropdownOpen = true;
		highlightIdx = 0;
	}

	function cancelSearchMode() {
		// Restore chip without changing value (works only when value is set).
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
				selectPerson(filtered[highlightIdx]);
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
		// Delay so click on a dropdown item (or the "+ Create" row) registers
		// before the dropdown unmounts.
		setTimeout(() => {
			dropdownOpen = false;
			// Tab-away resolution: if a value is already set, or another path
			// already handled the blur (e.g. handleCreate, dropdown click),
			// nothing to do. Otherwise:
			//   - filtered.length > 0  → auto-select the top suggestion. This
			//     is the common "type 'bauck', tab → Bauckham" path.
			//   - queryRaw non-empty   → no match; fire onCreate so the host
			//     can open the create dialog with a parsed name. Avoids the
			//     old silent auto-create which spawned duplicate people on
			//     typos.
			//   - empty input          → no-op.
			if (suppressBlurAction || value) return;
			if (filtered.length > 0) {
				selectPerson(filtered[0]);
				return;
			}
			const text = queryRaw.trim();
			if (text.length > 0 && onCreate) {
				suppressBlurAction = true;
				setTimeout(() => {
					suppressBlurAction = false;
				}, 200);
				onCreate(text);
			}
		}, 150);
	}
</script>

{#if !showInput && selectedPerson}
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
				{#each filtered as p, i (p.id)}
					{@const dup = collisionsForPerson(p)}
					{@const count = personBookCounts[p.id] ?? 0}
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
							selectPerson(p);
						}}
						onmouseenter={() => (highlightIdx = i)}
					>
						<span class="font-medium">{formatPersonLong(p)}</span>
						<span class="flex items-center gap-2 text-xs text-muted-foreground">
							<span>{count} book{count === 1 ? '' : 's'}</span>
							{#if dup > 0}
								<span class="text-amber-700 dark:text-amber-300">
									⚠ {dup} other "{p.last_name}, {p.first_name?.charAt(0).toUpperCase() ??
										'?'}.
									"
								</span>
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
						<UserPlus class="size-4 text-muted-foreground" />
						Create &quot;{queryRaw.trim()}&quot;
					</button>
				{/if}
			</div>
		{/if}
	</div>
{/if}

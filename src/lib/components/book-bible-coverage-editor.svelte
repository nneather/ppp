<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { cn } from '$lib/utils.js';

	/**
	 * <BookBibleCoverageEditor>
	 *
	 * 66-chip grid for `book_bible_coverage`. Click to add, click again to
	 * remove. Each toggle posts a form-action:
	 *   - add    → `?/createBibleCoverage`   (polymorphic INSERT, idempotent
	 *              via UNIQUE (book_id, bible_book))
	 *   - remove → `?/softDeleteBibleCoverage` (hard DELETE — no `deleted_at`
	 *              on the coverage junction)
	 *
	 * The component does NOT re-fetch after each toggle — the host page
	 * calls `invalidateAll()` in the SubmitFunction. Until the server round
	 * trips, local state shows an optimistic update (click feels instant).
	 *
	 * Mirrors the host's `<SourcePicker>` contract conceptually (locked to a
	 * single bookId) but since bible-coverage rows carry no extra fields,
	 * there's nothing for the picker to pass on — we just need the bookId.
	 */

	let {
		bookId,
		bibleBookNames,
		covered = $bindable<string[]>([])
	}: {
		bookId: string;
		bibleBookNames: string[];
		covered?: string[];
	} = $props();

	const coveredSet = $derived(new Set(covered));
	let pending = $state<Set<string>>(new Set());

	function makeEnhance(bible_book: string, adding: boolean): SubmitFunction {
		return () => {
			pending = new Set([...pending, bible_book]);
			// Optimistic local state.
			if (adding) covered = [...covered, bible_book];
			else covered = covered.filter((b) => b !== bible_book);
			return async ({ result, update }) => {
				await update({ reset: false });
				pending = new Set([...pending].filter((b) => b !== bible_book));
				if (result.type !== 'success') {
					// Revert optimistic change on failure.
					if (adding) covered = covered.filter((b) => b !== bible_book);
					else covered = [...covered, bible_book];
				}
				await invalidateAll();
			};
		};
	}
</script>

<div class="flex flex-wrap gap-1.5">
	{#each bibleBookNames as name (name)}
		{@const active = coveredSet.has(name)}
		{@const isPending = pending.has(name)}
		<form
			method="POST"
			action={active ? '?/softDeleteBibleCoverage' : '?/createBibleCoverage'}
			use:enhance={makeEnhance(name, !active)}
			class="contents"
		>
			<input type="hidden" name="source_kind" value="book" />
			<input type="hidden" name="book_id" value={bookId} />
			<input type="hidden" name="bible_book" value={name} />
			<button
				type="submit"
				disabled={isPending}
				aria-pressed={active}
				class={cn(
					'rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-60',
					active
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-border bg-background text-foreground hover:bg-muted'
				)}
			>
				{name}
			</button>
		</form>
	{/each}
</div>

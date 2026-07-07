<script lang="ts">
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import { GENRES } from '$lib/types/library';
	import type { Genre } from '$lib/types/library';

	/**
	 * Genre Sprint fast lane: one tap on a chip both sets the genre and
	 * confirms the card (the host wires `onPick` to submit). Top genres by
	 * shelf frequency render first; "More…" reveals the full closed enum.
	 * An AI-proposed genre (when a pending research proposal carries one)
	 * is pulled to the front with a sparkle badge.
	 */
	let {
		topGenres,
		value,
		suggested = null,
		disabled = false,
		onPick
	}: {
		topGenres: Genre[];
		value: Genre | null;
		suggested?: Genre | null;
		disabled?: boolean;
		onPick: (genre: Genre) => void;
	} = $props();

	let expanded = $state(false);

	const primaryChips = $derived.by(() => {
		const base = suggested
			? [suggested, ...topGenres.filter((g) => g !== suggested)]
			: [...topGenres];
		return base;
	});

	const moreChips = $derived(GENRES.filter((g) => !primaryChips.includes(g)));

	function chipClasses(active: boolean, isSuggested: boolean): string {
		if (active) return 'border-primary bg-primary text-primary-foreground';
		if (isSuggested)
			return 'border-violet-500/50 bg-violet-500/10 text-violet-900 hover:bg-violet-500/20 dark:text-violet-200';
		return 'border-border bg-background text-foreground hover:bg-muted';
	}
</script>

<div>
	<div class="mb-1.5 text-xs font-medium text-muted-foreground">
		Tap a genre to confirm this book
	</div>
	<div class="flex flex-wrap gap-1.5">
		{#each primaryChips as g (g)}
			{@const isSuggested = suggested === g}
			<button
				type="button"
				{disabled}
				class={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${chipClasses(value === g, isSuggested)}`}
				onclick={() => onPick(g)}
				aria-pressed={value === g}
			>
				{#if isSuggested}
					<Sparkles class="size-3" aria-label="AI-proposed" />
				{/if}
				{g}
			</button>
		{/each}
		{#if !expanded}
			<button
				type="button"
				{disabled}
				class="rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
				onclick={() => (expanded = true)}
			>
				More…
			</button>
		{/if}
	</div>
	{#if expanded}
		<div class="mt-1.5 flex flex-wrap gap-1.5">
			{#each moreChips as g (g)}
				<button
					type="button"
					{disabled}
					class={`rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${chipClasses(value === g, false)}`}
					onclick={() => onPick(g)}
					aria-pressed={value === g}
				>
					{g}
				</button>
			{/each}
		</div>
	{/if}
</div>

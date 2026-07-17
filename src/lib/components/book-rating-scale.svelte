<script lang="ts">
	import Star from '@lucide/svelte/icons/star';
	import { cn } from '$lib/utils.js';

	let {
		value = $bindable<number | null>(null),
		name = 'rating',
		disabled = false,
		id = 'book-rating',
		/** Fired after the bound value changes (detail-page auto-submit). */
		onchange
	}: {
		value?: number | null;
		name?: string;
		disabled?: boolean;
		id?: string;
		onchange?: (next: number | null) => void;
	} = $props();

	function setRating(n: number) {
		if (disabled) return;
		value = n;
		onchange?.(n);
	}

	function clearRating() {
		if (disabled) return;
		value = null;
		onchange?.(null);
	}
</script>

<div class="flex flex-col gap-1.5">
	<input type="hidden" {name} value={value ?? ''} />
	<div
		class="flex flex-wrap items-center gap-1"
		role="radiogroup"
		aria-label="Rating 1 to 5"
		{id}
	>
		{#each [1, 2, 3, 4, 5] as n (n)}
			{@const filled = value != null && n <= value}
			<button
				type="button"
				role="radio"
				aria-checked={value === n}
				aria-label={`${n} of 5`}
				disabled={disabled}
				class={cn(
					'inline-flex size-10 items-center justify-center rounded-md border transition-colors',
					'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
					'disabled:pointer-events-none disabled:opacity-50',
					filled
						? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300'
						: 'border-input bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground'
				)}
				onclick={() => setRating(n)}
			>
				<Star class={cn('size-5', filled && 'fill-current')} aria-hidden="true" />
			</button>
		{/each}
		{#if value != null}
			<button
				type="button"
				class="ml-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
				disabled={disabled}
				onclick={clearRating}
			>
				Clear
			</button>
		{/if}
	</div>
	<p class="text-xs text-muted-foreground">
		{#if value == null}
			Not rated
		{:else}
			{value} / 5
		{/if}
	</p>
</div>

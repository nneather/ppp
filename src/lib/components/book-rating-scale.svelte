<script lang="ts">
	import Star from '@lucide/svelte/icons/star';
	import { cn } from '$lib/utils.js';

	let {
		value = $bindable<number | null>(null),
		name = 'rating' as string | null,
		disabled = false,
		id = 'book-rating',
		variant = 'default' as 'default' | 'compact',
		/** Fired after the bound value changes (detail-page auto-submit). */
		onchange
	}: {
		value?: number | null;
		name?: string | null;
		disabled?: boolean;
		id?: string;
		/** Compact is one row of stars. Clicking the current star clears it. */
		variant?: 'default' | 'compact';
		onchange?: (next: number | null) => void;
	} = $props();

	const compact = $derived(variant === 'compact');

	function setRating(n: number) {
		if (disabled) return;
		const next = compact && value === n ? null : n;
		value = next;
		onchange?.(next);
	}

	function clearRating() {
		if (disabled) return;
		value = null;
		onchange?.(null);
	}
</script>

<div class={compact ? 'flex items-center' : 'flex flex-col gap-1.5'}>
	{#if name}
		<input type="hidden" {name} value={value ?? ''} />
	{/if}
	<div
		class={cn('flex flex-wrap items-center', compact ? 'gap-0.5' : 'gap-1')}
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
				aria-label={compact && value === n ? `Clear ${n} star rating` : `${n} of 5`}
				{disabled}
				class={cn(
					'inline-flex items-center justify-center rounded-md transition-colors',
					'focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none',
					'disabled:pointer-events-none disabled:opacity-50',
					compact ? 'size-6' : 'size-10 border',
					!compact &&
						(filled
							? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300'
							: 'border-input bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground'),
					compact &&
						(filled
							? 'text-amber-600 dark:text-amber-400'
							: 'text-muted-foreground hover:text-foreground')
				)}
				onclick={() => setRating(n)}
			>
				<Star
					class={cn(compact ? 'size-3.5' : 'size-5', filled && 'fill-current')}
					aria-hidden="true"
				/>
			</button>
		{/each}
		{#if !compact && value != null}
			<button
				type="button"
				class="ml-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
				{disabled}
				onclick={clearRating}
			>
				Clear
			</button>
		{/if}
	</div>
	{#if !compact}
		<p class="text-xs text-muted-foreground">
			{#if value == null}
				Not rated
			{:else}
				{value} / 5
			{/if}
		</p>
	{/if}
</div>

<script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import { cn } from '$lib/utils';
	import type { TrendDirection } from '$lib/types/projects';

	let {
		trend,
		compact = false,
		class: className = ''
	}: {
		trend: TrendDirection;
		compact?: boolean;
		class?: string;
	} = $props();

	const trendLabel: Record<TrendDirection, string> = {
		up: 'Improved',
		down: 'Declined',
		flat: 'Unchanged',
		none: 'No trend'
	};

	const iconSize = $derived(compact ? 'size-3' : 'size-3.5');
</script>

<span
	class={cn('inline-flex shrink-0 items-center', className)}
	title={trendLabel[trend]}
	aria-label={trendLabel[trend]}
>
	{#if trend === 'up'}
		<svg class={cn('inline-block', iconSize)} viewBox="0 0 16 16" aria-hidden="true">
			<polygon points="8,2 14,13 2,13" fill="#44A271" />
		</svg>
	{:else if trend === 'down'}
		<svg class={cn('inline-block', iconSize)} viewBox="0 0 16 16" aria-hidden="true">
			<polygon points="8,14 2,3 14,3" fill="#DA0000" />
		</svg>
	{:else if trend === 'flat'}
		<Minus class={cn(iconSize, 'text-muted-foreground')} aria-hidden="true" />
	{/if}
</span>

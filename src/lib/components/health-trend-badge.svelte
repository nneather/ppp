<script lang="ts">
	import TrendingDown from '@lucide/svelte/icons/trending-down';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import Minus from '@lucide/svelte/icons/minus';
	import { cn } from '$lib/utils';
	import { HEALTH_DOT_CLASS } from '$lib/projects/health-appearance';
	import { HEALTH_STATUS_LABELS, type HealthStatus, type TrendDirection } from '$lib/types/projects';

	let {
		health,
		trend,
		compact = false
	}: {
		health: HealthStatus | null;
		trend: TrendDirection;
		compact?: boolean;
	} = $props();

	const trendLabel: Record<TrendDirection, string> = {
		up: 'Improved',
		down: 'Declined',
		flat: 'Unchanged',
		none: 'No trend'
	};
</script>

<span class={cn('inline-flex items-center gap-1.5', compact && 'gap-1')}>
	{#if health}
		<span
			class={cn('inline-block shrink-0 rounded-full', HEALTH_DOT_CLASS[health], compact ? 'size-2' : 'size-2.5')}
			title={HEALTH_STATUS_LABELS[health]}
			aria-hidden="true"
		></span>
		{#if !compact}
			<span class="text-xs text-muted-foreground">{HEALTH_STATUS_LABELS[health]}</span>
		{/if}
	{:else}
		<span class="text-sm text-muted-foreground tabular-nums" aria-label="No health recorded">—</span>
	{/if}

	{#if health && trend !== 'none'}
		<span class="text-muted-foreground" title={trendLabel[trend]} aria-label={trendLabel[trend]}>
			{#if trend === 'up'}
				<TrendingUp class={cn('size-3.5 text-[#44A271]', compact && 'size-3')} />
			{:else if trend === 'down'}
				<TrendingDown class={cn('size-3.5 text-[#DA0000]', compact && 'size-3')} />
			{:else}
				<Minus class={cn('size-3.5', compact && 'size-3')} />
			{/if}
		</span>
	{/if}
</span>

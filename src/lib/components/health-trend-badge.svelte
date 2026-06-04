<script lang="ts">
	import TrendingDown from '@lucide/svelte/icons/trending-down';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import Minus from '@lucide/svelte/icons/minus';
	import { cn } from '$lib/utils';
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

	const dotClass: Record<HealthStatus, string> = {
		excellent: 'bg-emerald-600',
		satisfactory: 'bg-green-600',
		watch: 'bg-amber-500',
		serious: 'bg-orange-600',
		critical: 'bg-red-600'
	};

	const trendLabel: Record<TrendDirection, string> = {
		up: 'Improving',
		down: 'Declining',
		flat: 'Unchanged',
		none: 'No trend'
	};
</script>

<span class={cn('inline-flex items-center gap-1.5', compact && 'gap-1')}>
	{#if health}
		<span
			class={cn('inline-block shrink-0 rounded-full', dotClass[health], compact ? 'size-2' : 'size-2.5')}
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
				<TrendingUp class={cn('size-3.5 text-emerald-600', compact && 'size-3')} />
			{:else if trend === 'down'}
				<TrendingDown class={cn('size-3.5 text-red-600', compact && 'size-3')} />
			{:else}
				<Minus class={cn('size-3.5', compact && 'size-3')} />
			{/if}
		</span>
	{/if}
</span>

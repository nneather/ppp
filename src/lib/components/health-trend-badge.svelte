<script lang="ts">
	import HealthStatusIcon from '$lib/components/health-status-icon.svelte';
	import HealthTrendArrow from '$lib/components/health-trend-arrow.svelte';
	import { cn } from '$lib/utils';
	import { HEALTH_STATUS_LABELS, type HealthStatus, type TrendDirection } from '$lib/types/projects';

	let {
		health,
		trend,
		compact = false,
		showStatusIcon = true
	}: {
		health: HealthStatus | null;
		trend: TrendDirection;
		compact?: boolean;
		/** When false, omit shape + label (e.g. /projects tree — picker already names status). */
		showStatusIcon?: boolean;
	} = $props();

	const showTrend = $derived(health != null && trend !== 'none');
	const showAnything = $derived(
		showStatusIcon ? health != null || showTrend : showTrend
	);
</script>

{#if showAnything}
	<span class={cn('inline-flex items-center gap-1.5', compact && 'gap-1')}>
		{#if showStatusIcon}
			{#if health}
				<HealthStatusIcon {health} size={compact ? 'xs' : 'sm'} />
				{#if !compact}
					<span class="text-xs text-muted-foreground">{HEALTH_STATUS_LABELS[health]}</span>
				{/if}
			{:else}
				<span class="text-sm text-muted-foreground tabular-nums" aria-label="No health recorded">—</span>
			{/if}
		{/if}

		{#if showTrend}
			<HealthTrendArrow {trend} {compact} />
		{/if}
	</span>
{/if}

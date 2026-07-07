<script lang="ts">
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import type { SprintState } from '$lib/library/turabian';

	/**
	 * Header HUD for `/library/review`: today/session counts, the live
	 * burndown bar (ticks on every confirm — derived from the locally
	 * decremented remaining count, not the stale server snapshot), and a
	 * progress ring while a sized sprint is running.
	 */
	let {
		todayCleared,
		sessionCleared,
		sliceCleared,
		sliceDenominator,
		sprint
	}: {
		todayCleared: number;
		sessionCleared: number;
		sliceCleared: number;
		sliceDenominator: number;
		sprint: SprintState | null;
	} = $props();

	const burndownPct = $derived(
		Math.min(100, Math.round((sliceCleared / (sliceDenominator || 1)) * 100))
	);

	const RING_R = 15.5;
	const RING_C = 2 * Math.PI * RING_R;
	const ringFraction = $derived(
		sprint?.target ? Math.min(1, sprint.cleared / sprint.target) : 0
	);
</script>

<div class="flex items-center justify-end gap-3">
	{#if sprint?.target}
		<div class="relative size-11 shrink-0" role="img" aria-label={`Sprint ${sprint.cleared} of ${sprint.target}`}>
			<svg viewBox="0 0 36 36" class="size-11 -rotate-90">
				<circle cx="18" cy="18" r={RING_R} fill="none" class="stroke-muted" stroke-width="3.5" />
				<circle
					cx="18"
					cy="18"
					r={RING_R}
					fill="none"
					class="stroke-emerald-600 transition-[stroke-dashoffset] duration-300 dark:stroke-emerald-400"
					stroke-width="3.5"
					stroke-linecap="round"
					stroke-dasharray={RING_C}
					stroke-dashoffset={RING_C * (1 - ringFraction)}
				/>
			</svg>
			<span
				class="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums"
			>
				{sprint.cleared}/{sprint.target}
			</span>
		</div>
	{/if}
	<div class="min-w-0 text-right text-xs text-muted-foreground md:max-w-xs">
		<div class="font-medium text-foreground">
			<CheckCircle2 class="inline-block size-3.5 text-emerald-600" />
			Today: {todayCleared}
			<span class="mx-1 hidden text-muted-foreground md:inline">·</span>
			<span class="hidden md:inline">{sessionCleared} this session</span>
		</div>
		<div class="mt-1 tabular-nums">
			{sliceCleared.toLocaleString()} / {sliceDenominator.toLocaleString()} in slice
		</div>
		<div
			class="mt-1.5 h-1.5 min-w-24 overflow-hidden rounded-full bg-muted"
			role="progressbar"
			aria-valuenow={burndownPct}
			aria-valuemin={0}
			aria-valuemax={100}
		>
			<div class="h-full bg-emerald-600 transition-all" style:width="{burndownPct}%"></div>
		</div>
	</div>
</div>

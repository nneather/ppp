<script lang="ts">
	import { onMount } from 'svelte';
	import {
		isBacklogDefaultSlice,
		readLifetimeCleared,
		SLICE_DENOMINATORS
	} from '$lib/library/turabian/review-progress';
	import type { ReviewSlice } from '$lib/types/library';

	type Props = {
		needsReviewCount: number;
		criticalRemaining: number;
		backlogRemaining: number;
	};

	let { needsReviewCount, criticalRemaining, backlogRemaining }: Props = $props();

	let lifetimeCritical = $state(0);
	let lifetimeBacklog = $state(0);

	onMount(() => {
		lifetimeCritical = readLifetimeCleared('critical');
		lifetimeBacklog = readLifetimeCleared('backlog');
	});

	const activeSlice = $derived<ReviewSlice>(isBacklogDefaultSlice() ? 'backlog' : 'critical');
	const denominator = $derived(SLICE_DENOMINATORS[activeSlice]);
	const lifetime = $derived(activeSlice === 'critical' ? lifetimeCritical : lifetimeBacklog);
	const reviewHref = $derived(`/library/review?slice=${activeSlice}`);
</script>

<div class="border-t border-border px-5 pb-4 pt-3 space-y-2">
	{#if needsReviewCount > 0}
		<a
			href="/library?needs_review=true"
			class="block text-sm font-medium text-primary underline-offset-4 hover:underline"
		>
			{needsReviewCount === 1 ? '1 book needs review' : `${needsReviewCount} books need review`}
		</a>
	{/if}
	<a href={reviewHref} class="block text-sm text-muted-foreground hover:text-foreground">
		{#if activeSlice === 'critical'}
			<span class="font-medium text-foreground">{lifetime.toLocaleString()}</span>
			<span> of {denominator.toLocaleString()} citation-verified</span>
		{:else}
			<span class="font-medium text-foreground">{lifetime.toLocaleString()}</span>
			<span> of {denominator.toLocaleString()} backlog cleared</span>
		{/if}
		<span class="text-xs"> · {criticalRemaining + backlogRemaining} left in queue</span>
	</a>
</div>

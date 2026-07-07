<script lang="ts">
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import Timer from '@lucide/svelte/icons/timer';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import { Button } from '$lib/components/ui/button';
	import { formatSprintElapsed, type SprintState } from '$lib/library/turabian';

	/**
	 * End-of-sprint card: cleared / skipped / elapsed, the deck's updated
	 * position, and a one-tap "go again" CTA. Shown when a sized sprint hits
	 * its target; the sprint state is already ended by the host before this
	 * renders (`finished` is a snapshot).
	 */
	let {
		finished,
		endedAt,
		remaining,
		deckLabel,
		onGoAgain,
		onDone
	}: {
		finished: SprintState;
		endedAt: number;
		remaining: number;
		deckLabel: string;
		onGoAgain: () => void;
		onDone: () => void;
	} = $props();

	const elapsed = $derived(formatSprintElapsed(endedAt - finished.startedAt));
</script>

<div
	class="flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-8 text-center"
	role="status"
>
	<CheckCircle2 class="size-10 text-emerald-600 dark:text-emerald-300" />
	<div>
		<h2 class="text-xl font-semibold">Sprint complete</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			<span class="font-semibold text-foreground">{finished.cleared}</span>
			{finished.cleared === 1 ? 'book' : 'books'} confirmed
		</p>
	</div>
	<div class="flex items-center gap-4 text-xs text-muted-foreground">
		<span class="inline-flex items-center gap-1">
			<Timer class="size-3.5" />
			{elapsed}
		</span>
		{#if finished.skipped > 0}
			<span class="inline-flex items-center gap-1">
				<SkipForward class="size-3.5" />
				{finished.skipped} skipped
			</span>
		{/if}
	</div>
	<p class="text-xs text-muted-foreground">
		{remaining.toLocaleString()} left in {deckLabel}.
	</p>
	<div class="flex flex-wrap items-center justify-center gap-2">
		<Button hotkey="g" label={`Go again (${finished.target})`} onclick={onGoAgain} />
		<Button variant="outline" hotkey="Escape" label="Done" onclick={onDone} />
	</div>
</div>

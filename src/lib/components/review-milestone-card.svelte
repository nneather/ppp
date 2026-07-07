<script lang="ts">
	import Trophy from '@lucide/svelte/icons/trophy';
	import { Button } from '$lib/components/ui/button';

	/**
	 * One-time milestone interstitial (slice-percent thresholds + every 100
	 * lifetime clears). Positive framing only — celebrates what's done, never
	 * counts what's left. Dismisses on tap; the host also clears it on the
	 * next confirm.
	 */
	let {
		title,
		subtitle,
		onDismiss
	}: {
		title: string;
		subtitle: string;
		onDismiss: () => void;
	} = $props();
</script>

<div
	class="mb-3 flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3"
	role="status"
>
	<Trophy class="size-7 shrink-0 text-emerald-600 dark:text-emerald-300" />
	<div class="min-w-0 flex-1">
		<p class="text-sm font-semibold text-foreground">{title}</p>
		<p class="text-xs text-muted-foreground">{subtitle}</p>
	</div>
	<Button variant="ghost" size="sm" class="shrink-0 text-xs" onclick={onDismiss}>Keep going</Button>
</div>

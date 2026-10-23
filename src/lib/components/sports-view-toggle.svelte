<script lang="ts">
	import { page } from '$app/state';
	import type { SportsView } from '$lib/types/sports';
	import { cn } from '$lib/utils';

	let { view }: { view: SportsView } = $props();

	const tabs = [
		{ id: 'scores', label: 'Scores' },
		{ id: 'standings', label: 'Standings' },
		{ id: 'teams', label: 'Teams' }
	] as const;

	function href(next: SportsView): string {
		const q = new URLSearchParams(page.url.searchParams);
		if (next === 'scores') q.delete('view');
		else q.set('view', next);
		const s = q.toString();
		return s ? `/sports?${s}` : '/sports';
	}
</script>

<nav
	class="inline-flex flex-wrap gap-0.5 rounded-md border border-border p-0.5 text-xs font-medium"
	aria-label="Sports"
>
	{#each tabs as tab (tab.id)}
		<a
			href={href(tab.id)}
			class={cn(
				'rounded-sm px-3 py-1.5 transition-colors',
				view === tab.id
					? 'bg-foreground text-background'
					: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
			)}
			aria-current={view === tab.id ? 'page' : undefined}
		>
			{tab.label}
		</a>
	{/each}
</nav>

<script lang="ts">
	import {
		SPORTS_LEAGUE_LABELS,
		type SportsGlanceGame
	} from '$lib/types/sports';

	let {
		games
	}: {
		games: SportsGlanceGame[];
	} = $props();

	function scoreLine(g: SportsGlanceGame): string {
		const away = g.away_name ?? 'Away';
		const home = g.home_name ?? 'Home';
		if (g.state === 'pre') return `${away} @ ${home}`;
		return `${away} ${g.away_score ?? 0} – ${home} ${g.home_score ?? 0}`;
	}

	function whenLabel(g: SportsGlanceGame): string {
		if (g.state === 'in') return g.status_detail ?? 'Live';
		if (g.state === 'post') return g.status_detail ?? 'Final';
		try {
			return new Intl.DateTimeFormat('en-US', {
				timeZone: 'America/Chicago',
				weekday: 'short',
				hour: 'numeric',
				minute: '2-digit'
			}).format(new Date(g.start_time));
		} catch {
			return g.start_time;
		}
	}
</script>

<section
	class="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm md:p-5"
	aria-labelledby="sports-glance-heading"
>
	<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
		<h2 id="sports-glance-heading" class="text-sm font-semibold tracking-tight text-foreground">
			Sports
		</h2>
		<a
			href="/sports"
			class="text-sm font-medium text-primary underline-offset-4 hover:underline"
		>
			Scoreboard
		</a>
	</div>

	{#if games.length === 0}
		<p class="text-sm text-muted-foreground">
			No followed-team games yesterday/today.
			<a href="/sports" class="font-medium text-primary underline-offset-4 hover:underline"
				>Follow teams</a
			>
		</p>
	{:else}
		<ul class="space-y-2">
			{#each games as g (g.id)}
				<li class="rounded-lg border border-border/80 px-3 py-2">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="truncate text-sm font-medium text-foreground">{scoreLine(g)}</p>
							<p class="mt-0.5 text-xs text-muted-foreground">
								{SPORTS_LEAGUE_LABELS[g.league]} · {whenLabel(g)}
								{#if g.broadcast}
									· {g.broadcast}
								{/if}
							</p>
						</div>
						{#if g.state === 'in'}
							<span
								class="shrink-0 rounded-full bg-red-600/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-red-700 uppercase dark:text-red-400"
								>Live</span
							>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

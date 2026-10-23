<script lang="ts">
	import { utcNoonFromYmd, ymdInChicago } from '$lib/invoicing/chicago-date';
	import { SPORTS_LEAGUE_LABELS, type SportsGameRow } from '$lib/types/sports';

	let { games, showLeague }: { games: SportsGameRow[]; showLeague: boolean } = $props();

	function scoreLine(g: SportsGameRow): string {
		const away = g.away_name ?? 'Away';
		const home = g.home_name ?? 'Home';
		if (g.state === 'pre') return `${away} @ ${home}`;
		return `${away} ${g.away_score ?? 0} @ ${home} ${g.home_score ?? 0}`;
	}

	function formatStart(iso: string): string {
		try {
			return new Intl.DateTimeFormat('en-US', {
				timeZone: 'America/Chicago',
				hour: 'numeric',
				minute: '2-digit'
			}).format(new Date(iso));
		} catch {
			return iso;
		}
	}

	function dayKey(iso: string): string {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		return ymdInChicago(d);
	}

	function dayLabel(ymd: string): string {
		const noon = utcNoonFromYmd(ymd);
		if (!noon) return ymd;
		return new Intl.DateTimeFormat('en-US', {
			timeZone: 'America/Chicago',
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		}).format(noon);
	}

	const liveGames = $derived(games.filter((g) => g.state === 'in'));
	const dayGroups = $derived.by(() => {
		const map = new Map<string, SportsGameRow[]>();
		for (const g of games) {
			if (g.state === 'in') continue;
			const key = dayKey(g.start_time);
			const list = map.get(key) ?? [];
			list.push(g);
			map.set(key, list);
		}
		return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
	});
</script>

<div class="space-y-6">
	{#if liveGames.length > 0}
		<div>
			<h2 class="text-sm font-semibold tracking-tight text-foreground">Live</h2>
			<ul class="mt-2 space-y-2">
				{#each liveGames as g (g.id)}
					<li class="rounded-xl border border-border bg-card p-3 shadow-sm">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								{#if showLeague}
									<p class="text-xs font-medium text-muted-foreground">
										{SPORTS_LEAGUE_LABELS[g.league]}
									</p>
								{/if}
								<p class="font-medium text-foreground">{scoreLine(g)}</p>
								<p class="mt-0.5 text-xs text-muted-foreground">
									{g.status_detail ?? 'In progress'}
									{#if g.display_clock}
										· {g.display_clock}
									{/if}
									{#if g.broadcast}
										· {g.broadcast}
									{/if}
								</p>
							</div>
							<span
								class="shrink-0 rounded-full bg-red-600/15 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400"
								>LIVE</span
							>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if dayGroups.length === 0}
		<p class="text-sm text-muted-foreground">No games in range.</p>
	{:else}
		{#each dayGroups as [ymd, rows] (ymd)}
			<div>
				<h2 class="text-sm font-semibold tracking-tight text-foreground">{dayLabel(ymd)}</h2>
				<ul class="mt-2 space-y-2">
					{#each rows as g (g.id)}
						<li
							class={g.state === 'post'
								? 'rounded-xl border border-border bg-card/80 p-3'
								: 'rounded-xl border border-border bg-card p-3 shadow-sm'}
						>
							{#if showLeague}
								<p class="text-xs font-medium text-muted-foreground">
									{SPORTS_LEAGUE_LABELS[g.league]}
								</p>
							{/if}
							<p class="font-medium text-foreground">{scoreLine(g)}</p>
							<p class="mt-0.5 text-xs text-muted-foreground">
								{#if g.state === 'pre'}
									{formatStart(g.start_time)}
								{:else}
									{g.status_detail ?? 'Final'}
								{/if}
								{#if g.broadcast}
									· {g.broadcast}
								{/if}
								{#if g.state === 'pre' && g.venue}
									· {g.venue}
								{/if}
							</p>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	{/if}
</div>

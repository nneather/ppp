<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		SPORTS_LEAGUE_LABELS,
		SPORTS_LEAGUES,
		type SportsGameRow,
		type SportsLeague,
		type SportsStandingRow,
		type SportsTeamRow
	} from '$lib/types/sports';
	import { cn } from '$lib/utils';
	import Star from '@lucide/svelte/icons/star';
	import type { ToggleFollowedResult } from '$lib/sports/server/actions';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let teamQuery = $state('');

	const league = $derived(data.league);
	const games = $derived(data.games as SportsGameRow[]);
	const standings = $derived(data.standings as SportsStandingRow[]);
	const teams = $derived(data.teams as SportsTeamRow[]);
	const isOwner = $derived(data.isOwner);
	const followedCount = $derived(data.followedCount);

	const liveGames = $derived(games.filter((g) => g.state === 'in'));
	const upcomingGames = $derived(games.filter((g) => g.state === 'pre'));
	const finalGames = $derived([...games.filter((g) => g.state === 'post')].reverse());

	const filteredTeams = $derived.by(() => {
		const q = teamQuery.trim().toLowerCase();
		if (!q) return teams;
		return teams.filter(
			(t) =>
				t.display_name.toLowerCase().includes(q) ||
				(t.abbreviation?.toLowerCase().includes(q) ?? false)
		);
	});

	const standingsByGroup = $derived.by(() => {
		const map = new Map<string, SportsStandingRow[]>();
		for (const s of standings) {
			const key = s.group_name ?? 'Standings';
			const list = map.get(key) ?? [];
			list.push(s);
			map.set(key, list);
		}
		return [...map.entries()];
	});

	function setLeague(next: SportsLeague | 'all') {
		const url = next === 'all' ? '/sports' : `/sports?league=${encodeURIComponent(next)}`;
		void goto(url, { keepFocus: true, noScroll: true });
	}

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
				weekday: 'short',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit'
			}).format(new Date(iso));
		} catch {
			return iso;
		}
	}

	const formMsg = $derived.by(() => {
		const f = form as ToggleFollowedResult | null | undefined;
		if (!f || f.kind !== 'toggleFollowed' || f.success === true) return null;
		return f.message ?? null;
	});
</script>

<svelte:head>
	<title>Sports — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 pb-tabbar md:px-6 md:py-8">
	<PageHeader title="Sports" subtitle="Live scores, TV, and standings for followed teams." />

	{#if data.loadError}
		<p
			class="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
			role="alert"
		>
			{data.loadError}
		</p>
	{/if}

	{#if formMsg}
		<p class="mt-4 text-sm text-destructive" role="alert">{formMsg}</p>
	{/if}

	<div class="mt-6 flex flex-wrap gap-2">
		<button
			type="button"
			class={cn(
				'rounded-full border px-3 py-1 text-sm',
				league === 'all'
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-border bg-background text-muted-foreground hover:text-foreground'
			)}
			onclick={() => setLeague('all')}
		>
			All
		</button>
		{#each SPORTS_LEAGUES as lg (lg)}
			<button
				type="button"
				class={cn(
					'rounded-full border px-3 py-1 text-sm',
					league === lg
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-border bg-background text-muted-foreground hover:text-foreground'
				)}
				onclick={() => setLeague(lg)}
			>
				{SPORTS_LEAGUE_LABELS[lg]}
			</button>
		{/each}
	</div>

	<p class="mt-3 text-xs text-muted-foreground">
		{#if followedCount === 0}
			No followed teams yet — showing NFL + MLB. Star teams below to personalize.
		{:else}
			Showing games involving {followedCount} followed team{followedCount === 1 ? '' : 's'}.
		{/if}
	</p>

	<section class="mt-8 space-y-6">
		{#if liveGames.length > 0}
			<div>
				<h2 class="text-sm font-semibold tracking-tight text-foreground">Live</h2>
				<ul class="mt-2 space-y-2">
					{#each liveGames as g (g.id)}
						<li class="rounded-xl border border-border bg-card p-3 shadow-sm">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
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

		<div>
			<h2 class="text-sm font-semibold tracking-tight text-foreground">Upcoming</h2>
			{#if upcomingGames.length === 0}
				<p class="mt-2 text-sm text-muted-foreground">No upcoming games in range.</p>
			{:else}
				<ul class="mt-2 space-y-2">
					{#each upcomingGames as g (g.id)}
						<li class="rounded-xl border border-border bg-card p-3 shadow-sm">
							<p class="font-medium text-foreground">{scoreLine(g)}</p>
							<p class="mt-0.5 text-xs text-muted-foreground">
								{formatStart(g.start_time)}
								{#if g.broadcast}
									· {g.broadcast}
								{/if}
								{#if g.venue}
									· {g.venue}
								{/if}
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div>
			<h2 class="text-sm font-semibold tracking-tight text-foreground">Final</h2>
			{#if finalGames.length === 0}
				<p class="mt-2 text-sm text-muted-foreground">No recent finals.</p>
			{:else}
				<ul class="mt-2 space-y-2">
					{#each finalGames as g (g.id)}
						<li class="rounded-xl border border-border bg-card/80 p-3">
							<p class="font-medium text-foreground">{scoreLine(g)}</p>
							<p class="mt-0.5 text-xs text-muted-foreground">
								{g.status_detail ?? 'Final'}
								{#if g.broadcast}
									· {g.broadcast}
								{/if}
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</section>

	<section class="mt-10">
		<h2 class="text-sm font-semibold tracking-tight text-foreground">Standings</h2>
		{#if standingsByGroup.length === 0}
			<p class="mt-2 text-sm text-muted-foreground">
				No standings yet — run a sync with <code class="text-xs">?standings=1</code>.
			</p>
		{:else}
			<div class="mt-3 space-y-4">
				{#each standingsByGroup as [group, rows] (group)}
					<div class="overflow-hidden rounded-xl border border-border">
						<div
							class="bg-muted/40 px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
						>
							{group}
						</div>
						<table class="w-full text-sm">
							<thead class="text-left text-xs text-muted-foreground">
								<tr class="border-b border-border">
									<th class="px-3 py-1.5 font-medium">#</th>
									<th class="px-3 py-1.5 font-medium">Team</th>
									<th class="px-3 py-1.5 font-medium">W</th>
									<th class="px-3 py-1.5 font-medium">L</th>
									<th class="px-3 py-1.5 font-medium">Strk</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border">
								{#each rows as s (s.id)}
									<tr>
										<td class="px-3 py-1.5 tabular-nums text-muted-foreground"
											>{s.rank ?? '—'}</td
										>
										<td class="px-3 py-1.5">{s.team_name}</td>
										<td class="px-3 py-1.5 tabular-nums">{s.wins}</td>
										<td class="px-3 py-1.5 tabular-nums">{s.losses}</td>
										<td class="px-3 py-1.5 tabular-nums text-muted-foreground"
											>{s.streak ?? '—'}</td
										>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<section class="mt-10">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<h2 class="text-sm font-semibold tracking-tight text-foreground">Teams</h2>
			{#if league === 'college-football' || teams.length > 40}
				<div class="w-full max-w-xs">
					<label class="sr-only" for="sports-team-search">Search teams</label>
					<Input id="sports-team-search" placeholder="Search teams…" bind:value={teamQuery} />
				</div>
			{/if}
		</div>
		{#if !isOwner}
			<p class="mt-2 text-xs text-muted-foreground">Only the owner can follow teams.</p>
		{/if}
		<ul class="mt-3 divide-y divide-border rounded-xl border border-border">
			{#each filteredTeams as t (t.id)}
				<li class="flex items-center gap-3 px-3 py-2">
					{#if t.logo_url}
						<img src={t.logo_url} alt="" class="size-7 shrink-0 object-contain" />
					{:else}
						<span class="size-7 shrink-0 rounded-full bg-muted"></span>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-foreground">{t.display_name}</p>
						<p class="text-xs text-muted-foreground">
							{SPORTS_LEAGUE_LABELS[t.league]}
							{#if t.abbreviation}
								· {t.abbreviation}
							{/if}
						</p>
					</div>
					{#if isOwner}
						<form
							method="POST"
							action="?/toggleFollowed"
							use:enhance={() => {
								return async ({ update }) => {
									await update({ reset: false });
									await invalidate('app:sports:list');
								};
							}}
						>
							<input type="hidden" name="team_id" value={t.id} />
							<input type="hidden" name="is_followed" value={t.is_followed ? 'false' : 'true'} />
							<Button
								type="submit"
								variant="ghost"
								size="icon-sm"
								aria-label={t.is_followed ? 'Unfollow team' : 'Follow team'}
								class={t.is_followed ? 'text-amber-500' : 'text-muted-foreground'}
							>
								<Star class={cn('size-4', t.is_followed && 'fill-current')} />
							</Button>
						</form>
					{:else if t.is_followed}
						<Star class="size-4 fill-current text-amber-500" />
					{/if}
				</li>
			{:else}
				<li class="px-3 py-4 text-sm text-muted-foreground">No teams match.</li>
			{/each}
		</ul>
	</section>
</div>

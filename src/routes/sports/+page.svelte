<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidate, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/page-header.svelte';
	import SportsOrgSelects from '$lib/components/sports-org-selects.svelte';
	import SportsScoreList from '$lib/components/sports-score-list.svelte';
	import SportsStandingsTable from '$lib/components/sports-standings-table.svelte';
	import SportsTeamList from '$lib/components/sports-team-list.svelte';
	import SportsViewToggle from '$lib/components/sports-view-toggle.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		compareStandingRows,
		filterTeamsForOrg,
		parseOrgLeagueParam,
		resolveSportsOrg,
		standingsInOrg,
		type SportsOrgSelectId
	} from '$lib/sports/standings';
	import type { SyncNowResult, ToggleFollowedResult } from '$lib/sports/server/actions';
	import { SPORTS_LEAGUE_LABELS, SPORTS_LEAGUES, type SportsLeague } from '$lib/types/sports';
	import { cn } from '$lib/utils';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let teamQuery = $state('');
	let syncing = $state(false);

	const league = $derived(data.league);
	const view = $derived(data.view);
	const isOwner = $derived(data.isOwner);
	const followedCount = $derived(data.followedCount);
	const lastSyncedAt = $derived(data.lastSyncedAt);

	const org = $derived(
		resolveSportsOrg(data.standings, {
			league,
			orgLeague: parseOrgLeagueParam(page.url.searchParams.get('org')),
			sub: page.url.searchParams.get('sub'),
			conf: page.url.searchParams.get('conf'),
			div: page.url.searchParams.get('div'),
			followed: data.followed
		})
	);
	const tableRows = $derived(standingsInOrg(data.standings, org).sort(compareStandingRows));
	const visibleTeams = $derived(filterTeamsForOrg(data.teams, data.standings, org, teamQuery));
	const searching = $derived(teamQuery.trim().length > 0);

	function formatSynced(iso: string): string {
		try {
			return new Intl.DateTimeFormat('en-US', {
				timeZone: 'America/Chicago',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit'
			}).format(new Date(iso));
		} catch {
			return iso;
		}
	}

	function setLeague(next: SportsLeague | 'all') {
		const url = new URL(page.url);
		if (next === 'all') url.searchParams.delete('league');
		else url.searchParams.set('league', next);
		url.searchParams.delete('org');
		url.searchParams.delete('sub');
		url.searchParams.delete('conf');
		url.searchParams.delete('div');
		void goto(`${url.pathname}${url.search}`, { keepFocus: true, noScroll: true });
	}

	function writeOrg(patch: Record<string, string | null>) {
		const url = new URL(page.url);
		for (const [key, value] of Object.entries(patch)) {
			if (value) url.searchParams.set(key, value);
			else url.searchParams.delete(key);
		}
		replaceState(`${url.pathname}${url.search}`, {});
	}

	function onOrgChange(id: SportsOrgSelectId, value: string) {
		if (id === 'league') writeOrg({ org: value, sub: null, conf: null, div: null });
		else if (id === 'subdivision') writeOrg({ sub: value, conf: null, div: null });
		else if (id === 'conference') writeOrg({ conf: value, div: null });
		else writeOrg({ div: value });
	}

	const formMsg = $derived.by(() => {
		const f = form as ToggleFollowedResult | SyncNowResult | null | undefined;
		if (!f) return null;
		if (f.kind === 'toggleFollowed' && f.success !== true) return f.message ?? null;
		if (f.kind === 'syncNow' && f.success !== true) return f.message ?? null;
		return null;
	});
	const syncOk = $derived.by(() => {
		const f = form as ToggleFollowedResult | SyncNowResult | null | undefined;
		if (f?.kind !== 'syncNow' || f.success !== true) return null;
		return f.message ?? 'Scores updated.';
	});
</script>

<svelte:head>
	<title>Sports — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 pb-tabbar md:px-6 md:py-8">
	<PageHeader title="Sports" subtitle="Live scores, TV, and standings for followed teams.">
		{#snippet actions()}
			{#if isOwner}
				<form
					method="POST"
					action="?/syncNow"
					use:enhance={() => {
						syncing = true;
						return async ({ update }) => {
							try {
								await update({ reset: false });
								await invalidate('app:sports:list');
							} finally {
								syncing = false;
							}
						};
					}}
				>
					<Button type="submit" variant="outline" disabled={syncing}>
						{syncing ? 'Refreshing…' : 'Refresh scores'}
					</Button>
				</form>
			{/if}
		{/snippet}
	</PageHeader>

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
	{#if syncOk}
		<p class="mt-4 text-sm text-muted-foreground">{syncOk}</p>
	{/if}

	<p class="mt-3 text-xs text-muted-foreground">
		{#if lastSyncedAt}
			Last synced {formatSynced(lastSyncedAt)}.
		{:else if isOwner}
			No scores in the cache yet — refresh to pull from ESPN.
		{:else}
			No scores yet — the owner needs to run a sync.
		{/if}
	</p>

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

	<div class="mt-4">
		<SportsViewToggle {view} />
	</div>

	{#if view === 'scores'}
		<p class="mt-3 text-xs text-muted-foreground">
			{#if followedCount === 0}
				No followed teams yet — showing NFL + MLB. Star teams on the Teams tab to personalize.
			{:else}
				Showing games involving {followedCount} followed team{followedCount === 1 ? '' : 's'}.
			{/if}
		</p>
		<section class="mt-8">
			<SportsScoreList games={data.games} showLeague={league === 'all'} />
		</section>
	{:else if view === 'standings'}
		<section class="mt-6 space-y-4">
			<SportsOrgSelects selects={org.selects} onChange={onOrgChange} />
			{#if org.subdivision === 'naia' && org.conference == null}
				<p class="text-sm text-muted-foreground">
					ESPN has no NAIA standings table. Search for a school on the Teams tab.
				</p>
			{:else if tableRows.length === 0}
				<p class="text-sm text-muted-foreground">
					{#if isOwner && lastSyncedAt == null}
						No standings yet — refresh scores to pull teams and records.
					{:else}
						No standings in this group.
					{/if}
				</p>
			{:else}
				<SportsStandingsTable title={org.division ?? 'Standings'} rows={tableRows} />
			{/if}
		</section>
	{:else}
		<section class="mt-6 space-y-4">
			<SportsOrgSelects selects={org.selects} onChange={onOrgChange} />
			<div class="w-full max-w-xs">
				<label class="sr-only" for="sports-team-search">Search teams</label>
				<Input id="sports-team-search" placeholder="Search teams…" bind:value={teamQuery} />
			</div>
			{#if searching}
				<p class="text-xs text-muted-foreground">
					Searching all {SPORTS_LEAGUE_LABELS[org.league]}.
				</p>
			{:else if org.subdivision === 'naia' && org.conference == null}
				<p class="text-xs text-muted-foreground">
					ESPN has no NAIA standings. Search to find a school.
				</p>
			{/if}
			{#if !isOwner}
				<p class="text-xs text-muted-foreground">Only the owner can follow teams.</p>
			{/if}
			<SportsTeamList teams={visibleTeams} {isOwner} />
		</section>
	{/if}
</div>

<script lang="ts">
	import { page } from '$app/state';
	import Receipt from '@lucide/svelte/icons/receipt';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import DashboardLibraryTileFooter from '$lib/components/dashboard-library-tile-footer.svelte';
	import ProjectStatusStrip from '$lib/components/project-status-strip.svelte';
	import { cn } from '$lib/utils';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Tile = {
		href: string;
		title: string;
		statLabel: string;
		icon: typeof Receipt;
	};

	const tiles: Tile[] = [
		{
			href: '/invoicing',
			title: 'Invoicing',
			statLabel: 'Unbilled entries from last week or earlier',
			icon: Receipt
		},
		{
			href: '/library',
			title: 'Library',
			statLabel: 'Library',
			icon: BookOpen
		},
		{
			href: '/projects/tasks',
			title: 'Tasks',
			statLabel: 'Open Critical Now tasks',
			icon: ListChecks
		}
	];

	const cardClass = cn(
		'flex h-full flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-colors hover:border-ring/50 focus-within:border-ring/50'
	);

	const innerLinkClass = cn(
		'flex flex-1 flex-col rounded-t-xl p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring'
	);

	function tileStat(href: string): string {
		if (href === '/invoicing') {
			if (data.unbilledPriorCount == null) return '–';
			return String(data.unbilledPriorCount);
		}
		if (href === '/projects/tasks') {
			if (data.criticalTaskCount == null) return '–';
			return String(data.criticalTaskCount);
		}
		return '–';
	}
</script>

<div class="mx-auto max-w-5xl px-4 py-6 pb-tabbar md:px-6 md:py-8">
	{#if data.dashboardError}
		<p class="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{data.dashboardError}
		</p>
	{/if}
	<section
		class="mb-8 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm md:p-5"
		aria-labelledby="project-status-heading"
	>
		<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
			<h2
				id="project-status-heading"
				class="text-sm font-semibold tracking-tight text-foreground"
			>
				Project status
			</h2>
			<a
				href="/projects"
				class="text-sm font-medium text-primary underline-offset-4 hover:underline"
			>
				Edit Status
			</a>
		</div>
		{#key page.url.pathname}
			<ProjectStatusStrip tree={data.projectTree} latestHealth={data.latestHealth} />
		{/key}
	</section>

	<h2 class="sr-only text-foreground">Modules</h2>
	<ul class="grid gap-4 sm:grid-cols-2">
		{#each tiles as { href, title, statLabel, icon: Icon } (href)}
			<li>
				{#if href === '/library'}
					<div class={cardClass}>
						<a href="/library" class={innerLinkClass}>
							<div class="mb-4 flex items-center gap-2 text-muted-foreground">
								<Icon class="size-5 shrink-0" />
								<span class="text-base font-semibold tracking-tight text-foreground">{title}</span>
							</div>
							<p class="text-sm text-muted-foreground">Open library</p>
						</a>
						{#if data.libraryNeedsReviewCount != null}
							<DashboardLibraryTileFooter
								needsReviewCount={data.libraryNeedsReviewCount}
								criticalRemaining={data.libraryCriticalRemaining ?? 0}
								backlogRemaining={data.libraryBacklogRemaining ?? 0}
							/>
						{:else}
							<div class="border-t border-border px-5 pb-4 pt-3">
								<span class="text-sm text-muted-foreground">Review queue: –</span>
							</div>
						{/if}
					</div>
				{:else}
					<a {href} class={cn(cardClass, 'p-5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')}>
						<div class="mb-4 flex items-center gap-2 text-muted-foreground">
							<Icon class="size-5 shrink-0" />
							<span class="text-base font-semibold tracking-tight text-foreground">{title}</span>
						</div>
						<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
							{statLabel}
						</p>
						<p class="mt-2 text-3xl font-semibold text-foreground tabular-nums" aria-live="polite">
							{tileStat(href)}
						</p>
					</a>
				{/if}
			</li>
		{/each}
	</ul>
</div>

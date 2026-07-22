<script lang="ts">
	import { page } from '$app/state';
	import Receipt from '@lucide/svelte/icons/receipt';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import DashboardLibraryTileFooter from '$lib/components/dashboard-library-tile-footer.svelte';
	import DashboardInvoicingTileFooter from '$lib/components/dashboard-invoicing-tile-footer.svelte';
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
			href: '/tasks',
			title: 'Tasks',
			statLabel: 'Open now',
			icon: ListChecks
		}
	];

	const cardClass = cn(
		'flex h-full flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-colors hover:border-ring/50 focus-within:border-ring/50'
	);

	const innerLinkClass = cn(
		'flex flex-1 flex-col rounded-t-xl p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring'
	);

	const taskCountsLoaded = $derived(
		data.criticalNowTaskCount != null && data.opportunityNowTaskCount != null
	);

	const taskBreakdown = $derived.by(() => {
		if (!taskCountsLoaded) return null;
		const parts: { label: string; count: number; tone: 'critical' | 'opportunity' }[] = [];
		const critical = data.criticalNowTaskCount ?? 0;
		const opportunity = data.opportunityNowTaskCount ?? 0;
		if (critical > 0) parts.push({ label: 'Critical', count: critical, tone: 'critical' });
		if (opportunity > 0) {
			parts.push({ label: 'Opportunity', count: opportunity, tone: 'opportunity' });
		}
		return parts;
	});

	function tileStat(href: string): string {
		if (href === '/invoicing') {
			if (data.unbilledPriorCount == null) return '–';
			return String(data.unbilledPriorCount);
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
				{:else if href === '/invoicing'}
					<div class={cardClass}>
						<a href="/invoicing" class={innerLinkClass}>
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
						{#if data.lastWeekInvoiceCandidates.length > 0}
							<DashboardInvoicingTileFooter candidates={data.lastWeekInvoiceCandidates} />
						{/if}
					</div>
				{:else if href === '/tasks'}
					<a
						{href}
						class={cn(
							cardClass,
							'p-5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
						)}
					>
						<div class="mb-4 flex items-center gap-2 text-muted-foreground">
							<Icon class="size-5 shrink-0" />
							<span class="text-base font-semibold tracking-tight text-foreground">{title}</span>
						</div>
						<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
							{statLabel}
						</p>
						{#if !taskCountsLoaded}
							<p class="mt-2 text-3xl font-semibold text-foreground tabular-nums" aria-live="polite">
								–
							</p>
						{:else if taskBreakdown && taskBreakdown.length === 0}
							<p class="mt-2 text-3xl font-semibold text-foreground tabular-nums" aria-live="polite">
								0
							</p>
							<p class="mt-1 text-sm text-muted-foreground">No open Critical or Opportunity tasks</p>
						{:else if taskBreakdown && taskBreakdown.length === 1}
							{@const only = taskBreakdown[0]}
							<p
								class={cn(
									'mt-2 text-3xl font-semibold tabular-nums',
									only.tone === 'critical'
										? 'text-red-700 dark:text-red-400'
										: 'text-amber-800 dark:text-amber-400'
								)}
								aria-live="polite"
							>
								{only.count}
								<span class="ml-1.5 text-base font-medium tracking-normal">{only.label}</span>
							</p>
						{:else if taskBreakdown}
							<div
								class="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2"
								aria-live="polite"
							>
								{#each taskBreakdown as part (part.tone)}
									<div class="min-w-0">
										<p
											class={cn(
												'text-3xl font-semibold tabular-nums',
												part.tone === 'critical'
													? 'text-red-700 dark:text-red-400'
													: 'text-amber-800 dark:text-amber-400'
											)}
										>
											{part.count}
										</p>
										<p class="mt-0.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
											{part.label}
										</p>
									</div>
								{/each}
							</div>
						{/if}
					</a>
				{:else}
					<a
						{href}
						class={cn(
							cardClass,
							'p-5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
						)}
					>
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

<script lang="ts">
	import { goto } from '$app/navigation';
	import ChartIcon from '@lucide/svelte/icons/chart-column';
	import { cn } from '$lib/utils';
	import PageHeader from '$lib/components/page-header.svelte';
	import InvoicingViewToggle from '$lib/components/invoicing-view-toggle.svelte';
	import InvoicingAnalyticsChart from '$lib/components/invoicing-analytics-chart.svelte';
	import {
		analyticsHref,
		type AnalyticsGrain,
		type AnalyticsMetric,
		type AnalyticsRangePreset
	} from '$lib/invoicing/analytics';
	import {
		formatYmdMediumChicago,
		formatYmdMonthYearChicago,
		ymdInChicago
	} from '$lib/invoicing/chicago-date';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const grains: { id: AnalyticsGrain; label: string }[] = [
		{ id: 'week', label: 'Week' },
		{ id: 'month', label: 'Month' }
	];

	const metrics: { id: AnalyticsMetric; label: string }[] = [
		{ id: 'hours', label: 'Hours' },
		{ id: 'money', label: 'Money' },
		{ id: 'both', label: 'Both' }
	];

	const rangePresets: { id: AnalyticsRangePreset; label: string }[] = [
		{ id: 'ytd', label: 'YTD' },
		{ id: '12m', label: '12 months' },
		{ id: '26w', label: '26 weeks' },
		{ id: 'all', label: 'All' },
		{ id: 'custom', label: 'Custom' }
	];

	function hrefFor(patch: {
		grain?: AnalyticsGrain;
		metric?: AnalyticsMetric;
		clientId?: string | null;
		rangePreset?: AnalyticsRangePreset;
		from?: string | null;
		to?: string | null;
	}): string {
		const rangePreset = patch.rangePreset ?? data.rangePreset;
		return analyticsHref({
			grain: patch.grain ?? data.grain,
			metric: patch.metric ?? data.metric,
			clientId: patch.clientId !== undefined ? patch.clientId : data.clientId,
			rangePreset,
			from:
				rangePreset === 'custom'
					? (patch.from !== undefined ? patch.from : data.from)
					: null,
			to: rangePreset === 'custom' ? (patch.to !== undefined ? patch.to : data.to) : null
		});
	}

	function onClientChange(e: Event) {
		const v = (e.currentTarget as HTMLSelectElement).value;
		void goto(hrefFor({ clientId: v === 'all' ? null : v }), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function onCustomFrom(e: Event) {
		const v = (e.currentTarget as HTMLInputElement).value;
		const to = data.to ?? data.rangeEnd ?? ymdInChicago();
		void goto(hrefFor({ rangePreset: 'custom', from: v, to }), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function onCustomTo(e: Event) {
		const v = (e.currentTarget as HTMLInputElement).value;
		const from = data.from ?? data.rangeStart ?? ymdInChicago();
		void goto(hrefFor({ rangePreset: 'custom', from, to: v }), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function money(n: number): string {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
	}

	function hoursLabel(n: number): string {
		return `${n}h`;
	}

	const rangeLabel = $derived.by(() => {
		if (data.grain === 'month') {
			return `${formatYmdMonthYearChicago(data.rangeStart)} – ${formatYmdMonthYearChicago(data.rangeEnd)}`;
		}
		return `${formatYmdMediumChicago(data.rangeStart)} – ${formatYmdMediumChicago(data.rangeEnd)}`;
	});

	const avgUnit = $derived(data.grain === 'week' ? 'week' : 'month');
</script>

<svelte:head>
	<title>Analytics — Invoicing — ppp</title>
</svelte:head>

<div class="relative mx-auto max-w-3xl px-4 pt-6 pb-tabbar md:px-6 md:pt-8 md:pb-10">
	<PageHeader
		title="Invoicing"
		subtitle="Analytics"
		class="mb-6"
		lead={headerLead}
		actions={headerActions}
	/>

	{#snippet headerLead()}
		<ChartIcon class="size-7 shrink-0 md:size-6" />
	{/snippet}

	{#snippet headerActions()}
		<InvoicingViewToggle active="analytics" />
	{/snippet}

	{#if data.error}
		<p
			class="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
		>
			{data.error}
		</p>
	{/if}

	<section
		class="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm"
		aria-label="Chart controls"
	>
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-xs font-medium text-muted-foreground">Range</span>
			<div
				class="inline-flex flex-wrap rounded-md border border-border p-0.5 text-xs font-medium"
				role="group"
				aria-label="Date range preset"
			>
				{#each rangePresets as p (p.id)}
					<a
						href={hrefFor({
							rangePreset: p.id,
							from: p.id === 'custom' ? (data.from ?? data.rangeStart) : null,
							to: p.id === 'custom' ? (data.to ?? data.rangeEnd) : null
						})}
						class={cn(
							'rounded-sm px-2.5 py-1.5 transition-colors',
							data.rangePreset === p.id
								? 'bg-foreground text-background'
								: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
						)}
						aria-current={data.rangePreset === p.id ? 'page' : undefined}
					>
						{p.label}
					</a>
				{/each}
			</div>
		</div>

		{#if data.rangePreset === 'custom'}
			<div class="flex flex-wrap items-end gap-3">
				<label class="flex flex-col gap-1 text-xs">
					<span class="font-medium text-muted-foreground">From</span>
					<input
						type="date"
						class="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
						value={data.from ?? data.rangeStart}
						onchange={onCustomFrom}
					/>
				</label>
				<label class="flex flex-col gap-1 text-xs">
					<span class="font-medium text-muted-foreground">To</span>
					<input
						type="date"
						class="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
						value={data.to ?? data.rangeEnd}
						onchange={onCustomTo}
					/>
				</label>
			</div>
		{/if}

		<div class="flex flex-wrap items-center gap-2">
			<span class="text-xs font-medium text-muted-foreground">Grain</span>
			<div
				class="inline-flex rounded-md border border-border p-0.5 text-xs font-medium"
				role="group"
				aria-label="Bucket grain"
			>
				{#each grains as g (g.id)}
					<a
						href={hrefFor({ grain: g.id })}
						class={cn(
							'rounded-sm px-3 py-1.5 transition-colors',
							data.grain === g.id
								? 'bg-foreground text-background'
								: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
						)}
						aria-current={data.grain === g.id ? 'page' : undefined}
					>
						{g.label}
					</a>
				{/each}
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<span class="text-xs font-medium text-muted-foreground">Show</span>
			<div
				class="inline-flex rounded-md border border-border p-0.5 text-xs font-medium"
				role="group"
				aria-label="Metric"
			>
				{#each metrics as m (m.id)}
					<a
						href={hrefFor({ metric: m.id })}
						class={cn(
							'rounded-sm px-3 py-1.5 transition-colors',
							data.metric === m.id
								? 'bg-foreground text-background'
								: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
						)}
						aria-current={data.metric === m.id ? 'page' : undefined}
					>
						{m.label}
					</a>
				{/each}
			</div>
		</div>

		{#if data.clients.length > 0}
			<label class="flex flex-wrap items-center gap-2 text-xs">
				<span class="font-medium text-muted-foreground">Client</span>
				<select
					class="h-9 min-w-[10rem] flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground sm:flex-none"
					value={data.clientId ?? 'all'}
					onchange={onClientChange}
				>
					<option value="all">All clients</option>
					{#each data.clients as c (c.id)}
						<option value={c.id}>{c.archived ? `${c.name} (archived)` : c.name}</option>
					{/each}
				</select>
			</label>
		{/if}

		<p class="text-xs text-muted-foreground">{rangeLabel}</p>
	</section>

	<section
		class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
		aria-label="Range summary"
	>
		<div class="rounded-xl border border-border bg-card p-3 shadow-sm">
			<p class="text-xs text-muted-foreground">Total hours</p>
			<p class="mt-1 text-lg font-semibold tabular-nums">{hoursLabel(data.summary.totalHours)}</p>
		</div>
		<div class="rounded-xl border border-border bg-card p-3 shadow-sm">
			<p class="text-xs text-muted-foreground">Total earned</p>
			<p class="mt-1 text-lg font-semibold tabular-nums">{money(data.summary.totalMoney)}</p>
			{#if data.summary.oneOffMoney > 0}
				<p class="mt-0.5 text-[11px] text-muted-foreground">
					incl. {money(data.summary.oneOffMoney)} one-offs
				</p>
			{/if}
		</div>
		<div class="rounded-xl border border-border bg-card p-3 shadow-sm">
			<p class="text-xs text-muted-foreground">Avg / {avgUnit}</p>
			<p class="mt-1 text-lg font-semibold tabular-nums">{hoursLabel(data.summary.avgHours)}</p>
		</div>
		<div class="rounded-xl border border-border bg-card p-3 shadow-sm">
			<p class="text-xs text-muted-foreground">Avg $ / {avgUnit}</p>
			<p class="mt-1 text-lg font-semibold tabular-nums">{money(data.summary.avgMoney)}</p>
		</div>
	</section>

	<section
		class="rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm sm:p-4"
		aria-label="Hours and earnings chart"
	>
		{#if data.series.length === 0}
			<p class="py-12 text-center text-sm text-muted-foreground">No time entries in this range.</p>
		{:else}
			<InvoicingAnalyticsChart series={data.series} grain={data.grain} metric={data.metric} />
		{/if}
	</section>
</div>

<script lang="ts">
	import { cn } from '$lib/utils';
	import type { AnalyticsBucket, AnalyticsGrain, AnalyticsMetric } from '$lib/invoicing/analytics';
	import { tooltipPeriodLabel } from '$lib/invoicing/analytics';

	let {
		series,
		grain,
		metric,
		class: className = ''
	}: {
		series: AnalyticsBucket[];
		grain: AnalyticsGrain;
		metric: AnalyticsMetric;
		class?: string;
	} = $props();

	const W = 640;
	const H = 240;
	const PAD = { top: 16, right: 48, bottom: 36, left: 48 };

	let activeIndex = $state<number | null>(null);

	const showHours = $derived(metric === 'hours' || metric === 'both');
	const showMoney = $derived(metric === 'money' || metric === 'both');
	const dual = $derived(metric === 'both');

	const plotW = $derived(W - PAD.left - PAD.right);
	const plotH = $derived(H - PAD.top - PAD.bottom);

	const maxHours = $derived(Math.max(1, ...series.map((b) => b.hours)));
	const maxMoney = $derived(Math.max(1, ...series.map((b) => b.money)));

	function xAt(i: number): number {
		if (series.length <= 1) return PAD.left + plotW / 2;
		return PAD.left + (i / (series.length - 1)) * plotW;
	}

	function yHours(v: number): number {
		return PAD.top + plotH - (v / maxHours) * plotH;
	}

	function yMoney(v: number): number {
		return PAD.top + plotH - (v / maxMoney) * plotH;
	}

	function linePath(
		values: number[],
		yFn: (v: number) => number
	): string {
		if (values.length === 0) return '';
		return values
			.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yFn(v).toFixed(1)}`)
			.join(' ');
	}

	function areaPath(
		values: number[],
		yFn: (v: number) => number
	): string {
		if (values.length === 0) return '';
		const top = linePath(values, yFn);
		const lastX = xAt(values.length - 1);
		const firstX = xAt(0);
		const base = PAD.top + plotH;
		return `${top} L ${lastX.toFixed(1)} ${base} L ${firstX.toFixed(1)} ${base} Z`;
	}

	const hoursLine = $derived(linePath(
		series.map((b) => b.hours),
		yHours
	));
	const hoursArea = $derived(areaPath(
		series.map((b) => b.hours),
		yHours
	));
	const moneyLine = $derived(linePath(
		series.map((b) => b.money),
		yMoney
	));
	const moneyArea = $derived(areaPath(
		series.map((b) => b.money),
		yMoney
	));

	const tickIndexes = $derived.by(() => {
		const n = series.length;
		if (n === 0) return [] as number[];
		if (n <= 6) return series.map((_, i) => i);
		const step = Math.ceil((n - 1) / 5);
		const idxs = [0];
		for (let i = step; i < n - 1; i += step) idxs.push(i);
		if (idxs[idxs.length - 1] !== n - 1) idxs.push(n - 1);
		return idxs;
	});

	function formatMoney(n: number): string {
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: n >= 1000 ? 0 : 2
		}).format(n);
	}

	function formatHours(n: number): string {
		return `${n}h`;
	}

	function axisMoney(n: number): string {
		if (n >= 1000) return `$${Math.round(n / 1000)}k`;
		return `$${Math.round(n)}`;
	}

	function onPointerMove(e: PointerEvent) {
		const svg = e.currentTarget as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * W;
		if (series.length === 0) {
			activeIndex = null;
			return;
		}
		if (series.length === 1) {
			activeIndex = 0;
			return;
		}
		const t = (x - PAD.left) / plotW;
		const i = Math.round(Math.min(1, Math.max(0, t)) * (series.length - 1));
		activeIndex = i;
	}

	function onPointerLeave() {
		activeIndex = null;
	}

	const active = $derived(activeIndex != null ? series[activeIndex] : null);
</script>

<div class={cn('relative w-full', className)}>
	<svg
		viewBox="0 0 {W} {H}"
		class="h-auto w-full touch-pan-y"
		role="img"
		aria-label="Hours and earnings over time"
		onpointermove={onPointerMove}
		onpointerleave={onPointerLeave}
		onpointerdown={onPointerMove}
	>
		<!-- grid -->
		{#each [0, 0.25, 0.5, 0.75, 1] as t (t)}
			{@const y = PAD.top + plotH * (1 - t)}
			<line
				x1={PAD.left}
				y1={y}
				x2={W - PAD.right}
				y2={y}
				class="stroke-border"
				stroke-width="1"
			/>
		{/each}

		<!-- left axis labels -->
		{#if showHours}
			{#each [0, 0.5, 1] as t (t)}
				{@const y = PAD.top + plotH * (1 - t)}
				<text
					x={PAD.left - 8}
					y={y + 3}
					text-anchor="end"
					class="fill-muted-foreground text-[10px]"
				>
					{formatHours(Math.round(maxHours * t * 10) / 10)}
				</text>
			{/each}
		{:else if showMoney}
			{#each [0, 0.5, 1] as t (t)}
				{@const y = PAD.top + plotH * (1 - t)}
				<text
					x={PAD.left - 8}
					y={y + 3}
					text-anchor="end"
					class="fill-muted-foreground text-[10px]"
				>
					{axisMoney(maxMoney * t)}
				</text>
			{/each}
		{/if}

		<!-- right axis (money when dual) -->
		{#if dual}
			{#each [0, 0.5, 1] as t (t)}
				{@const y = PAD.top + plotH * (1 - t)}
				<text
					x={W - PAD.right + 8}
					y={y + 3}
					text-anchor="start"
					class="fill-muted-foreground text-[10px]"
				>
					{axisMoney(maxMoney * t)}
				</text>
			{/each}
		{/if}

		<!-- x labels -->
		{#each tickIndexes as i (series[i]?.key ?? i)}
			{@const b = series[i]}
			{#if b}
				<text
					x={xAt(i)}
					y={H - 10}
					text-anchor="middle"
					class="fill-muted-foreground text-[10px]"
				>
					{b.label}
				</text>
			{/if}
		{/each}

		{#if showHours && !dual}
			<path d={hoursArea} class="fill-foreground/10" />
			<path d={hoursLine} fill="none" class="stroke-foreground" stroke-width="2" />
		{:else if showMoney && !dual}
			<path d={moneyArea} class="fill-foreground/10" />
			<path d={moneyLine} fill="none" class="stroke-foreground" stroke-width="2" />
		{:else if dual}
			<path d={hoursArea} class="fill-foreground/10" />
			<path d={hoursLine} fill="none" class="stroke-foreground" stroke-width="2" />
			<path
				d={moneyLine}
				fill="none"
				class="stroke-muted-foreground"
				stroke-width="2"
				stroke-dasharray="4 3"
			/>
		{/if}

		{#if activeIndex != null && series[activeIndex]}
			{@const ax = xAt(activeIndex)}
			<line
				x1={ax}
				y1={PAD.top}
				x2={ax}
				y2={PAD.top + plotH}
				class="stroke-foreground/40"
				stroke-width="1"
				stroke-dasharray="3 2"
			/>
			{#if showHours}
				<circle
					cx={ax}
					cy={yHours(series[activeIndex].hours)}
					r="4"
					class="fill-background stroke-foreground"
					stroke-width="2"
				/>
			{/if}
			{#if showMoney}
				<circle
					cx={ax}
					cy={yMoney(series[activeIndex].money)}
					r="4"
					class="fill-background stroke-muted-foreground"
					stroke-width="2"
				/>
			{/if}
		{/if}
	</svg>

	{#if active}
		<div
			class="pointer-events-none absolute top-2 left-1/2 z-10 w-[min(100%,16rem)] -translate-x-1/2 rounded-md border border-border bg-card px-3 py-2 text-xs text-card-foreground shadow-sm"
			role="status"
		>
			<p class="font-medium">{tooltipPeriodLabel(active.key, grain)}</p>
			<div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums text-muted-foreground">
				{#if showHours}
					<span>Hours: <span class="text-foreground">{formatHours(active.hours)}</span></span>
				{/if}
				{#if showMoney}
					<span>Earned: <span class="text-foreground">{formatMoney(active.money)}</span></span>
				{/if}
			</div>
		</div>
	{/if}

	{#if dual}
		<div class="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
			<span class="inline-flex items-center gap-1.5">
				<span class="inline-block size-2.5 rounded-sm bg-foreground"></span>
				Hours
			</span>
			<span class="inline-flex items-center gap-1.5">
				<span class="inline-block h-0.5 w-4 border-t-2 border-dashed border-muted-foreground"></span>
				Money
			</span>
		</div>
	{/if}
</div>

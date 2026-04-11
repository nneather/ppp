<script lang="ts">
	import { goto } from '$app/navigation';
	import Receipt from '@lucide/svelte/icons/receipt';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Plus from '@lucide/svelte/icons/plus';
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import TimeEntrySheet from '$lib/components/time-entry-sheet.svelte';
	import type { PageProps } from './$types';
	import type { PeriodView, TimeEntryRow } from '$lib/types/invoicing';

	let { data, form }: PageProps = $props();

	let sheetOpen = $state(false);
	let sheetMode = $state<'create' | 'edit'>('create');
	let selectedEntry = $state<TimeEntryRow | null>(null);

	const groups = $derived.by(() => {
		const out: { date: string; items: TimeEntryRow[] }[] = [];
		for (const e of data.entries) {
			const last = out[out.length - 1];
			if (last && last.date === e.date) last.items.push(e);
			else out.push({ date: e.date, items: [e] });
		}
		return out;
	});

	const periodLabel = $derived.by(() => {
		const s = parseYMDLocal(data.period_start);
		const e = parseYMDLocal(data.period_end);
		if (!s || !e) return '';
		if (data.view === 'day') {
			return s.toLocaleDateString(undefined, {
				weekday: 'long',
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			});
		}
		if (data.view === 'month') {
			return s.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
		}
		return `${fmtShort(s)} – ${fmtShort(e)}`;
	});

	function parseYMDLocal(ymd: string): Date | null {
		const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
		if (!m) return null;
		return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	}

	function fmtShort(d: Date): string {
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function formatDayHeader(ymd: string): string {
		const d = parseYMDLocal(ymd);
		if (!d) return ymd;
		return d.toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function money(n: number): string {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
	}

	function lineTotal(entry: TimeEntryRow): number {
		return Math.round(entry.hours * entry.rate * 100) / 100;
	}

	function searchFor(view: PeriodView, date: string): string {
		const u = new URLSearchParams();
		u.set('view', view);
		u.set('date', date);
		return `?${u.toString()}`;
	}

	function setView(view: PeriodView) {
		goto(searchFor(view, data.anchor), { replaceState: true, noScroll: true, keepFocus: true });
	}

	function shiftPeriod(dir: -1 | 1) {
		const target = dir === -1 ? data.prevAnchor : data.nextAnchor;
		goto(searchFor(data.view, target), { replaceState: true, noScroll: true, keepFocus: true });
	}

	function openCreate() {
		sheetMode = 'create';
		selectedEntry = null;
		sheetOpen = true;
	}

	function openEdit(entry: TimeEntryRow) {
		sheetMode = 'edit';
		selectedEntry = entry;
		sheetOpen = true;
	}

	const views: { id: PeriodView; label: string }[] = [
		{ id: 'day', label: 'Day' },
		{ id: 'week', label: 'Week' },
		{ id: 'month', label: 'Month' }
	];

	const formMessage = $derived(form && 'message' in form ? (form as { message?: string }) : null);
</script>

<svelte:head>
	<title>Invoicing — ppp</title>
</svelte:head>

<div class="relative mx-auto max-w-3xl px-4 pt-6 pb-28 md:px-6 md:pt-8 md:pb-10">
	<header class="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
		<div class="flex items-center gap-2 text-muted-foreground">
			<Receipt class="size-7 shrink-0 md:size-6" />
			<div>
				<h1 class="text-2xl font-semibold tracking-tight text-foreground">Invoicing</h1>
				<p class="text-sm text-muted-foreground">Time entries</p>
			</div>
		</div>
		<Button type="button" class="hidden h-10 gap-2 md:inline-flex" onclick={openCreate}>
			<Plus class="size-4" />
			New entry
		</Button>
	</header>

	{#if data.error}
		<p
			class="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
		>
			{data.error}
		</p>
	{/if}

	{#if data.unbilled.length > 0}
		<section
			class="mb-6 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
			aria-label="Unbilled entries by client"
		>
			<h2 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
				Unbilled
			</h2>
			<div class="flex flex-wrap gap-2">
				{#each data.unbilled as u (u.client_id)}
					<Badge variant="secondary" class="gap-1.5 px-2.5 py-1 text-sm tabular-nums">
						<span class="max-w-[10rem] truncate font-medium text-foreground">{u.client_name}</span>
						<span class="text-muted-foreground">{u.count}</span>
					</Badge>
				{/each}
			</div>
		</section>
	{/if}

	<div
		class="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
	>
		<div
			class="flex rounded-lg border border-border bg-muted/40 p-0.5"
			role="group"
			aria-label="Period"
		>
			{#each views as v (v.id)}
				<button
					type="button"
					class={cn(
						'min-h-10 flex-1 rounded-md px-3 text-sm font-medium transition-colors sm:flex-none',
						data.view === v.id
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground'
					)}
					aria-pressed={data.view === v.id}
					onclick={() => setView(v.id)}
				>
					{v.label}
				</button>
			{/each}
		</div>
		<div class="flex items-center justify-between gap-2 sm:justify-end">
			<Button
				type="button"
				variant="outline"
				size="icon"
				class="size-11 shrink-0 touch-manipulation md:size-10"
				aria-label="Previous period"
				onclick={() => shiftPeriod(-1)}
			>
				<ChevronLeft class="size-5" />
			</Button>
			<p class="min-w-0 flex-1 text-center text-sm font-medium text-foreground sm:max-w-md">
				{periodLabel}
			</p>
			<Button
				type="button"
				variant="outline"
				size="icon"
				class="size-11 shrink-0 touch-manipulation md:size-10"
				aria-label="Next period"
				onclick={() => shiftPeriod(1)}
			>
				<ChevronRight class="size-5" />
			</Button>
		</div>
	</div>

	{#if groups.length === 0}
		<div
			class="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground"
		>
			No time entries in this period.
			<button
				type="button"
				class="mt-3 block w-full font-medium text-foreground underline-offset-4 hover:underline"
				onclick={openCreate}
			>
				Log your first hour
			</button>
		</div>
	{:else}
		<ul class="space-y-8">
			{#each groups as g (g.date)}
				<li>
					<div class="mb-2 flex items-center gap-2">
						<h2 class="text-sm font-semibold tracking-tight text-foreground">
							{formatDayHeader(g.date)}
						</h2>
						<Separator class="flex-1" />
					</div>
					<ul class="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
						{#each g.items as entry (entry.id)}
							<li>
								<button
									type="button"
									class="flex min-h-14 w-full touch-manipulation flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50 md:min-h-12 md:flex-row md:items-center md:justify-between md:gap-4"
									onclick={() => openEdit(entry)}
								>
									<div class="min-w-0 flex-1">
										<p class="truncate font-medium text-foreground">{entry.client_name}</p>
										{#if entry.description}
											<p class="line-clamp-2 text-sm text-muted-foreground">{entry.description}</p>
										{/if}
									</div>
									<div
										class="flex shrink-0 items-center gap-3 text-sm tabular-nums md:flex-col md:items-end md:gap-0.5"
									>
										<span class="text-muted-foreground">
											{entry.hours}h × {money(entry.rate)}
										</span>
										<span class="font-semibold text-foreground">{money(lineTotal(entry))}</span>
									</div>
								</button>
							</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ul>
	{/if}

	<!-- Mobile FAB -->
	<Button
		type="button"
		class="fixed right-4 z-40 size-14 rounded-full shadow-lg md:hidden"
		style="bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px));"
		aria-label="New time entry"
		onclick={openCreate}
	>
		<Plus class="size-7" />
	</Button>
</div>

<TimeEntrySheet
	bind:open={sheetOpen}
	clients={data.clients}
	mode={sheetMode}
	entry={selectedEntry}
	formMessage={sheetOpen ? formMessage : null}
/>

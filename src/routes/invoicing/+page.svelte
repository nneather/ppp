<script lang="ts">
	import { goto } from '$app/navigation';
	import Receipt from '@lucide/svelte/icons/receipt';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Plus from '@lucide/svelte/icons/plus';
	import FileText from '@lucide/svelte/icons/file-text';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
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

	type ClientGroup = {
		client_id: string;
		client_name: string;
		dates: { date: string; items: TimeEntryRow[] }[];
	};

	const clientGroups = $derived.by((): ClientGroup[] => {
		const byClient = new Map<
			string,
			{ client_id: string; client_name: string; entries: TimeEntryRow[] }
		>();
		for (const e of data.entries) {
			const prev = byClient.get(e.client_id);
			if (prev) prev.entries.push(e);
			else
				byClient.set(e.client_id, {
					client_id: e.client_id,
					client_name: e.client_name,
					entries: [e]
				});
		}
		const sortedClients = [...byClient.values()].sort((a, b) =>
			a.client_name.localeCompare(b.client_name)
		);
		return sortedClients.map((g) => {
			const sorted = [...g.entries].sort(
				(a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
			);
			const dates: { date: string; items: TimeEntryRow[] }[] = [];
			for (const e of sorted) {
				const last = dates[dates.length - 1];
				if (last && last.date === e.date) last.items.push(e);
				else dates.push({ date: e.date, items: [e] });
			}
			return { client_id: g.client_id, client_name: g.client_name, dates };
		});
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

	function clientGroupTotal(cg: ClientGroup): number {
		let t = 0;
		for (const d of cg.dates) {
			for (const e of d.items) t += lineTotal(e);
		}
		return Math.round(t * 100) / 100;
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
		<div class="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
			<Button
				variant="outline"
				href="/invoicing/invoices"
				class="h-10 min-h-10 flex-1 gap-2 sm:flex-none"
			>
				<FileText class="size-4" />
				Invoices
			</Button>
			<Button type="button" class="h-10 min-h-10 flex-1 gap-2 sm:flex-none" onclick={openCreate}>
				<Plus class="size-4" />
				New entry
			</Button>
		</div>
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

	{#if clientGroups.length === 0}
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
		<ul class="space-y-4">
			{#each clientGroups as cg (cg.client_id)}
				<li>
					<details class="group rounded-xl border border-border bg-card shadow-sm" open>
						<summary
							class="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden"
						>
							<span class="min-w-0 truncate">{cg.client_name}</span>
							<span class="flex shrink-0 items-center gap-2">
								<span class="text-sm font-semibold tabular-nums text-foreground"
									>{money(clientGroupTotal(cg))}</span
								>
								<span class="text-xs text-muted-foreground group-open:rotate-0">▼</span>
							</span>
						</summary>
						<div class="border-t border-border px-1 pb-2">
							<ul class="space-y-5 pt-2">
								{#each cg.dates as g (g.date)}
									<li>
										<div class="mb-1.5 flex items-center gap-2 px-2">
											<h2 class="text-xs font-semibold tracking-tight text-muted-foreground">
												{formatDayHeader(g.date)}
											</h2>
											<Separator class="flex-1" />
										</div>
										<ul
											class="divide-y divide-border rounded-lg border border-border/80 bg-background"
										>
											{#each g.items as entry (entry.id)}
												<li>
													{#if entry.is_one_off}
														<div
															class="flex min-h-10 w-full items-start gap-2 px-3 py-2 md:min-h-9 md:items-center"
														>
															<div class="min-w-0 flex-1">
																{#if entry.description}
																	<p
																		class="line-clamp-2 text-sm leading-snug text-muted-foreground"
																	>
																		{entry.description}
																	</p>
																{:else}
																	<p class="text-sm text-muted-foreground/80">—</p>
																{/if}
															</div>
															<div
																class="flex shrink-0 items-center gap-2 text-xs tabular-nums md:text-sm"
															>
																<div
																	class="flex flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-2"
																>
																	<span class="text-muted-foreground">
																		{entry.hours}h × {money(entry.rate)}
																	</span>
																	<span class="font-semibold text-foreground"
																		>{money(lineTotal(entry))}</span
																	>
																</div>
																<span class="inline-flex shrink-0 items-center gap-1.5">
																	<Badge
																		variant="outline"
																		class="text-[10px] font-normal uppercase"
																	>
																		One-off
																	</Badge>
																	{#if entry.invoice_id}
																		<CircleCheck
																			class="size-4 text-muted-foreground"
																			aria-label="Billed"
																		/>
																	{/if}
																</span>
															</div>
														</div>
													{:else}
														<button
															type="button"
															class="flex min-h-10 w-full touch-manipulation items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50 md:min-h-9 md:items-center"
															onclick={() => openEdit(entry)}
														>
															<div class="min-w-0 flex-1">
																{#if entry.description}
																	<p
																		class="line-clamp-2 text-sm leading-snug text-muted-foreground"
																	>
																		{entry.description}
																	</p>
																{:else}
																	<p class="text-sm text-muted-foreground/80">—</p>
																{/if}
															</div>
															<div
																class="flex shrink-0 items-center gap-2 text-xs tabular-nums md:text-sm"
															>
																<div
																	class="flex flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-2"
																>
																	<span class="text-muted-foreground">
																		{entry.hours}h × {money(entry.rate)}
																	</span>
																	<span class="font-semibold text-foreground"
																		>{money(lineTotal(entry))}</span
																	>
																</div>
																<span
																	class="inline-flex w-4 shrink-0 justify-center"
																	aria-hidden="true"
																>
																	{#if entry.invoice_id}
																		<CircleCheck
																			class="size-4 text-muted-foreground"
																			aria-label="Billed"
																		/>
																	{/if}
																</span>
															</div>
														</button>
													{/if}
												</li>
											{/each}
										</ul>
									</li>
								{/each}
							</ul>
						</div>
					</details>
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

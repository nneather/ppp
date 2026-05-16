<script lang="ts">
	import Receipt from '@lucide/svelte/icons/receipt';
	import Plus from '@lucide/svelte/icons/plus';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';
	import GenerateInvoiceSheet from '$lib/components/generate-invoice-sheet.svelte';
	import type { PageProps } from './$types';
	import type { InvoiceStatus } from '$lib/types/invoicing';

	let { data, form }: PageProps = $props();

	let sheetOpen = $state(false);
	let statusFilter = $state<'all' | 'active' | InvoiceStatus>('active');

	const formMessage = $derived(form && 'message' in form ? (form as { message?: string }) : null);

	const filteredInvoices = $derived.by(() => {
		if (statusFilter === 'all') return data.invoices;
		if (statusFilter === 'active')
			return data.invoices.filter((inv) => inv.status === 'draft' || inv.status === 'sent');
		return data.invoices.filter((inv) => inv.status === statusFilter);
	});

	function statusVariant(s: InvoiceStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
		if (s === 'paid') return 'secondary';
		if (s === 'sent') return 'default';
		if (s === 'discarded') return 'destructive';
		return 'outline';
	}

	function formatPeriod(start: string, end: string): string {
		const a = parseYMD(start);
		const b = parseYMD(end);
		if (!a || !b) return `${start} – ${end}`;
		if (start === end) {
			return a.toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		}
		return `${fmtShort(a)} – ${fmtShort(b)}, ${a.getFullYear()}`;
	}

	function parseYMD(ymd: string): Date | null {
		const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
		if (!m) return null;
		return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	}

	function fmtShort(d: Date): string {
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function money(n: number): string {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
	}

	const statusFilters: { id: typeof statusFilter; label: string }[] = [
		{ id: 'active', label: 'Active' },
		{ id: 'draft', label: 'Draft' },
		{ id: 'sent', label: 'Sent' },
		{ id: 'paid', label: 'Paid' },
		{ id: 'discarded', label: 'Discarded' },
		{ id: 'all', label: 'All' }
	];
</script>

<svelte:head>
	<title>Invoices — ppp</title>
</svelte:head>

<div class="relative mx-auto max-w-3xl px-4 pt-6 pb-28 md:px-6 md:pt-8 md:pb-10">
	<header class="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
		<div class="flex flex-col gap-1">
			<a
				href="/invoicing"
				class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ChevronLeft class="size-4" />
				Time entries
			</a>
			<div class="flex items-center gap-2 text-muted-foreground">
				<Receipt class="size-7 shrink-0 md:size-6" />
				<div>
					<p class="text-xs font-medium text-muted-foreground">Invoicing</p>
					<h1 class="text-2xl font-semibold tracking-tight text-foreground">Invoices</h1>
				</div>
			</div>
		</div>
		<Button
			type="button"
			class="hidden h-10 gap-2 md:inline-flex"
			onclick={() => (sheetOpen = true)}
		>
			<Plus class="size-4" />
			Generate invoice
		</Button>
	</header>

	{#if data.error}
		<p
			class="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
		>
			{data.error}
		</p>
	{/if}

	{#if data.unbilledSummary.length > 0}
		<section
			class="mb-6 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
			aria-label="Unbilled entries by client"
		>
			<h2 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
				Unbilled
			</h2>
			<div class="flex flex-wrap gap-2">
				{#each data.unbilledSummary as u (u.client_id)}
					<Badge variant="secondary" class="gap-1.5 px-2.5 py-1 text-sm tabular-nums">
						<span class="max-w-[10rem] truncate font-medium text-foreground">{u.client_name}</span>
						<span class="text-muted-foreground">{u.count}</span>
					</Badge>
				{/each}
			</div>
		</section>
	{/if}

	<div
		class="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between"
	>
		<div
			class="flex flex-wrap rounded-lg border border-border bg-muted/40 p-0.5"
			role="group"
			aria-label="Filter by status"
		>
			{#each statusFilters as f (f.id)}
				<button
					type="button"
					class={cn(
						'min-h-9 rounded-md px-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm',
						statusFilter === f.id
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground'
					)}
					aria-pressed={statusFilter === f.id}
					onclick={() => (statusFilter = f.id)}
				>
					{f.label}
				</button>
			{/each}
		</div>
	</div>

	{#if data.invoices.length === 0}
		<div
			class="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground"
		>
			No invoices yet.
			<button
				type="button"
				class="mt-3 block w-full font-medium text-foreground underline-offset-4 hover:underline"
				onclick={() => (sheetOpen = true)}
			>
				Generate your first invoice
			</button>
		</div>
	{:else if filteredInvoices.length === 0}
		<p
			class="rounded-lg border border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground"
		>
			No invoices match this filter.
		</p>
	{:else}
		<div class="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border bg-muted/40 text-left text-muted-foreground">
						<th class="px-4 py-3 font-medium">Invoice</th>
						<th class="hidden px-2 py-3 font-medium sm:table-cell">Client</th>
						<th class="hidden px-2 py-3 font-medium md:table-cell">Period</th>
						<th class="px-2 py-3 font-medium">Status</th>
						<th class="px-4 py-3 text-right font-medium">Total</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each filteredInvoices as inv (inv.id)}
						<tr class="hover:bg-muted/30">
							<td class="px-4 py-3">
								<a
									href="/invoicing/invoices/{inv.id}"
									class="font-medium text-foreground underline-offset-4 hover:underline"
								>
									{inv.invoice_number}
								</a>
								<p class="mt-0.5 text-muted-foreground sm:hidden">{inv.client_name}</p>
							</td>
							<td class="hidden px-2 py-3 text-muted-foreground sm:table-cell">{inv.client_name}</td
							>
							<td class="hidden px-2 py-3 text-muted-foreground md:table-cell">
								{formatPeriod(inv.period_start, inv.period_end)}
							</td>
							<td class="px-2 py-3">
								<Badge variant={statusVariant(inv.status)} class="capitalize">{inv.status}</Badge>
							</td>
							<td class="px-4 py-3 text-right font-medium text-foreground tabular-nums">
								{money(inv.total)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<Button
		type="button"
		class="fixed right-4 z-40 size-14 rounded-full shadow-lg md:hidden"
		style="bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px) + 0.5rem);"
		aria-label="Generate invoice"
		onclick={() => (sheetOpen = true)}
	>
		<Plus class="size-7" />
	</Button>
</div>

<GenerateInvoiceSheet
	bind:open={sheetOpen}
	clients={data.clients}
	unbilledBounds={data.unbilledBounds}
	unbilledEntries={data.unbilledEntries}
	formMessage={sheetOpen ? formMessage : null}
/>

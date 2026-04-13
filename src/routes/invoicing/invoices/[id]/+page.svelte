<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import type { PageProps } from './$types';
	import type { InvoiceStatus } from '$lib/types/invoicing';

	let { data, form }: PageProps = $props();

	const discardMessage = $derived(
		form && 'message' in form ? (form as { message?: string }).message : undefined
	);

	let discardPending = $state(false);

	const discardEnhance: SubmitFunction = () => {
		discardPending = true;
		return async ({ update }) => {
			discardPending = false;
			await update();
		};
	};


	const inv = $derived(data.invoice);

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
				weekday: 'long',
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			});
		}
		return `${fmtLong(a)} – ${fmtLong(b)}`;
	}

	function parseYMD(ymd: string): Date | null {
		const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
		if (!m) return null;
		return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	}

	function fmtLong(d: Date): string {
		return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
	}

	function money(n: number): string {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
	}
</script>

<svelte:head>
	<title>{inv.invoice_number} — ppp</title>
</svelte:head>

<div class="relative mx-auto max-w-3xl px-4 pt-6 pb-16 md:px-6 md:pt-8 md:pb-10">
	<p class="mb-4">
		<a
			href="/invoicing/invoices"
			class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ChevronLeft class="size-4" />
			All invoices
		</a>
	</p>

	<header
		class="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between"
	>
		<div>
			<h1 class="text-2xl font-semibold tracking-tight text-foreground">{inv.invoice_number}</h1>
			<p class="mt-1 text-lg text-foreground">{inv.client_name}</p>
			<p class="mt-2 text-sm text-muted-foreground">Billing period: {formatPeriod(inv.period_start, inv.period_end)}</p>
		</div>
		<div class="flex flex-col items-start gap-2 sm:items-end">
			<Badge variant={statusVariant(inv.status)} class="capitalize">{inv.status}</Badge>
			<p class="text-xs text-muted-foreground">
				Created {new Date(inv.created_at).toLocaleString()}
			</p>
		</div>
	</header>

	<section class="mb-8">
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Line items</h2>
		<div class="overflow-hidden rounded-xl border border-border">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border bg-muted/40 text-left text-muted-foreground">
						<th class="px-4 py-3 font-medium">Description</th>
						<th class="hidden w-24 px-2 py-3 text-right font-medium sm:table-cell">Qty</th>
						<th class="hidden w-28 px-2 py-3 text-right font-medium md:table-cell">Rate</th>
						<th class="w-28 px-4 py-3 text-right font-medium">Amount</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each inv.line_items as line (line.id)}
						<tr>
							<td class="px-4 py-3">
								<span class="text-foreground">{line.description}</span>
								{#if line.is_one_off}
									<Badge variant="outline" class="ml-2 align-middle text-[0.65rem]">One-off</Badge>
								{/if}
							</td>
							<td class="hidden px-2 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
								{line.quantity != null ? line.quantity : '—'}
							</td>
							<td class="hidden px-2 py-3 text-right tabular-nums text-muted-foreground md:table-cell">
								{line.unit_price != null ? money(line.unit_price) : '—'}
							</td>
							<td class="px-4 py-3 text-right tabular-nums font-medium text-foreground">
								{money(line.total)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<div class="space-y-2 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
		<div class="flex justify-between text-sm">
			<span class="text-muted-foreground">Subtotal</span>
			<span class="tabular-nums font-medium">{money(inv.subtotal)}</span>
		</div>
		<Separator />
		<div class="flex justify-between text-base">
			<span class="font-semibold text-foreground">Total</span>
			<span class="tabular-nums font-semibold text-foreground">{money(inv.total)}</span>
		</div>
	</div>

	{#if inv.status === 'draft'}
		<div class="mt-6 space-y-3">
			{#if discardMessage}
				<p
					class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
					role="alert"
				>
					{discardMessage}
				</p>
			{/if}
			<form
				method="POST"
				action="?/discard"
				use:enhance={discardEnhance}
				onsubmit={(e) => {
					if (
						!confirm(
							'Discard this draft? Time entries will return to unbilled and this invoice will be removed.'
						)
					) {
						e.preventDefault();
					}
				}}
			>
				<Button
					type="submit"
					variant="destructive"
					class="w-full sm:w-auto"
					disabled={discardPending}
				>
					{discardPending ? 'Discarding…' : 'Discard draft'}
				</Button>
			</form>
		</div>
	{/if}

	{#if inv.notes}
		<section class="mt-8">
			<h2 class="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Notes</h2>
			<p class="whitespace-pre-wrap text-sm text-foreground">{inv.notes}</p>
		</section>
	{/if}
</div>

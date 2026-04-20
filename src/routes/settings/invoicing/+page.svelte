<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import type { PageProps } from './$types';
	import type { ClientCardData, ClientRateRow } from './+page.server';

	let { data }: PageProps = $props();

	let expanded = $state(new Set<string>());

	function toggleExpand(id: string) {
		const next = new Set(expanded);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expanded = next;
	}

	function money(n: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
	}

	function formatRange(r: ClientRateRow): string {
		const end = r.effective_to ?? 'present';
		return `${r.effective_from} → ${end}`;
	}

	function dash(s: string | null | undefined): string {
		const t = s?.trim();
		return t && t.length > 0 ? t : '—';
	}
</script>

<svelte:head>
	<title>Invoicing — Settings — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 pb-16 md:px-6 md:py-8 md:pb-10">
	<p class="mb-4">
		<a
			href="/settings"
			class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ChevronLeft class="size-4" />
			Settings
		</a>
	</p>

	<header class="mb-8 border-b border-border pb-6">
		<h1 class="text-2xl font-semibold tracking-tight text-foreground">Invoicing</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Read-only view of clients, rates, and billing defaults. No CRUD UI for August — edit via Supabase
			Studio or SQL when needed.
		</p>
	</header>

	{#if data.loadError}
		<p class="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{data.loadError}
		</p>
	{/if}

	<section
		class="mb-8 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
		aria-labelledby="defaults-heading"
	>
		<h2 id="defaults-heading" class="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
			Universal invoicing defaults
		</h2>
		<p class="mt-2 text-sm text-muted-foreground">
			Used to pre-fill CC when sending invoices. Edit in Supabase for now (<code class="text-xs"
				>profiles.default_cc_emails</code
			>).
		</p>
		{#if data.defaultCcEmails.length === 0}
			<p class="mt-3 text-sm text-foreground">—</p>
		{:else}
			<ul class="mt-3 list-inside list-disc text-sm text-foreground">
				{#each data.defaultCcEmails as addr (addr)}
					<li>{addr}</li>
				{/each}
			</ul>
		{/if}
	</section>

	<h2 class="sr-only">Clients</h2>
	<ul class="space-y-4">
		{#each data.clients as c (c.id)}
			<li>
				{@render clientCard(c)}
			</li>
		{/each}
	</ul>

	{#if data.clients.length === 0}
		<p class="mt-6 text-sm text-muted-foreground">No clients found.</p>
	{/if}
</div>

{#snippet clientCard(c: ClientCardData)}
	<div class="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h3 class="text-lg font-semibold tracking-tight text-foreground">{c.name}</h3>
				{#if c.activeRate}
					<p class="mt-1 text-sm text-muted-foreground">
						Active from {c.activeRate.effective_from}
						{#if c.activeRate.effective_to}
							to {c.activeRate.effective_to}
						{:else}
							(onward)
						{/if}
					</p>
				{:else}
					<p class="mt-1 text-sm text-muted-foreground">No active rate for today’s date.</p>
				{/if}
			</div>
			{#if c.activeRate}
				<Badge variant="secondary" class="tabular-nums">{money(c.activeRate.rate)}/hr</Badge>
			{/if}
		</div>

		<div class="mt-4 space-y-2 text-sm">
			<p><span class="text-muted-foreground">Billing contact</span> — {dash(c.billing_contact)}</p>
			<div>
				<p class="text-muted-foreground">Address</p>
				<p class="mt-0.5 text-foreground">{dash(c.address_line_1)}</p>
				{#if c.address_line_2?.trim()}
					<p class="text-foreground">{c.address_line_2}</p>
				{/if}
			</div>
			<div class="pt-1">
				<p class="text-muted-foreground">Invoice recipient email(s)</p>
				{#if c.email.length === 0}
					<p class="text-foreground">—</p>
				{:else}
					<ul class="mt-1 list-inside list-disc text-foreground">
						{#each c.email as addr (addr)}
							<li>{addr}</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>

		{#if c.rates.length > 0}
			<div class="mt-4 border-t border-border pt-4">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					class="-ml-2 h-auto gap-1 px-2 py-1 text-muted-foreground hover:text-foreground"
					onclick={() => toggleExpand(c.id)}
					aria-expanded={expanded.has(c.id)}
				>
					<ChevronDown
						class={cn('size-4 transition-transform', expanded.has(c.id) && 'rotate-180')}
					/>
					{c.rates.length === 1 ? 'Rate history' : `Rate history (${c.rates.length})`}
				</Button>
				{#if expanded.has(c.id)}
					<ul class="mt-2 space-y-2 text-sm">
						{#each c.rates as r (r.effective_from + String(r.rate) + (r.service_type ?? ''))}
							<li class="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 py-2 last:border-0">
								<span class="text-muted-foreground">{formatRange(r)}</span>
								<span class="font-medium tabular-nums text-foreground">{money(r.rate)}/hr</span>
								{#if r.service_type}
									<span class="w-full text-xs text-muted-foreground">{r.service_type}</span>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

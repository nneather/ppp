<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import ClientFormSheet, { type ClientFormInitial } from '$lib/components/client-form-sheet.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import DefaultCcDialog from '$lib/components/default-cc-dialog.svelte';
	import RateFormSheet, { type RateFormInitial } from '$lib/components/rate-form-sheet.svelte';
	import type { PageProps } from './$types';
	import type { ClientCardData, ClientRateRow } from './+page.server';

	let { data, form }: PageProps = $props();

	type AnyForm = {
		kind?: string;
		clientId?: string;
		rateId?: string;
		message?: string;
		needsConfirm?: boolean;
		entryCount?: number;
		success?: boolean;
	};
	const f = $derived((form ?? null) as AnyForm | null);

	let expanded = $state(new Set<string>());

	let defaultCcOpen = $state(false);
	let clientSheetOpen = $state(false);
	let clientSheetMode = $state<'create' | 'edit'>('create');
	let clientSheetInitial = $state<ClientFormInitial | null>(null);

	let rateSheetOpen = $state(false);
	let rateSheetMode = $state<'create' | 'edit'>('create');
	let rateSheetClientId = $state('');
	let rateSheetClientName = $state('');
	let rateSheetInitial = $state<RateFormInitial | null>(null);

	let confirmOpen = $state(false);
	let confirmTitle = $state('');
	let confirmDescription = $state('');
	let confirmConfirmLabel = $state('Delete');
	let confirmDestructive = $state(true);
	let pendingConfirm = $state(false);
	let confirmFormId = $state<string | null>(null);
	let confirmExtraField = $state<{ name: string; value: string } | null>(null);

	function toggleExpand(id: string) {
		const next = new Set(expanded);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expanded = next;
	}

	function openCreateClient() {
		clientSheetMode = 'create';
		clientSheetInitial = {
			name: '',
			billing_contact: null,
			address_line_1: null,
			address_line_2: null,
			email: [],
			sort_rank: null
		};
		clientSheetOpen = true;
	}

	function openEditClient(c: ClientCardData) {
		clientSheetMode = 'edit';
		clientSheetInitial = {
			id: c.id,
			name: c.name,
			billing_contact: c.billing_contact,
			address_line_1: c.address_line_1,
			address_line_2: c.address_line_2,
			email: [...c.email],
			sort_rank: c.sort_rank
		};
		clientSheetOpen = true;
	}

	function openCreateRate(c: ClientCardData) {
		rateSheetMode = 'create';
		rateSheetClientId = c.id;
		rateSheetClientName = c.name;
		rateSheetInitial = null;
		rateSheetOpen = true;
	}

	function openEditRate(c: ClientCardData, r: ClientRateRow) {
		rateSheetMode = 'edit';
		rateSheetClientId = c.id;
		rateSheetClientName = c.name;
		rateSheetInitial = {
			id: r.id,
			client_id: r.client_id,
			rate: r.rate,
			effective_from: r.effective_from,
			effective_to: r.effective_to,
			service_type: r.service_type
		};
		rateSheetOpen = true;
	}

	function askDeleteClient(c: ClientCardData, withConfirm = false) {
		confirmTitle = withConfirm ? `Soft-delete ${c.name}?` : `Delete ${c.name}?`;
		confirmDescription = withConfirm
			? `${c.name} has ${c.unbilledEntryCount} unbilled time entr${c.unbilledEntryCount === 1 ? 'y' : 'ies'}. Soft-deleting hides the client; existing entries stay attached but become unselectable for new invoices.`
			: 'This soft-deletes the client. Existing invoices stay accessible.';
		confirmConfirmLabel = withConfirm ? 'Soft-delete client' : 'Delete client';
		confirmDestructive = true;
		confirmFormId = `delete-client-${c.id}`;
		confirmExtraField = withConfirm ? { name: 'confirm', value: 'hard' } : null;
		confirmOpen = true;
	}

	function askDeleteRate(c: ClientCardData, r: ClientRateRow) {
		confirmTitle = 'Delete rate?';
		confirmDescription = `${money(r.rate)}/hr · ${formatRange(r)}. This soft-deletes the rate row.`;
		confirmConfirmLabel = 'Delete rate';
		confirmDestructive = true;
		confirmFormId = `delete-rate-${r.id}`;
		confirmExtraField = null;
		confirmOpen = true;
	}

	const confirmEnhance: SubmitFunction = () => {
		pendingConfirm = true;
		return async ({ result, update }) => {
			pendingConfirm = false;
			await update();
			if (result.type === 'success') {
				confirmOpen = false;
			} else {
				// Keep dialog open so the user sees the error inline.
				confirmOpen = false;
			}
		};
	};

	function submitConfirm() {
		if (typeof document === 'undefined' || !confirmFormId) return;
		const formEl = document.getElementById(confirmFormId) as HTMLFormElement | null;
		if (!formEl) return;
		if (confirmExtraField) {
			let extra = formEl.querySelector(
				`input[name="${confirmExtraField.name}"][data-confirm-extra="1"]`
			) as HTMLInputElement | null;
			if (!extra) {
				extra = document.createElement('input');
				extra.type = 'hidden';
				extra.name = confirmExtraField.name;
				extra.dataset.confirmExtra = '1';
				formEl.appendChild(extra);
			}
			extra.value = confirmExtraField.value;
		} else {
			formEl
				.querySelectorAll('input[data-confirm-extra="1"]')
				.forEach((el) => el.remove());
		}
		formEl.requestSubmit();
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

	const defaultCcError = $derived(
		f && f.kind === 'defaultCc' && !f.success ? (f.message ?? null) : null
	);
	const createClientError = $derived(
		f && f.kind === 'createClient' && !f.success ? (f.message ?? null) : null
	);
	const updateClientError = $derived(
		f &&
			f.kind === 'updateClient' &&
			!f.success &&
			clientSheetMode === 'edit' &&
			clientSheetInitial?.id === f.clientId
			? (f.message ?? null)
			: null
	);
	const clientFormError = $derived(
		clientSheetMode === 'create' ? createClientError : updateClientError
	);

	const rateFormError = $derived(
		f &&
			(f.kind === 'createRate' || f.kind === 'updateRate') &&
			!f.success &&
			f.clientId === rateSheetClientId
			? (f.message ?? null)
			: null
	);

	const generalError = $derived.by(() => {
		if (!f) return null;
		if (f.success) return null;
		// Inline rate / client form errors are surfaced in their own sheets.
		if (
			f.kind === 'createClient' ||
			f.kind === 'updateClient' ||
			f.kind === 'createRate' ||
			f.kind === 'updateRate' ||
			f.kind === 'defaultCc'
		)
			return null;
		return f.message ?? null;
	});

	// Auto-prompt the soft-delete confirm when server flags needsConfirm.
	$effect(() => {
		if (!f || f.kind !== 'deleteClient' || f.success) return;
		if (!f.needsConfirm || !f.clientId) return;
		const c = data.clients.find((x) => x.id === f.clientId);
		if (!c) return;
		askDeleteClient(c, true);
	});

	$effect(() => {
		if (!f || !f.success) return;
		if (f.kind === 'createClient' || f.kind === 'updateClient') clientSheetOpen = false;
		if (f.kind === 'createRate' || f.kind === 'updateRate') rateSheetOpen = false;
		if (f.kind === 'deleteClient' || f.kind === 'deleteRate') confirmOpen = false;
		if (f.kind === 'defaultCc') defaultCcOpen = false;
	});
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

	<header class="mb-8 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-6">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight text-foreground">Invoicing</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Manage clients, hourly rates, and default CC recipients.
			</p>
		</div>
		<Button type="button" size="sm" onclick={openCreateClient} class="gap-1">
			<Plus class="size-4" /> New client
		</Button>
	</header>

	{#if data.loadError}
		<p class="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{data.loadError}
		</p>
	{/if}

	{#if generalError}
		<p
			class="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
			role="alert"
		>
			{generalError}
		</p>
	{/if}

	<section
		class="mb-8 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
		aria-labelledby="defaults-heading"
	>
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h2
					id="defaults-heading"
					class="text-sm font-semibold tracking-wide text-muted-foreground uppercase"
				>
					Universal invoicing defaults
				</h2>
				<p class="mt-2 text-sm text-muted-foreground">
					Pre-filled in the CC field whenever you send an invoice.
				</p>
			</div>
			<Button
				type="button"
				variant="outline"
				size="sm"
				class="gap-1"
				onclick={() => (defaultCcOpen = true)}
			>
				<Pencil class="size-4" /> Edit
			</Button>
		</div>
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
		<p class="mt-6 text-sm text-muted-foreground">
			No clients yet — use “New client” to add your first.
		</p>
	{/if}
</div>

<!-- Hidden delete forms (one per client + per rate) so confirm dialogs can target them. -->
{#each data.clients as c (c.id)}
	<form
		id={`delete-client-${c.id}`}
		method="POST"
		action="?/deleteClient"
		class="hidden"
		use:enhance={confirmEnhance}
	>
		<input type="hidden" name="id" value={c.id} />
	</form>
	{#each c.rates as r (r.id)}
		<form
			id={`delete-rate-${r.id}`}
			method="POST"
			action="?/deleteRate"
			class="hidden"
			use:enhance={confirmEnhance}
		>
			<input type="hidden" name="id" value={r.id} />
			<input type="hidden" name="client_id" value={c.id} />
		</form>
	{/each}
{/each}

<DefaultCcDialog
	bind:open={defaultCcOpen}
	initial={data.defaultCcEmails}
	errorMessage={defaultCcError}
/>

<ClientFormSheet
	bind:open={clientSheetOpen}
	mode={clientSheetMode}
	initial={clientSheetInitial}
	errorMessage={clientFormError}
/>

<RateFormSheet
	bind:open={rateSheetOpen}
	mode={rateSheetMode}
	clientId={rateSheetClientId}
	clientName={rateSheetClientName}
	initial={rateSheetInitial}
	errorMessage={rateFormError}
/>

<ConfirmDialog
	bind:open={confirmOpen}
	title={confirmTitle}
	description={confirmDescription}
	confirmLabel={confirmConfirmLabel}
	destructive={confirmDestructive}
	pending={pendingConfirm}
	onConfirm={submitConfirm}
/>

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
			<div class="flex flex-wrap items-center gap-2">
				{#if c.activeRate}
					<Badge variant="secondary" class="tabular-nums">{money(c.activeRate.rate)}/hr</Badge>
				{/if}
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="gap-1"
					onclick={() => openEditClient(c)}
				>
					<Pencil class="size-4" /> Edit
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					class="gap-1 text-muted-foreground hover:text-destructive"
					onclick={() => askDeleteClient(c, c.unbilledEntryCount > 0)}
					disabled={c.invoiceCount > 0}
					title={c.invoiceCount > 0
						? 'Client has existing invoices; discard or move them first.'
						: 'Delete client'}
				>
					<Trash2 class="size-4" /> Delete
				</Button>
			</div>
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

		<div class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
			<Button
				type="button"
				variant="ghost"
				size="sm"
				class="-ml-2 h-auto gap-1 px-2 py-1 text-muted-foreground hover:text-foreground"
				onclick={() => toggleExpand(c.id)}
				aria-expanded={expanded.has(c.id)}
				disabled={c.rates.length === 0}
			>
				<ChevronDown
					class={cn('size-4 transition-transform', expanded.has(c.id) && 'rotate-180')}
				/>
				{c.rates.length === 0
					? 'No rates yet'
					: c.rates.length === 1
						? 'Rate history'
						: `Rate history (${c.rates.length})`}
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				class="gap-1"
				onclick={() => openCreateRate(c)}
			>
				<Plus class="size-4" /> Add rate
			</Button>
		</div>

		{#if expanded.has(c.id) && c.rates.length > 0}
			<ul class="mt-2 space-y-2 text-sm">
				{#each c.rates as r (r.id)}
					<li
						class="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 last:border-0"
					>
						<div class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
							<span class="text-muted-foreground">{formatRange(r)}</span>
							<span class="font-medium tabular-nums text-foreground">{money(r.rate)}/hr</span>
							{#if r.service_type}
								<span class="text-xs text-muted-foreground">{r.service_type}</span>
							{/if}
						</div>
						<div class="flex shrink-0 gap-1">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								class="h-8 gap-1 px-2"
								onclick={() => openEditRate(c, r)}
							>
								<Pencil class="size-3.5" />
								<span class="sr-only">Edit rate</span>
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								class="h-8 gap-1 px-2 text-muted-foreground hover:text-destructive"
								onclick={() => askDeleteRate(c, r)}
							>
								<Trash2 class="size-3.5" />
								<span class="sr-only">Delete rate</span>
							</Button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/snippet}

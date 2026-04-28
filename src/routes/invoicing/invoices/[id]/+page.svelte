<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator';
	import type { PageProps } from './$types';
	import type { InvoiceStatus } from '$lib/types/invoicing';

	let { data, form }: PageProps = $props();

	const discardMessage = $derived(
		form && 'message' in form ? (form as { message?: string }).message : undefined
	);

	const sendError = $derived(
		form && 'sendError' in form ? (form as { sendError?: string }).sendError : undefined
	);

	const sendTestError = $derived(
		form && 'sendTestError' in form ? (form as { sendTestError?: string }).sendTestError : undefined
	);

	const markPaidError = $derived(
		form && 'markPaidError' in form ? (form as { markPaidError?: string }).markPaidError : undefined
	);

	const downloadError = $derived(
		form && 'downloadError' in form ? (form as { downloadError?: string }).downloadError : undefined
	);

	let discardPending = $state(false);
	let dialogPending = $state(false);
	let downloadPending = $state(false);
	let markPaidPending = $state(false);
	let sendOpen = $state(false);
	let emailBody = $state('');
	let toEmail = $state('');
	let ccEmails = $state('');
	let bccEmails = $state('');
	/** Shown after a successful test send (cleared when opening the dialog again). */
	let testSentNotice = $state<string | null>(null);

	const inv = $derived(data.invoice);

	function defaultEmailBody(): string {
		return `Please find attached invoice ${inv.invoice_number} for the billing period ${formatPeriod(inv.period_start, inv.period_end)}. Total due: ${money(inv.total)}.`;
	}

	function openSendDialog() {
		emailBody = defaultEmailBody();
		testSentNotice = null;
		toEmail = data.sendDefaults.to;
		ccEmails = data.sendDefaults.cc.join(', ');
		bccEmails = data.sendDefaults.bcc.join(', ');
		sendOpen = true;
	}

	const discardEnhance: SubmitFunction = () => {
		discardPending = true;
		return async ({ update }) => {
			discardPending = false;
			await update();
		};
	};

	const sendDialogEnhance: SubmitFunction = () => {
		dialogPending = true;
		return async ({ result, update }) => {
			dialogPending = false;
			if (result.type === 'success' && result.data && typeof result.data === 'object') {
				const d = result.data as {
					success?: boolean;
					testSent?: boolean;
					testEmail?: string;
				};
				if (d.success) {
					sendOpen = false;
					testSentNotice = null;
				} else if (d.testSent && d.testEmail) {
					testSentNotice = d.testEmail;
				}
			}
			await update();
		};
	};

	const downloadEnhance: SubmitFunction = () => {
		downloadPending = true;
		return async ({ result, update }) => {
			downloadPending = false;
			if (
				result.type === 'success' &&
				result.data &&
				typeof result.data === 'object' &&
				'pdfDownload' in result.data
			) {
				const pd = (result.data as { pdfDownload: { pdf: string; filename: string } }).pdfDownload;
				const bytes = Uint8Array.from(atob(pd.pdf), (c) => c.charCodeAt(0));
				const blob = new Blob([bytes], { type: 'application/pdf' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = pd.filename;
				a.click();
				URL.revokeObjectURL(url);
			}
			await update();
		};
	};

	const markPaidEnhance: SubmitFunction = () => {
		markPaidPending = true;
		return async ({ update }) => {
			markPaidPending = false;
			await update();
		};
	};

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

	function fmtTs(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleString();
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
			<p class="mt-2 text-sm text-muted-foreground">
				Billing period: {formatPeriod(inv.period_start, inv.period_end)}
			</p>
		</div>
		<div class="flex flex-col items-start gap-2 sm:items-end">
			<Badge variant={statusVariant(inv.status)} class="capitalize">{inv.status}</Badge>
			<p class="text-xs text-muted-foreground">
				Created {new Date(inv.created_at).toLocaleString()}
			</p>
			{#if inv.sent_at}
				<p class="text-xs text-muted-foreground">Sent {fmtTs(inv.sent_at)}</p>
			{/if}
			{#if inv.paid_at}
				<p class="text-xs text-muted-foreground">Paid {fmtTs(inv.paid_at)}</p>
			{/if}
			{#if markPaidError}
				<p
					class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
					role="alert"
				>
					{markPaidError}
				</p>
			{/if}
		</div>
	</header>

	<section class="mb-8">
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
			Line items
		</h2>
		<div class="overflow-hidden rounded-xl border border-border">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border bg-muted/40 text-left text-muted-foreground">
						<th class="px-4 py-3 font-medium">Description</th>
						<th class="hidden w-28 px-2 py-3 text-right font-medium sm:table-cell">Start</th>
						<th class="hidden w-28 px-2 py-3 text-right font-medium sm:table-cell">End</th>
						<th class="hidden w-20 px-2 py-3 text-right font-medium md:table-cell">Qty</th>
						<th class="hidden w-28 px-2 py-3 text-right font-medium lg:table-cell">Rate</th>
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
							<td class="hidden px-2 py-3 text-right text-muted-foreground tabular-nums sm:table-cell">
								{line.start_date ?? '—'}
							</td>
							<td class="hidden px-2 py-3 text-right text-muted-foreground tabular-nums sm:table-cell">
								{line.end_date ?? '—'}
							</td>
							<td
								class="hidden px-2 py-3 text-right text-muted-foreground tabular-nums md:table-cell"
							>
								{line.quantity != null ? line.quantity : '—'}
							</td>
							<td
								class="hidden px-2 py-3 text-right text-muted-foreground tabular-nums lg:table-cell"
							>
								{line.unit_price != null ? money(line.unit_price) : '—'}
							</td>
							<td class="px-4 py-3 text-right font-medium text-foreground tabular-nums">
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
			<span class="font-medium tabular-nums">{money(inv.subtotal)}</span>
		</div>
		<Separator />
		<div class="flex justify-between text-base">
			<span class="font-semibold text-foreground">Total</span>
			<span class="font-semibold text-foreground tabular-nums">{money(inv.total)}</span>
		</div>
	</div>

	{#if inv.status !== 'discarded'}
		<form method="POST" action="?/downloadPdf" use:enhance={downloadEnhance} class="mt-6">
			<Button type="submit" variant="outline" class="w-full sm:w-auto" disabled={downloadPending}>
				{downloadPending ? 'Preparing…' : 'Download PDF'}
			</Button>
			{#if downloadError}
				<p class="mt-2 text-sm text-destructive" role="alert">{downloadError}</p>
			{/if}
		</form>
	{/if}

	{#if inv.status === 'draft'}
		<div class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
			<Button type="button" class="w-full sm:w-auto" onclick={openSendDialog}>Send invoice</Button>

			<Dialog.Root bind:open={sendOpen}>
				<Dialog.Content
					class="sm:max-w-lg max-h-[min(90dvh,calc(100dvh-2rem))] overflow-y-auto overscroll-contain"
				>
					<Dialog.Header>
						<Dialog.Title>Send invoice</Dialog.Title>
						<Dialog.Description>
							Review the summary and edit the email message. Use &quot;Send test to myself&quot; to
							verify the PDF and email with Resend&apos;s sandbox sender before sending to the
							client.
						</Dialog.Description>
					</Dialog.Header>
					<div class="space-y-3 py-2">
						<div class="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
							<p class="font-medium text-foreground">{inv.invoice_number}</p>
							<p class="text-muted-foreground">{inv.client_name}</p>
							<p class="mt-1 font-medium text-foreground">{money(inv.total)}</p>
						</div>
						{#if sendError}
							<p
								class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
								role="alert"
							>
								{sendError}
							</p>
						{/if}
						{#if sendTestError}
							<p
								class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
								role="alert"
							>
								{sendTestError}
							</p>
						{/if}
						{#if testSentNotice}
							<p
								class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200"
								role="status"
							>
								Test invoice sent to {testSentNotice}
							</p>
						{/if}
						<form method="POST" use:enhance={sendDialogEnhance} class="space-y-3">
							<div class="space-y-2">
								<Label for="invoice_email_to">To</Label>
								<Input
									id="invoice_email_to"
									name="to"
									type="text"
									autocomplete="email"
									required
									bind:value={toEmail}
									placeholder="client@example.com, other@example.com"
									aria-describedby="invoice_email_to_hint"
								/>
								<p id="invoice_email_to_hint" class="text-xs text-muted-foreground">
									Separate multiple addresses with commas. All recipients will appear on the To line.
								</p>
							</div>
							<div class="space-y-2">
								<Label for="invoice_email_cc">CC</Label>
								<Input
									id="invoice_email_cc"
									name="cc"
									type="text"
									bind:value={ccEmails}
									placeholder="name@example.com, other@example.com"
									aria-describedby="invoice_email_cc_hint"
								/>
								<p id="invoice_email_cc_hint" class="text-xs text-muted-foreground">
									Default CC comes from your profile setting. Separate multiple addresses with commas.
								</p>
							</div>
							<div class="space-y-2">
								<Label for="invoice_email_bcc">BCC</Label>
								<Input
									id="invoice_email_bcc"
									name="bcc"
									type="text"
									bind:value={bccEmails}
									placeholder="Optional"
								/>
							</div>
							<div class="space-y-2">
								<Label for="custom_message">Email message</Label>
								<textarea
									id="custom_message"
									name="custom_message"
									bind:value={emailBody}
									rows={5}
									class="flex min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								></textarea>
							</div>
							<Dialog.Footer class="flex-col gap-2 sm:flex-row sm:justify-end">
								<Button type="button" variant="outline" onclick={() => (sendOpen = false)}
									>Cancel</Button
								>
								<Button
									type="submit"
									formaction="?/sendTest"
									variant="secondary"
									disabled={dialogPending}
								>
									{dialogPending ? 'Sending…' : 'Send test to myself'}
								</Button>
								<Button type="submit" formaction="?/send" disabled={dialogPending}>
									{dialogPending ? 'Sending…' : 'Send to client'}
								</Button>
							</Dialog.Footer>
						</form>
					</div>
				</Dialog.Content>
			</Dialog.Root>

			{#if discardMessage}
				<p
					class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:order-last sm:w-full"
					role="alert"
				>
					{discardMessage}
				</p>
			{/if}
			<form
				method="POST"
				action="?/discard"
				use:enhance={discardEnhance}
				class="w-full sm:ml-auto sm:w-auto"
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

	{#if inv.status === 'sent'}
		<div class="mt-6">
			<form
				method="POST"
				action="?/markPaid"
				use:enhance={markPaidEnhance}
				onsubmit={(e) => {
					if (!confirm('Mark this invoice as paid?')) {
						e.preventDefault();
					}
				}}
			>
				<Button
					type="submit"
					variant="secondary"
					class="w-full sm:w-auto"
					disabled={markPaidPending}
				>
					{markPaidPending ? 'Updating…' : 'Mark as paid'}
				</Button>
			</form>
		</div>
	{/if}

	{#if inv.notes}
		<section class="mt-8">
			<h2 class="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
				Notes
			</h2>
			<p class="text-sm whitespace-pre-wrap text-foreground">{inv.notes}</p>
		</section>
	{/if}
</div>

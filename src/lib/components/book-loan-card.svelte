<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import LoanCheckoutSheet from '$lib/components/loan-checkout-sheet.svelte';
	import LoanReminderSheet from '$lib/components/loan-reminder-sheet.svelte';
	import { formatLoanDate } from '$lib/email/render';
	import type { LoanCardModel } from '$lib/types/loans';

	let {
		loans,
		isOwner,
		bookId = null,
		bookTitle = null,
		owned = true,
		copyCount = 1,
		borrowedTo = null,
		form = null
	}: {
		loans: LoanCardModel[];
		isOwner: boolean;
		bookId?: string | null;
		bookTitle?: string | null;
		owned?: boolean;
		copyCount?: number;
		borrowedTo?: string | null;
		form?: { kind?: string; success?: boolean; message?: string } | null;
	} = $props();

	const checkoutError = $derived(
		form?.kind === 'checkoutBook' && form.success !== true ? (form.message ?? null) : null
	);
	const reminderError = $derived(
		form?.kind === 'updateLoanReminder' && form.success !== true ? (form.message ?? null) : null
	);
	const actionError = $derived(
		form &&
			form.success !== true &&
			form.kind !== 'checkoutBook' &&
			form.kind !== 'updateLoanReminder' &&
			(form.kind === 'returnBook' ||
				form.kind === 'updateLoanInterval' ||
				form.kind === 'updateLoanEmail' ||
				form.kind === 'retryLoanMessage')
			? (form.message ?? null)
			: null
	);

	let checkoutOpen = $state(false);
	let reminderOpen = $state(false);
	let reminderLoanId = $state<string | null>(null);
	let pending = $state(false);

	const roomLeft = $derived(owned && loans.length < copyCount);
	const activeReminder = $derived(loans.find((loan) => loan.id === reminderLoanId)?.reminder ?? null);
</script>

<section class="mt-4 rounded-xl border border-border bg-card p-4">
	<div class="flex items-center justify-between gap-2">
		<h2 class="text-sm font-medium text-foreground">Checked out</h2>
		{#if isOwner && bookId && roomLeft}
			<Button type="button" variant="outline" size="sm" onclick={() => (checkoutOpen = true)}>
				Check out
			</Button>
		{/if}
	</div>

	{#if loans.length === 0 && borrowedTo}
		<p class="mt-2 text-sm text-muted-foreground">On loan to {borrowedTo}</p>
	{:else if loans.length === 0}
		<p class="mt-2 text-sm text-muted-foreground">
			{owned ? 'Nothing is out.' : 'Not in the physical library.'}
		</p>
	{/if}

	{#if actionError}
		<p class="mt-2 text-sm text-destructive" role="alert">{actionError}</p>
	{/if}

	<ul class="mt-3 flex flex-col gap-3">
		{#each loans as loan (loan.id)}
			<li class="rounded-lg border border-border/70 px-3 py-3 text-sm">
				<p class="font-medium text-foreground">
					{#if bookTitle}
						{loan.recipientName}
					{:else}
						<a href="/library/books/{loan.bookId}" class="underline underline-offset-2">
							{loan.bookTitle ?? 'Book'}
						</a>
						<span class="font-normal text-muted-foreground"> · {loan.recipientName}</span>
					{/if}
				</p>
				<p class="mt-1 text-muted-foreground">
					Out since {formatLoanDate(loan.checkedOutOn)}
					{#if isOwner && loan.recipientEmail} · {loan.recipientEmail}{/if}
				</p>
				{#if isOwner}
					{#if loan.checkoutStatus === 'failed'}
						<p class="mt-1 text-destructive">{loan.checkoutError ?? 'Checkout email failed.'}</p>
						<form method="POST" action="?/retryLoanMessage" use:enhance class="mt-2">
							<input type="hidden" name="message_id" value={loan.checkoutMessageId ?? ''} />
							<Button type="submit" variant="outline" size="sm">Retry checkout email</Button>
						</form>
					{/if}
					{#if loan.reminder}
						<p class="mt-2 text-muted-foreground">
							Next reminder {formatLoanDate(loan.reminder.scheduledFor)}
							{#if loan.reminder.status === 'failed'} · failed{/if}
							{#if loan.reminder.status === 'sending'} · sending{/if}
						</p>
						<div class="mt-2 flex flex-wrap gap-2">
							<Button type="button" variant="outline" size="sm" onclick={() => { reminderLoanId = loan.id; reminderOpen = true; }}>
								Edit reminder
							</Button>
							{#if loan.reminder.status === 'failed'}
								<form method="POST" action="?/retryLoanMessage" use:enhance>
									<input type="hidden" name="message_id" value={loan.reminder.id} />
									<Button type="submit" variant="outline" size="sm">Retry</Button>
								</form>
							{/if}
						</div>
					{/if}
					<form
						method="POST"
						action="?/updateLoanInterval"
						use:enhance={() => {
							pending = true;
							return async ({ update }) => {
								pending = false;
								await update();
							};
						}}
						class="mt-3 flex items-end gap-2"
					>
						<input type="hidden" name="loan_id" value={loan.id} />
						<div class="flex flex-col gap-1">
							<Label for="interval-{loan.id}">Repeat every</Label>
							<Input
								id="interval-{loan.id}"
								name="interval_days"
								type="number"
								min="1"
								max="366"
								value={loan.intervalDays}
								class="w-24"
							/>
						</div>
						<Button type="submit" variant="outline" size="sm" disabled={pending}>Days</Button>
					</form>
					<form
						method="POST"
						action="?/updateLoanEmail"
						use:enhance
						class="mt-2 flex items-end gap-2"
					>
						<input type="hidden" name="loan_id" value={loan.id} />
						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<Label for="email-{loan.id}">Send to</Label>
							<Input id="email-{loan.id}" name="recipient_email" type="email" value={loan.recipientEmail} />
						</div>
						<Button type="submit" variant="outline" size="sm">Save</Button>
					</form>
					<form method="POST" action="?/returnBook" use:enhance class="mt-3">
						<input type="hidden" name="loan_id" value={loan.id} />
						<Button type="submit" variant="outline" size="sm" class="text-destructive">Mark returned</Button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
</section>

{#if bookId}
	<LoanCheckoutSheet bind:open={checkoutOpen} {bookId} errorMessage={checkoutError} />
{/if}
<LoanReminderSheet bind:open={reminderOpen} reminder={activeReminder} errorMessage={reminderError} />

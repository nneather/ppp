<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { formatYmdShortChicago } from '$lib/invoicing/chicago-date';
	import type { LastWeekInvoiceCandidate } from '$lib/types/invoicing';

	type Props = {
		candidates: LastWeekInvoiceCandidate[];
	};

	let { candidates }: Props = $props();

	let pendingClientId = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	function entryLabel(count: number): string {
		return count === 1 ? '1 entry' : `${count} entries`;
	}

	function periodLabel(start: string, end: string): string {
		return `${formatYmdShortChicago(start)} – ${formatYmdShortChicago(end)}`;
	}

	function submitEnhance(clientId: string): SubmitFunction {
		return () => {
			pendingClientId = clientId;
			errorMessage = null;
			return async ({ result, update }) => {
				pendingClientId = null;
				if (result.type === 'failure') {
					const data = result.data as { message?: string } | undefined;
					errorMessage = data?.message ?? 'Could not generate invoice.';
					return;
				}
				await update();
			};
		};
	}
</script>

<div class="space-y-3 border-t border-border px-5 pt-3 pb-4">
	{#each candidates as candidate (candidate.clientId)}
		<form
			method="POST"
			action="/invoicing/invoices?/generate"
			use:enhance={submitEnhance(candidate.clientId)}
			class="space-y-2"
		>
			<input type="hidden" name="client_id" value={candidate.clientId} />
			<input type="hidden" name="period_start" value={candidate.periodStart} />
			<input type="hidden" name="period_end" value={candidate.periodEnd} />
			<p class="text-xs text-muted-foreground">
				{candidate.clientName} · {entryLabel(candidate.entryCount)} · {candidate.hours} h ·
				{periodLabel(candidate.periodStart, candidate.periodEnd)}
			</p>
			<Button
				type="submit"
				class="w-full"
				hotkey="g"
				label={pendingClientId === candidate.clientId
					? 'Generating…'
					: "Generate last week's invoice"}
				disabled={pendingClientId != null}
			/>
		</form>
	{/each}
	{#if errorMessage}
		<p class="text-sm text-destructive">{errorMessage}</p>
	{/if}
</div>

<script lang="ts">
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import { Button } from '$lib/components/ui/button';
	import { PROPOSAL_FIELDS } from '$lib/types/library';
	import type { ProposalField, ReviewProposal } from '$lib/types/library';

	/**
	 * "Proposed fixes" panel on the review card when the book has a pending
	 * AI research proposal. Per-field current → proposed rows with Apply
	 * buttons that fill the card's quick-edit state; Apply all fills every
	 * field; Dismiss rejects the proposal without touching the book. The
	 * confirm itself stays on the card's normal Save — a proposal never
	 * clears `needs_review` on its own.
	 */
	let {
		proposal,
		applied,
		disabled = false,
		onApplyField,
		onApplyAll,
		onDismiss
	}: {
		proposal: ReviewProposal;
		/** Fields whose proposed value is currently reflected in the edit state. */
		applied: Set<ProposalField>;
		disabled?: boolean;
		onApplyField: (field: ProposalField) => void;
		onApplyAll: () => void;
		onDismiss: () => void;
	} = $props();

	const FIELD_LABELS: Record<ProposalField, string> = {
		genre: 'Genre',
		year: 'Year',
		publisher: 'Publisher',
		publisher_location: 'Publisher location'
	};

	const rows = $derived(
		PROPOSAL_FIELDS.flatMap((field) => {
			const diff = proposal.fields[field];
			return diff ? [{ field, diff }] : [];
		})
	);

	const allApplied = $derived(rows.length > 0 && rows.every((r) => applied.has(r.field)));
</script>

<div class="mt-3 rounded-xl border border-violet-500/40 bg-violet-500/5 p-3">
	<div class="flex items-center gap-1.5 text-xs font-semibold text-violet-900 dark:text-violet-200">
		<Sparkles class="size-3.5" />
		Proposed fixes
		<span class="font-normal text-muted-foreground">
			· {proposal.source === 'openlibrary'
				? 'Open Library'
				: proposal.source === 'ai-genre'
					? 'AI genre'
					: 'Open Library + AI'}
		</span>
	</div>

	<ul class="mt-2 flex flex-col gap-1.5">
		{#each rows as row (row.field)}
			{@const isApplied = applied.has(row.field)}
			<li class="flex items-center gap-2 text-xs">
				<div class="min-w-0 flex-1">
					<span class="font-medium text-muted-foreground">{FIELD_LABELS[row.field]}:</span>
					{#if row.diff.current != null && row.diff.current !== ''}
						<span class="text-muted-foreground line-through">{row.diff.current}</span>
						<span class="mx-0.5 text-muted-foreground">→</span>
					{/if}
					<span class="font-medium text-foreground">{row.diff.proposed}</span>
					{#if row.diff.note}
						<span class="block truncate text-[10px] text-muted-foreground" title={row.diff.note}>
							{row.diff.note}
						</span>
					{/if}
				</div>
				<button
					type="button"
					disabled={disabled || isApplied}
					class={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-60 ${
						isApplied
							? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
							: 'border-violet-500/50 bg-background text-violet-800 hover:bg-violet-500/10 dark:text-violet-200'
					}`}
					onclick={() => onApplyField(row.field)}
				>
					{isApplied ? 'Applied' : 'Apply'}
				</button>
			</li>
		{/each}
	</ul>

	<div class="mt-2.5 flex items-center gap-2">
		{#if rows.length > 1}
			<Button
				type="button"
				variant="outline"
				size="sm"
				class="h-7 text-xs"
				disabled={disabled || allApplied}
				onclick={onApplyAll}
			>
				Apply all
			</Button>
		{/if}
		<button
			type="button"
			{disabled}
			class="ml-auto text-[11px] text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
			onclick={onDismiss}
		>
			Dismiss proposal
		</button>
	</div>
</div>

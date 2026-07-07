<script lang="ts">
	import type { ReviewDeckKey } from '$lib/library/review-decks';

	/**
	 * Deck picker rail for `/library/review` — horizontal scroll of deck cards
	 * with live counts. Replaces the old flat slice-pill row. The host page
	 * owns routing (URL is the source of truth) via `onSelect`.
	 */
	type DeckView = {
		key: ReviewDeckKey;
		label: string;
		hint: string;
		count: number;
	};

	let {
		decks,
		activeKey,
		onSelect
	}: {
		decks: DeckView[];
		activeKey: ReviewDeckKey | null;
		onSelect: (key: ReviewDeckKey) => void;
	} = $props();
</script>

<div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Review decks">
	{#each decks as deck (deck.key)}
		{@const active = deck.key === activeKey}
		<button
			type="button"
			role="tab"
			aria-selected={active}
			class={`flex min-w-28 shrink-0 flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors ${
				active
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-border bg-card text-card-foreground hover:bg-muted'
			}`}
			onclick={() => onSelect(deck.key)}
		>
			<span class="flex w-full items-baseline justify-between gap-2">
				<span class="text-xs font-semibold whitespace-nowrap">{deck.label}</span>
				<span
					class={`rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
						active ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
					}`}
				>
					{deck.count.toLocaleString()}
				</span>
			</span>
			<span
				class={`text-[10px] whitespace-nowrap ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
			>
				{deck.hint}
			</span>
		</button>
	{/each}
</div>

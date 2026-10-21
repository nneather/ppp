<script lang="ts">
	import { browser } from '$app/environment';
	import SystematicPassageCard from '$lib/components/systematic-passage-card.svelte';
	import type { SystematicSetBlock } from '$lib/library/outline';
	import {
		dismissedSystematicCount,
		systematicDisplayCards
	} from '$lib/studies/systematics-cards';
	import {
		loadDismissedSystematicRefs,
		saveDismissedSystematicRefs
	} from '$lib/studies/systematics-dismiss';
	import { cn } from '$lib/utils.js';

	let {
		blocks,
		parentField = null,
		parentId = null,
		attachedBookIds = []
	}: {
		blocks: SystematicSetBlock[];
		/** When set with parentId, show Attach → `?/addPaperSource`. */
		parentField?: 'paper_id' | 'sermon_id' | null;
		parentId?: string | null;
		attachedBookIds?: string[];
	} = $props();

	let sort = $state<'systematic' | 'verse'>('systematic');
	let showDismissed = $state(false);
	let dismissed = $state<Set<string>>(new Set());

	$effect(() => {
		const id = parentId;
		showDismissed = false;
		if (!browser || !id) {
			dismissed = new Set();
			return;
		}
		dismissed = loadDismissedSystematicRefs(id);
	});

	function persist(next: Set<string>) {
		dismissed = next;
		if (browser && parentId) saveDismissedSystematicRefs(parentId, next);
	}

	function dismissRef(refId: string) {
		const next = new Set(dismissed);
		next.add(refId);
		persist(next);
	}

	function restoreRef(refId: string) {
		const next = new Set(dismissed);
		next.delete(refId);
		persist(next);
	}

	const dismissedCount = $derived(dismissedSystematicCount(blocks, dismissed));
	const cards = $derived(systematicDisplayCards(blocks, sort, dismissed, showDismissed));

	const sorts = [
		{ id: 'systematic' as const, label: 'By systematic' },
		{ id: 'verse' as const, label: 'By verse' }
	];
</script>

{#if blocks.length === 0}
	<p class="text-sm text-muted-foreground">No systematic theology index hits for this passage.</p>
{:else}
	<div class="mb-3 flex flex-wrap items-center gap-2">
		<div
			class="flex w-fit rounded-lg border border-border bg-muted/40 p-0.5"
			role="group"
			aria-label="Sort systematic theologies"
		>
			{#each sorts as option (option.id)}
				<button
					type="button"
					class={cn(
						'min-h-9 rounded-md px-3 text-xs font-medium transition-colors',
						sort === option.id
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground'
					)}
					aria-pressed={sort === option.id}
					onclick={() => (sort = option.id)}
				>
					{option.label}
				</button>
			{/each}
		</div>
		{#if dismissedCount > 0}
			<button
				type="button"
				class="min-h-9 rounded-md px-2 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
				aria-pressed={showDismissed}
				onclick={() => (showDismissed = !showDismissed)}
			>
				{showDismissed ? 'Hide dismissed' : `Show dismissed (${dismissedCount})`}
			</button>
		{/if}
	</div>
	{#if cards.length === 0}
		<p class="text-sm text-muted-foreground">All hits dismissed.</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each cards as card (card.key)}
				<li>
					<SystematicPassageCard
						title={card.title}
						meta={card.meta}
						span={card.span}
						rows={card.rows}
						{parentField}
						{parentId}
						{attachedBookIds}
						onDismiss={dismissRef}
						onRestore={restoreRef}
					/>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

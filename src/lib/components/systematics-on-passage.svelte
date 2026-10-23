<script lang="ts">
	import { browser } from '$app/environment';
	import SystematicPassageCard from '$lib/components/systematic-passage-card.svelte';
	import type { SystematicSetBlock } from '$lib/library/outline';
	import type { SystematicCardModel } from '$lib/studies/systematics-cards';
	import {
		dismissedSystematicCount,
		systematicDisplayCards
	} from '$lib/studies/systematics-cards';
	import {
		loadDismissedSystematicRefs,
		saveDismissedSystematicRefs
	} from '$lib/studies/systematics-dismiss';
	import {
		loadUsingSystematicRefs,
		saveUsingSystematicRefs
	} from '$lib/studies/systematics-using';
	import { cn } from '$lib/utils.js';

	let {
		blocks,
		passage = null,
		parentField = null,
		parentId = null
	}: {
		blocks: SystematicSetBlock[];
		passage?: {
			bibleBook: string;
			chapter: number | null;
			verse: number | null;
			chapterEnd: number | null;
			verseEnd: number | null;
		} | null;
		/** When set with parentId, Attach marks that one hit in use on this study. */
		parentField?: 'paper_id' | 'sermon_id' | null;
		parentId?: string | null;
	} = $props();

	let sort = $state<'systematic' | 'verse'>('systematic');
	let showDismissed = $state(false);
	let dismissed = $state<Set<string>>(new Set());
	let using = $state<Set<string>>(new Set());
	let loadedBlocks = $state<SystematicSetBlock[] | null>(null);
	let loadingKey = $state<string | null>(null);

	const viewBlocks = $derived(loadedBlocks ?? blocks);

	$effect(() => {
		blocks;
		loadedBlocks = null;
		sort = 'systematic';
	});

	$effect(() => {
		const id = parentId;
		showDismissed = false;
		if (!browser || !id) {
			dismissed = new Set();
			using = new Set();
			return;
		}
		dismissed = loadDismissedSystematicRefs(id);
		using = loadUsingSystematicRefs(id);
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

	function persistUsing(next: Set<string>) {
		using = next;
		if (browser && parentId) saveUsingSystematicRefs(parentId, next);
	}

	function attachRef(refId: string) {
		const next = new Set(using);
		next.add(refId);
		persistUsing(next);
	}

	function detachRef(refId: string) {
		const next = new Set(using);
		next.delete(refId);
		persistUsing(next);
	}

	async function loadPointers(card: SystematicCardModel | null, full: boolean) {
		if (!passage) return;
		const key = full ? '__all__' : (card?.key ?? '__all__');
		if (loadingKey === key) return;
		loadingKey = key;
		const params = new URLSearchParams({ bible_book: passage.bibleBook, full: '1' });
		if (passage.chapter != null) params.set('chapter', String(passage.chapter));
		if (passage.verse != null) params.set('verse', String(passage.verse));
		if (passage.chapterEnd != null) params.set('chapter_end', String(passage.chapterEnd));
		if (passage.verseEnd != null) params.set('verse_end', String(passage.verseEnd));
		if (!full && card?.seriesId) params.set('series_id', card.seriesId);
		else if (!full && card?.bookId) params.set('book_id', card.bookId);
		try {
			const res = await fetch(`/library/systematics.json?${params}`);
			if (!res.ok) return;
			const body = (await res.json()) as { blocks?: SystematicSetBlock[] };
			const incoming = body.blocks ?? [];
			if (full || !card) {
				loadedBlocks = incoming;
				return;
			}
			const match = incoming[0];
			if (!match) return;
			loadedBlocks = viewBlocks.map((block) =>
				(block.seriesId ?? block.bookId ?? block.seriesName) === card.key ? match : block
			);
		} finally {
			if (loadingKey === key) loadingKey = null;
		}
	}

	function chooseSort(next: 'systematic' | 'verse') {
		sort = next;
		if (next === 'verse' && viewBlocks.some((block) => block.deferred)) {
			void loadPointers(null, true);
		}
	}

	const dismissedCount = $derived(dismissedSystematicCount(viewBlocks, dismissed));
	const cards = $derived(systematicDisplayCards(viewBlocks, sort, dismissed, showDismissed));

	const sorts = [
		{ id: 'systematic' as const, label: 'By systematic' },
		{ id: 'verse' as const, label: 'By verse' }
	];
</script>

{#if viewBlocks.length === 0}
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
					onclick={() => chooseSort(option.id)}
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
						hitCount={card.hitCount}
						loading={loadingKey === card.key || (sort === 'verse' && loadingKey === '__all__')}
						{parentField}
						{parentId}
						usingRefIds={[...using]}
						onAttach={attachRef}
						onDetach={detachRef}
						onDismiss={dismissRef}
						onRestore={restoreRef}
						onOpen={() => {
							if (card.deferred) void loadPointers(card, false);
						}}
					/>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

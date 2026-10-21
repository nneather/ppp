<script lang="ts">
	import SystematicPassageCard, {
		type SystematicPassageHit
	} from '$lib/components/systematic-passage-card.svelte';
	import { groupSystematicPointersByVerse, type SystematicSetBlock } from '$lib/library/outline';
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
	const verseGroups = $derived(groupSystematicPointersByVerse(blocks));

	const cards = $derived(
		sort === 'systematic'
			? blocks.map((block) => ({
					key: block.seriesId ?? block.seriesName,
					title: block.seriesName,
					meta: block.authorLabel,
					span: block.verseSpan,
					rows: block.pointers.map(
						(p): SystematicPassageHit => ({
							key: p.refId,
							bookId: p.bookId,
							refId: p.refId,
							display: p.display,
							verseLabel: p.verseLabel,
							seriesName: null,
							authorLabel: null
						})
					)
				}))
			: verseGroups.map((group) => ({
					key: group.verseLabel,
					title: group.verseLabel,
					meta: null,
					span: null,
					rows: group.rows.map(
						(row): SystematicPassageHit => ({
							key: row.refId,
							bookId: row.bookId,
							refId: row.refId,
							display: row.display,
							verseLabel: null,
							seriesName: row.seriesName,
							authorLabel: row.authorLabel
						})
					)
				}))
	);

	const sorts = [
		{ id: 'systematic' as const, label: 'By systematic' },
		{ id: 'verse' as const, label: 'By verse' }
	];
</script>

{#if blocks.length === 0}
	<p class="text-sm text-muted-foreground">No systematic theology index hits for this passage.</p>
{:else}
	<div
		class="mb-3 flex w-fit rounded-lg border border-border bg-muted/40 p-0.5"
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
				/>
			</li>
		{/each}
	</ul>
{/if}

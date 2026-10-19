<script lang="ts">
	import type { SystematicSetBlock } from '$lib/library/outline';

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

	const attached = $derived(new Set(attachedBookIds));
	const canAttach = $derived(Boolean(parentField && parentId));
</script>

{#if blocks.length === 0}
	<p class="text-sm text-muted-foreground">No systematic theology index hits for this passage.</p>
{:else}
	<ul class="flex flex-col gap-4">
		{#each blocks as block (block.seriesId ?? block.seriesName)}
			<li class="rounded-lg border border-border bg-card px-4 py-3">
				<div class="min-w-0">
					<p class="text-base font-medium leading-snug text-foreground sm:text-sm">
						{block.seriesName}
					</p>
					{#if block.authorLabel}
						<p class="mt-0.5 text-sm text-muted-foreground sm:text-xs">{block.authorLabel}</p>
					{/if}
				</div>
				<ul class="mt-2 space-y-1.5">
					{#each block.pointers as p (p.refId)}
						<li class="flex flex-wrap items-baseline justify-between gap-2 text-sm sm:text-xs">
							<a
								href={`/library/books/${p.bookId}#ref-${p.refId}`}
								class="min-w-0 font-medium text-foreground underline-offset-2 hover:underline"
							>
								{p.display}
							</a>
							{#if canAttach}
								{#if attached.has(p.bookId)}
									<span class="shrink-0 text-xs text-muted-foreground">Attached</span>
								{:else}
									<form method="POST" action="?/addPaperSource" class="shrink-0">
										<input type="hidden" name={parentField!} value={parentId!} />
										<input type="hidden" name="book_id" value={p.bookId} />
										<button
											type="submit"
											class="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
										>
											Attach
										</button>
									</form>
								{/if}
							{/if}
						</li>
					{/each}
				</ul>
			</li>
		{/each}
	</ul>
{/if}

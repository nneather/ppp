<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import type { SystematicPointer } from '$lib/library/outline';
	import { cn } from '$lib/utils.js';

	export type SystematicPassageHit = {
		key: string;
		bookId: string;
		refId: string;
		display: string;
		verseLabel: string | null;
		seriesName: string | null;
		authorLabel: string | null;
	};

	let {
		title,
		meta = null,
		span = null,
		rows,
		parentField = null,
		parentId = null,
		attachedBookIds = []
	}: {
		title: string;
		meta?: string | null;
		span?: string | null;
		rows: SystematicPassageHit[];
		parentField?: 'paper_id' | 'sermon_id' | null;
		parentId?: string | null;
		attachedBookIds?: string[];
	} = $props();

	const attached = $derived(new Set(attachedBookIds));
	const canAttach = $derived(Boolean(parentField && parentId));
</script>

{#snippet attach(bookId: string)}
	{#if canAttach}
		{#if attached.has(bookId)}
			<span class="shrink-0 text-xs text-muted-foreground">Attached</span>
		{:else}
			<form method="POST" action="?/addPaperSource" class="shrink-0">
				<input type="hidden" name={parentField!} value={parentId!} />
				<input type="hidden" name="book_id" value={bookId} />
				<button
					type="submit"
					class="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
				>
					Attach
				</button>
			</form>
		{/if}
	{/if}
{/snippet}

{#snippet locator(p: Pick<SystematicPointer, 'bookId' | 'refId' | 'display'>)}
	<a
		href={`/library/books/${p.bookId}#ref-${p.refId}`}
		class="min-w-0 font-medium text-foreground underline-offset-2 hover:underline"
	>
		{p.display}
	</a>
{/snippet}

<details class="group rounded-lg border border-border bg-card">
	<summary
		class="flex cursor-pointer list-none items-start gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden"
	>
		<ChevronDown
			class="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
			aria-hidden="true"
		/>
		<span class="min-w-0 flex-1">
			<span
				class={cn(
					'block text-base font-medium leading-snug text-foreground sm:text-sm',
					span == null && 'tabular-nums'
				)}>{title}</span>
			{#if meta}
				<span class="mt-0.5 block text-sm text-muted-foreground sm:text-xs">{meta}</span>
			{/if}
		</span>
		<span class="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
			{#if span}
				<span class="block font-medium text-foreground">{span}</span>
			{/if}
			<span>{rows.length} {rows.length === 1 ? 'hit' : 'hits'}</span>
		</span>
	</summary>
	<ul class="space-y-1.5 border-t border-border px-4 py-3">
		{#each rows as row (row.key)}
			<li class="flex flex-wrap items-baseline justify-between gap-2 text-sm sm:text-xs">
				<span class="min-w-0">
					{#if row.seriesName}
						<span class="block">
							<span class="font-medium text-foreground">{row.seriesName}</span>
							{#if row.authorLabel}
								<span class="text-muted-foreground"> · {row.authorLabel}</span>
							{/if}
						</span>
					{/if}
					<span class="flex min-w-0 items-baseline gap-2">
						{#if row.verseLabel}
							<span class="shrink-0 tabular-nums text-muted-foreground">{row.verseLabel}</span>
						{/if}
						{@render locator(row)}
					</span>
				</span>
				{@render attach(row.bookId)}
			</li>
		{/each}
	</ul>
</details>

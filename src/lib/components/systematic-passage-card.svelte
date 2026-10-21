<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { Button } from '$lib/components/ui/button';
	import type { SystematicPointer } from '$lib/library/outline';
	import type { SystematicPassageHit } from '$lib/studies/systematics-cards';
	import { cn } from '$lib/utils.js';

	export type { SystematicPassageHit };

	let {
		title,
		meta = null,
		span = null,
		rows,
		parentField = null,
		parentId = null,
		attachedBookIds = [],
		onDismiss,
		onRestore
	}: {
		title: string;
		meta?: string | null;
		span?: string | null;
		rows: SystematicPassageHit[];
		parentField?: 'paper_id' | 'sermon_id' | null;
		parentId?: string | null;
		attachedBookIds?: string[];
		onDismiss?: (refId: string) => void;
		onRestore?: (refId: string) => void;
	} = $props();

	const attached = $derived(new Set(attachedBookIds));
	const canAttach = $derived(Boolean(parentField && parentId));
</script>

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
	<ul class="divide-y divide-border/70 border-t border-border">
		{#each rows as row (row.key)}
			<li class={cn('flex items-start gap-3 px-4 py-3', row.dismissed && 'bg-muted/40')}>
				<div class="min-w-0 flex-1 text-sm sm:text-xs">
					{#if row.seriesName}
						<p>
							<span class="font-medium text-foreground">{row.seriesName}</span>
							{#if row.authorLabel}
								<span class="text-muted-foreground"> · {row.authorLabel}</span>
							{/if}
						</p>
					{/if}
					<p class="flex min-w-0 items-baseline gap-2">
						{#if row.verseLabel}
							<span class="shrink-0 tabular-nums text-muted-foreground">{row.verseLabel}</span>
						{/if}
						{@render locator(row)}
					</p>
				</div>
				<div class="flex w-24 shrink-0 flex-col gap-1">
					{#if canAttach}
						{#if attached.has(row.bookId)}
							<span
								class="inline-flex h-7 items-center justify-center rounded-md border border-border text-xs text-muted-foreground"
							>
								Attached
							</span>
						{:else}
							<form method="POST" action="?/addPaperSource" class="w-full">
								<input type="hidden" name={parentField!} value={parentId!} />
								<input type="hidden" name="book_id" value={row.bookId} />
								<Button type="submit" variant="outline" size="sm" class="w-full" label="Attach" />
							</form>
						{/if}
					{/if}
					{#if row.dismissed}
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="w-full"
							label="Restore"
							onclick={() => onRestore?.(row.refId)}
						/>
					{:else}
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="w-full"
							label="Dismiss"
							onclick={() => onDismiss?.(row.refId)}
						/>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
</details>

<script lang="ts">
	import { browser } from '$app/environment';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Image from '@lucide/svelte/icons/image';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '$lib/components/ui/button';
	import ScriptureIndexRow from '$lib/components/scripture-index-row.svelte';
	import {
		aggregateScriptureCounts,
		shouldUseInlineList,
		type BibleBookTally,
		type ScriptureCountRow,
		type ScriptureIndexScope
	} from '$lib/library/scripture-index';
	import type {
		ScriptureImageThumb,
		ScriptureIndexRefRow
	} from '$lib/library/server/scripture-index-loaders';
	import { cn } from '$lib/utils.js';

	let {
		bookId,
		manageHref,
		counts,
		countsLoading = false,
		setVolumeCount = 1,
		images = [],
		open = $bindable(false),
		addOpen = $bindable(false),
		scope = $bindable<'volume' | 'set'>('volume'),
		onOpenBook,
		onEdit,
		onDelete,
		children
	}: {
		bookId: string;
		manageHref: string;
		counts: ScriptureCountRow[];
		countsLoading?: boolean;
		/** Live volumes in the series (1 = no Whole set toggle). */
		setVolumeCount?: number;
		images?: ScriptureImageThumb[];
		open?: boolean;
		addOpen?: boolean;
		scope?: ScriptureIndexScope;
		onOpenBook?: (bibleBook: string, tally: BibleBookTally) => void;
		onEdit?: (id: string) => void;
		onDelete?: (id: string) => void;
		children?: import('svelte').Snippet;
	} = $props();

	let recordedImagesOpen = $state(false);
	let inlineRows = $state<ScriptureIndexRefRow[]>([]);
	let inlineLoading = $state(false);
	let inlineToken = 0;

	const volumeIds = $derived(
		[...new Set(counts.map((c) => c.book_id))].filter(Boolean)
	);

	const scopeIds = $derived.by(() => {
		if (scope === 'set') return volumeIds.length ? volumeIds : [bookId];
		return [bookId];
	});

	const tallies = $derived(aggregateScriptureCounts(counts, new Set(scopeIds)));
	const useInline = $derived(shouldUseInlineList(tallies.total));
	const showSetToggle = $derived(setVolumeCount >= 2);

	// Group inline rows by bible book for the small-book list.
	const inlineGroups = $derived.by(() => {
		const map = new Map<string, ScriptureIndexRefRow[]>();
		for (const r of inlineRows) {
			const list = map.get(r.bible_book) ?? [];
			list.push(r);
			map.set(r.bible_book, list);
		}
		return tallies.books
			.map((b) => ({ bible_book: b.bible_book, rows: map.get(b.bible_book) ?? [] }))
			.filter((g) => g.rows.length > 0);
	});

	$effect(() => {
		if (!browser || !open || !useInline || tallies.total === 0) {
			inlineRows = [];
			return;
		}
		const token = ++inlineToken;
		inlineLoading = true;
		const params = new URLSearchParams();
		params.set('inline', '1');
		params.set('scope', scope);
		params.set('limit', '200');
		void fetch(`/library/books/${bookId}/scripture-refs.json?${params}`)
			.then(async (res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return (await res.json()) as { rows: ScriptureIndexRefRow[] };
			})
			.then((data) => {
				if (token !== inlineToken) return;
				inlineRows = data.rows ?? [];
			})
			.catch(() => {
				if (token !== inlineToken) return;
				inlineRows = [];
			})
			.finally(() => {
				if (token === inlineToken) inlineLoading = false;
			});
	});
</script>

<details
	class="mt-10 rounded-lg border border-border bg-card text-card-foreground shadow-sm"
	bind:open
>
	<summary
		class="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden"
	>
		<span
			id="scripture-refs-heading"
			class="text-lg font-semibold tracking-tight text-foreground"
		>
			Scripture references
			{#if !countsLoading && tallies.total > 0}
				<span class="ml-1 text-sm font-normal text-muted-foreground">
					({tallies.total.toLocaleString()}{#if tallies.bibleBookCount > 0}
						· {tallies.bibleBookCount} book{tallies.bibleBookCount === 1 ? '' : 's'}{/if})
				</span>
			{/if}
		</span>
		<ChevronDown
			class={cn(
				'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
				open && 'rotate-180'
			)}
			aria-hidden="true"
		/>
	</summary>
	<div class="border-t border-border px-4 pb-4 pt-3">
		<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
			<div class="flex flex-wrap items-center gap-2">
				{#if showSetToggle}
					<div
						class="inline-flex rounded-md border border-border p-0.5 text-xs"
						role="group"
						aria-label="Index scope"
					>
						<button
							type="button"
							class={cn(
								'rounded px-2.5 py-1 font-medium transition-colors',
								scope === 'volume'
									? 'bg-foreground text-background'
									: 'text-muted-foreground hover:text-foreground'
							)}
							onclick={() => (scope = 'volume')}
						>
							This volume
						</button>
						<button
							type="button"
							class={cn(
								'rounded px-2.5 py-1 font-medium transition-colors',
								scope === 'set'
									? 'bg-foreground text-background'
									: 'text-muted-foreground hover:text-foreground'
							)}
							onclick={() => (scope = 'set')}
						>
							Whole set
						</button>
					</div>
				{/if}
				{#if tallies.total > 0}
					<a
						href={manageHref}
						class="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
					>
						Manage all
					</a>
				{/if}
			</div>
			{#if !addOpen}
				<Button
					type="button"
					variant="outline"
					size="sm"
					onclick={() => (addOpen = true)}
				>
					<Plus class="size-4" /> Add references
				</Button>
			{/if}
		</div>

		{#if countsLoading}
			<p class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
				Loading scripture references…
			</p>
		{:else if tallies.total === 0 && !addOpen}
			<p
				class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
			>
				No scripture references yet. Click
				<strong class="font-semibold text-foreground">Add references</strong>
				to log a passage you found discussed in this book.
			</p>
		{:else if useInline}
			{#if inlineLoading}
				<p class="py-6 text-center text-sm text-muted-foreground">Loading…</p>
			{:else}
				<div class="space-y-5">
					{#each inlineGroups as group (group.bible_book)}
						<div>
							<h3
								class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
							>
								{group.bible_book}
							</h3>
							<ul
								class="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-card text-sm"
							>
								{#each group.rows as row (row.id)}
									<ScriptureIndexRow
										ref={row}
										showVolume={scope === 'set'}
										onEdit={onEdit}
										onDelete={onDelete}
									/>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<div class="space-y-4">
				{#if tallies.ot.length > 0}
					<div>
						<p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
							Old Testament
						</p>
						<div class="flex flex-wrap gap-1.5">
							{#each tallies.ot as b (b.bible_book)}
								<button
									type="button"
									class="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted"
									onclick={() => onOpenBook?.(b.bible_book, b)}
								>
									<span class="font-medium text-foreground">{b.bible_book}</span>
									<span class="ml-1 tabular-nums text-muted-foreground">{b.count}</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
				{#if tallies.nt.length > 0}
					<div>
						<p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
							New Testament
						</p>
						<div class="flex flex-wrap gap-1.5">
							{#each tallies.nt as b (b.bible_book)}
								<button
									type="button"
									class="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted"
									onclick={() => onOpenBook?.(b.bible_book, b)}
								>
									<span class="font-medium text-foreground">{b.bible_book}</span>
									<span class="ml-1 tabular-nums text-muted-foreground">{b.count}</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
				{#if tallies.apocrypha.length > 0}
					<div>
						<p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
							Apocrypha
						</p>
						<div class="flex flex-wrap gap-1.5">
							{#each tallies.apocrypha as b (b.bible_book)}
								<button
									type="button"
									class="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted"
									onclick={() => onOpenBook?.(b.bible_book, b)}
								>
									<span class="font-medium text-foreground">{b.bible_book}</span>
									<span class="ml-1 tabular-nums text-muted-foreground">{b.count}</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
				{#if tallies.other.length > 0}
					<div>
						<p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
							Other
						</p>
						<div class="flex flex-wrap gap-1.5">
							{#each tallies.other as b (b.bible_book)}
								<button
									type="button"
									class="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted"
									onclick={() => onOpenBook?.(b.bible_book, b)}
								>
									<span class="font-medium text-foreground">{b.bible_book}</span>
									<span class="ml-1 tabular-nums text-muted-foreground">{b.count}</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		{#if open && images.length > 0}
			<details
				class="mt-4 rounded-lg border border-border/60 bg-muted/20"
				bind:open={recordedImagesOpen}
			>
				<summary
					class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden"
				>
					<Image class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					See recorded images ({images.length})
					<ChevronDown
						class={cn(
							'ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200',
							recordedImagesOpen && 'rotate-180'
						)}
						aria-hidden="true"
					/>
				</summary>
				<div class="flex flex-wrap gap-2 border-t border-border/40 p-3">
					{#each images as img (img.source_image_url)}
						<a
							href={img.source_image_signed_url}
							target="_blank"
							rel="noopener noreferrer"
							class="group/img relative"
							title={`${img.refCount} ref${img.refCount === 1 ? '' : 's'}`}
						>
							<img
								src={img.source_image_signed_url}
								alt=""
								loading="lazy"
								class="size-28 rounded-md border border-border object-cover transition-transform group-hover/img:scale-105"
							/>
							{#if img.refCount > 1}
								<span
									class="absolute right-1 bottom-1 rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground"
								>
									{img.refCount}
								</span>
							{/if}
						</a>
					{/each}
				</div>
			</details>
		{/if}

		{#if children}
			{@render children()}
		{/if}
	</div>
</details>

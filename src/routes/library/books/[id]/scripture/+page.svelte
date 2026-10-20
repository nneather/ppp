<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/page-header.svelte';
	import ScriptureIndexTable from '$lib/components/scripture-index-table.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label';
	import {
		SCRIPTURE_INDEX_MANAGE_PAGE_SIZE,
		scriptureManageFiltersToSearchParams,
		type ScriptureManageFilters
	} from '$lib/library/scripture-index';
	import type { PageProps } from './$types';
	import { cn } from '$lib/utils.js';

	let { data }: PageProps = $props();

	const bookInvalidateKey = $derived(`app:library:book:${data.book.id}`);

	let bibleBook = $state('');
	let chapter = $state('');
	let passage = $state('');
	let pageFilter = $state('');
	let needsReview = $state('');
	let scope = $state<'volume' | 'set'>('volume');

	$effect(() => {
		const f = data.filters;
		bibleBook = f.bibleBook ?? '';
		chapter = f.chapter != null ? String(f.chapter) : '';
		passage = f.passage ?? '';
		pageFilter = f.page ?? '';
		needsReview = f.needsReview === true ? '1' : f.needsReview === false ? '0' : '';
		scope = f.scope;
	});

	function pushFilters(next: Partial<ScriptureManageFilters> & { offset?: number }) {
		const merged: ScriptureManageFilters = {
			scope: next.scope ?? scope,
			bibleBook: next.bibleBook !== undefined ? next.bibleBook : bibleBook.trim() || null,
			chapter:
				next.chapter !== undefined
					? next.chapter
					: chapter.trim() === ''
						? null
						: Number(chapter),
			passage: next.passage !== undefined ? next.passage : passage.trim() || null,
			page: next.page !== undefined ? next.page : pageFilter.trim() || null,
			needsReview:
				next.needsReview !== undefined
					? next.needsReview
					: needsReview === '1'
						? true
						: needsReview === '0'
							? false
							: null,
			offset: next.offset ?? 0,
			limit: data.filters.limit
		};
		if (merged.chapter != null && !Number.isInteger(merged.chapter)) merged.chapter = null;
		const qs = scriptureManageFiltersToSearchParams(merged).toString();
		void goto(`${page.url.pathname}${qs ? `?${qs}` : ''}`, {
			keepFocus: true,
			noScroll: true
		});
	}

	function onSubmit(e: Event) {
		e.preventDefault();
		pushFilters({ offset: 0 });
	}

	const title = $derived(
		data.book.volume_number
			? `${data.book.title} (vol. ${data.book.volume_number})`
			: data.book.title || '(untitled)'
	);

	const prevOffset = $derived(Math.max(0, data.filters.offset - data.filters.limit));
	const nextOffset = $derived(data.filters.offset + data.filters.limit);
	const hasPrev = $derived(data.filters.offset > 0);
	const hasNext = $derived(nextOffset < data.filteredCount);
</script>

<div class="mx-auto w-full max-w-5xl space-y-6 pb-tabbar">
	<PageHeader
		title="Scripture index"
		back={{ href: `/library/books/${data.book.id}`, label: 'Back to book' }}
	>
		{#snippet meta()}
			<p class="text-sm text-muted-foreground">
				{title}
				· {data.tallies.total.toLocaleString()} in scope
				{#if data.book.series_name}
					· {data.book.series_name}
				{/if}
			</p>
		{/snippet}
	</PageHeader>

	<form class="space-y-3 rounded-lg border border-border bg-card p-4" onsubmit={onSubmit}>
		{#if data.setVolumeCount >= 2}
			<div class="inline-flex rounded-md border border-border p-0.5 text-xs" role="group">
				<button
					type="button"
					class={cn(
						'rounded px-2.5 py-1 font-medium',
						scope === 'volume' ? 'bg-foreground text-background' : 'text-muted-foreground'
					)}
					onclick={() => {
						scope = 'volume';
						pushFilters({ scope: 'volume', offset: 0 });
					}}
				>
					This volume
				</button>
				<button
					type="button"
					class={cn(
						'rounded px-2.5 py-1 font-medium',
						scope === 'set' ? 'bg-foreground text-background' : 'text-muted-foreground'
					)}
					onclick={() => {
						scope = 'set';
						pushFilters({ scope: 'set', offset: 0 });
					}}
				>
					Whole set
				</button>
			</div>
		{/if}

		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			<div class="space-y-1">
				<Label for="bible_book">Bible book</Label>
				<select
					id="bible_book"
					class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
					bind:value={bibleBook}
				>
					<option value="">Any</option>
					{#each data.allBibleBookNames as name (name)}
						<option value={name}>{name}</option>
					{/each}
				</select>
			</div>
			<div class="space-y-1">
				<Label for="chapter">Chapter</Label>
				<Input id="chapter" bind:value={chapter} inputmode="numeric" placeholder="e.g. 9" />
			</div>
			<div class="space-y-1">
				<Label for="passage">Passage</Label>
				<Input id="passage" bind:value={passage} placeholder="Rom 9:1-5 or 9:1" />
			</div>
			<div class="space-y-1">
				<Label for="page">Page</Label>
				<Input id="page" bind:value={pageFilter} placeholder="620" />
			</div>
			<div class="space-y-1">
				<Label for="needs_review">Needs review</Label>
				<select
					id="needs_review"
					class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
					bind:value={needsReview}
				>
					<option value="">Any</option>
					<option value="1">Yes</option>
					<option value="0">No</option>
				</select>
			</div>
			<div class="flex items-end">
				<Button type="submit" size="sm" hotkey="s" label="Apply filters" />
			</div>
		</div>
	</form>

	{#if data.rows.length === 0}
		<p
			class="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground"
		>
			No references match these filters.
		</p>
	{:else}
		<ScriptureIndexTable
			rows={data.rows}
			filteredCount={data.filteredCount}
			scopeBookIds={data.scopeBookIds}
			showVolume={data.filters.scope === 'set'}
			offset={data.filters.offset}
			limit={data.filters.limit}
			onInvalidate={() => invalidate(bookInvalidateKey)}
		/>
	{/if}

	{#if data.filteredCount > SCRIPTURE_INDEX_MANAGE_PAGE_SIZE || hasPrev || hasNext}
		<div class="flex items-center justify-between gap-3">
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={!hasPrev}
				onclick={() => pushFilters({ offset: prevOffset })}
				label="Previous"
			/>
			<span class="text-sm tabular-nums text-muted-foreground">
				Page {Math.floor(data.filters.offset / data.filters.limit) + 1}
			</span>
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={!hasNext}
				onclick={() => pushFilters({ offset: nextOffset })}
				label="Next"
			/>
		</div>
	{/if}
</div>

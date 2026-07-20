<script lang="ts">
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/page-header.svelte';
	import SermonsViewToggle from '$lib/components/sermons-view-toggle.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		BY_BOOK_SORT_LABELS,
		BY_BOOK_SORTS,
		type ByBookListFilters,
		type ByBookSort,
		type ByBookSortDir,
		type ByBookTestamentFilter
	} from '$lib/types/sermons';
	import {
		byBookFiltersToSearchParams,
		defaultSortDir,
		librarySearchPassageHref,
		sermonsListByBookHref
	} from '$lib/sermons/by-book';
	import { cn } from '$lib/utils';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Star from '@lucide/svelte/icons/star';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let expandedBook = $state<string | null>(null);
	let alsoOpenFor = $state<string | null>(null);

	function pushFilters(patch: Partial<ByBookListFilters>) {
		const next: ByBookListFilters = { ...data.filters, ...patch };
		if (patch.sort != null && patch.sortDir == null) {
			next.sortDir = defaultSortDir(patch.sort);
		}
		const qs = byBookFiltersToSearchParams(next).toString();
		void goto(`/sermons/by-book${qs ? `?${qs}` : ''}`, { keepFocus: true, noScroll: true });
	}

	function toggleSort(sort: ByBookSort) {
		if (data.filters.sort === sort) {
			const flip: ByBookSortDir = data.filters.sortDir === 'asc' ? 'desc' : 'asc';
			pushFilters({ sortDir: flip });
			return;
		}
		pushFilters({ sort, sortDir: defaultSortDir(sort) });
	}

	function toggleTestament(t: Exclude<ByBookTestamentFilter, null>) {
		pushFilters({ testament: data.filters.testament === t ? null : t });
	}

	function toggleExpand(bibleBook: string) {
		if (expandedBook === bibleBook) {
			expandedBook = null;
			alsoOpenFor = null;
			return;
		}
		expandedBook = bibleBook;
		alsoOpenFor = null;
	}

	function ratingLabel(rating: number | null): string {
		if (rating == null) return '—';
		return `${rating}★`;
	}
</script>

<svelte:head>
	<title>Sermons by book — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 pb-tabbar">
	<PageHeader
		title="Sermons"
		subtitle="Bible-book spine — sermons preached and commentaries on the shelf."
	>
		{#snippet actions()}
			<SermonsViewToggle active="by-book" />
		{/snippet}
	</PageHeader>

	{#if data.loadError}
		<p class="mt-4 text-sm text-destructive" role="alert">{data.loadError}</p>
	{/if}

	<p class="mt-4 text-sm text-muted-foreground">
		{data.summary.sermonTotal} sermon{data.summary.sermonTotal === 1 ? '' : 's'}
		· {data.summary.commentaryTotal} commentar{data.summary.commentaryTotal === 1 ? 'y' : 'ies'}
		· {data.summary.fourStarTotal} · 4★+
	</p>

	<div
		class="sticky top-0 z-10 -mx-4 mt-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-6 md:px-6"
	>
		<div class="flex flex-wrap gap-1.5">
			{#each BY_BOOK_SORTS as sort (sort)}
				{@const active = data.filters.sort === sort}
				<button
					type="button"
					class={cn(
						'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
						active
							? 'border-foreground bg-foreground text-background'
							: 'border-border text-muted-foreground hover:bg-muted/80'
					)}
					onclick={() => toggleSort(sort)}
					aria-pressed={active}
					title={active
						? `Sorted ${data.filters.sortDir === 'asc' ? 'low→high / Genesis→Rev' : 'high→low / Rev→Genesis'} — tap to flip`
						: `Sort by ${BY_BOOK_SORT_LABELS[sort]}`}
				>
					{BY_BOOK_SORT_LABELS[sort]}
					{#if active}
						<span class="opacity-80">{data.filters.sortDir === 'asc' ? '↑' : '↓'}</span>
					{/if}
				</button>
			{/each}
		</div>

		<div class="mt-2 flex flex-wrap gap-1.5">
			<button
				type="button"
				class={cn(
					'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
					data.filters.testament === 'ot'
						? 'border-foreground bg-foreground text-background'
						: 'border-border text-muted-foreground hover:bg-muted/80'
				)}
				onclick={() => toggleTestament('ot')}
				aria-pressed={data.filters.testament === 'ot'}
			>
				OT
			</button>
			<button
				type="button"
				class={cn(
					'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
					data.filters.testament === 'nt'
						? 'border-foreground bg-foreground text-background'
						: 'border-border text-muted-foreground hover:bg-muted/80'
				)}
				onclick={() => toggleTestament('nt')}
				aria-pressed={data.filters.testament === 'nt'}
			>
				NT
			</button>
			<button
				type="button"
				class={cn(
					'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
					data.filters.hasSermons
						? 'border-foreground bg-foreground text-background'
						: 'border-border text-muted-foreground hover:bg-muted/80'
				)}
				onclick={() => pushFilters({ hasSermons: !data.filters.hasSermons })}
				aria-pressed={data.filters.hasSermons}
			>
				Has sermons
			</button>
			<button
				type="button"
				class={cn(
					'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
					data.filters.noCommentaries
						? 'border-foreground bg-foreground text-background'
						: 'border-border text-muted-foreground hover:bg-muted/80'
				)}
				onclick={() => pushFilters({ noCommentaries: !data.filters.noCommentaries })}
				aria-pressed={data.filters.noCommentaries}
			>
				No commentaries
			</button>
			<button
				type="button"
				class={cn(
					'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
					data.filters.hasFourStar
						? 'border-foreground bg-foreground text-background'
						: 'border-border text-muted-foreground hover:bg-muted/80'
				)}
				onclick={() => pushFilters({ hasFourStar: !data.filters.hasFourStar })}
				aria-pressed={data.filters.hasFourStar}
			>
				Has 4★+
			</button>
		</div>
	</div>

	<p class="mt-3 text-xs text-muted-foreground">
		{data.rows.length} book{data.rows.length === 1 ? '' : 's'} shown
	</p>

	<ul class="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
		{#each data.rows as row (row.bibleBook)}
			{@const open = expandedBook === row.bibleBook}
			<li class="text-card-foreground">
				<div class="flex items-stretch gap-0">
					<button
						type="button"
						class="flex min-h-12 min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
						onclick={() => toggleExpand(row.bibleBook)}
						aria-expanded={open}
					>
						<ChevronDown
							class={cn(
								'size-4 shrink-0 text-muted-foreground transition-transform',
								open && 'rotate-180'
							)}
							aria-hidden="true"
						/>
						<span class="min-w-0 flex-1 truncate text-sm font-medium tracking-tight">
							{row.bibleBook}
						</span>
						<span class="shrink-0 tabular-nums text-xs text-muted-foreground">
							{row.sermonCount}
							<span class="mx-1 opacity-40">·</span>
							{row.commentaryCount}
							{#if row.fourStarCount > 0}
								<span class="mx-1 opacity-40">·</span>
								<span class="text-amber-700 dark:text-amber-300"
									>{row.fourStarCount} · 4★+</span
								>
							{/if}
						</span>
					</button>
					<div class="flex shrink-0 items-center gap-0.5 border-l border-border px-1">
						{#if row.sermonCount > 0}
							<Button
								variant="ghost"
								size="icon-sm"
								href={sermonsListByBookHref(row.bibleBook)}
								aria-label={`Sermons on ${row.bibleBook}`}
								title="Sermons list"
							>
								<span class="text-[10px] font-semibold tabular-nums">{row.sermonCount}</span>
							</Button>
						{/if}
						<Button
							variant="ghost"
							size="icon-sm"
							href={librarySearchPassageHref(row.bibleBook)}
							aria-label={`Find ${row.bibleBook} in library`}
							title="Find in library"
						>
							<BookOpen class="size-4" />
						</Button>
					</div>
				</div>

				{#if open}
					<div class="border-t border-border bg-muted/20 px-3 py-3">
						{#if row.commentaries.length === 0}
							<p class="text-xs text-muted-foreground">No commentaries tagged for this book.</p>
						{:else}
							<p class="text-xs font-medium text-muted-foreground">Commentaries</p>
							<ul class="mt-1.5 space-y-1.5">
								{#each row.commentaries as hit (hit.bookId)}
									<li>
										<a
											href={hit.href}
											class="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
										>
											<span class="min-w-0">
												<span class="font-medium tracking-tight">{hit.title}</span>
												{#if hit.authorShort}
													<span class="mt-0.5 block text-xs text-muted-foreground"
														>{hit.authorShort}</span
													>
												{/if}
											</span>
											<span
												class="flex shrink-0 items-center gap-0.5 tabular-nums text-xs text-muted-foreground"
											>
												{#if hit.rating != null}
													<Star
														class="size-3 fill-amber-500 text-amber-600 dark:text-amber-400"
														aria-hidden="true"
													/>
												{/if}
												{ratingLabel(hit.rating)}
											</span>
										</a>
									</li>
								{/each}
							</ul>
						{/if}

						{#if row.alsoOnShelf.length > 0}
							<button
								type="button"
								class="mt-3 flex w-full items-center gap-1 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
								onclick={() => {
									alsoOpenFor = alsoOpenFor === row.bibleBook ? null : row.bibleBook;
								}}
								aria-expanded={alsoOpenFor === row.bibleBook}
							>
								<ChevronDown
									class={cn(
										'size-3.5 transition-transform',
										alsoOpenFor === row.bibleBook && 'rotate-180'
									)}
									aria-hidden="true"
								/>
								Also on shelf ({row.alsoOnShelf.length})
							</button>
							{#if alsoOpenFor === row.bibleBook}
								<ul class="mt-1.5 space-y-1.5">
									{#each row.alsoOnShelf as hit (`${hit.kind}-${hit.essayId ?? hit.bookId}`)}
										<li>
											<a
												href={hit.href}
												class="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
											>
												<span class="min-w-0">
													<span class="font-medium tracking-tight">{hit.title}</span>
													{#if hit.kind === 'essay'}
														<span
															class="ml-1 text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
															>essay</span
														>
													{:else if hit.genre}
														<span class="mt-0.5 block text-xs text-muted-foreground"
															>{hit.genre}</span
														>
													{/if}
													{#if hit.authorShort}
														<span class="mt-0.5 block text-xs text-muted-foreground"
															>{hit.authorShort}</span
														>
													{/if}
												</span>
											</a>
										</li>
									{/each}
								</ul>
							{/if}
						{/if}
					</div>
				{/if}
			</li>
		{:else}
			<li class="px-4 py-8 text-center text-sm text-muted-foreground">
				No books match these filters.
			</li>
		{/each}
	</ul>
</div>

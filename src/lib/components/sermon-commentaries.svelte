<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { BIBLE_BOOK_NAMES } from '$lib/library/bible-book-names';
	import {
		loadCommentaryBooks,
		saveCommentaryBooks,
		uniqueBibleBooks
	} from '$lib/sermons/commentary-books';
	import { formatHitRate } from '$lib/studies/hit-rate';
	import type { SermonCommentaryShelf } from '$lib/types/sermons';
	import Star from '@lucide/svelte/icons/star';

	let {
		shelves,
		mode,
		parentField,
		parentId,
		isOwner,
		attachedBookIds = [],
		attachedEssayIds = [],
		onAttached
	}: {
		shelves: SermonCommentaryShelf[];
		/** Passage shelves only, or topical shelves plus an add-a-book control. */
		mode: 'passage' | 'add';
		parentField: 'paper_id' | 'sermon_id';
		parentId: string;
		isOwner: boolean;
		attachedBookIds?: string[];
		attachedEssayIds?: string[];
		onAttached: () => void | Promise<void>;
	} = $props();

	let bookToAdd = $state('');
	let extraShelves = $state<SermonCommentaryShelf[]>([]);
	let addError = $state<string | null>(null);
	let loading = $state(false);
	let pendingKey = $state<string | null>(null);
	let hydrateGen = 0;

	const attachedBooks = $derived(new Set(attachedBookIds));
	const attachedEssays = $derived(new Set(attachedEssayIds));
	const passageBooks = $derived(new Set(shelves.map((shelf) => shelf.bibleBook)));
	const displayShelves = $derived([
		...shelves,
		...extraShelves.filter((shelf) => !passageBooks.has(shelf.bibleBook))
	]);
	const shownBooks = $derived(new Set(displayShelves.map((shelf) => shelf.bibleBook)));

	$effect(() => {
		if (!browser || mode !== 'add') return;
		const id = parentId;
		const present = new Set(shelves.map((shelf) => shelf.bibleBook));
		const stored = loadCommentaryBooks(id).filter((book) => !present.has(book));
		void hydrate(stored);
	});

	async function fetchShelf(bibleBook: string): Promise<SermonCommentaryShelf | null> {
		const params = new URLSearchParams({ bible_book: bibleBook });
		const res = await fetch(`/studies/commentaries.json?${params}`);
		if (!res.ok) return null;
		const body = (await res.json()) as { shelf?: SermonCommentaryShelf; error?: string | null };
		if (body.error || !body.shelf) return null;
		return body.shelf;
	}

	async function hydrate(books: string[]) {
		const gen = ++hydrateGen;
		if (books.length === 0) {
			if (gen === hydrateGen) extraShelves = [];
			return;
		}
		loading = true;
		addError = null;
		try {
			const loaded = await Promise.all(books.map((book) => fetchShelf(book)));
			if (gen !== hydrateGen) return;
			const shelvesLoaded = loaded.filter((shelf): shelf is SermonCommentaryShelf => shelf != null);
			if (shelvesLoaded.length !== books.length) addError = 'Could not load every commentary shelf.';
			extraShelves = shelvesLoaded;
		} finally {
			if (gen === hydrateGen) loading = false;
		}
	}

	function addBook() {
		const book = uniqueBibleBooks([bookToAdd])[0];
		if (!book || shownBooks.has(book)) return;
		const next = uniqueBibleBooks([
			...extraShelves.map((shelf) => shelf.bibleBook),
			book
		]);
		saveCommentaryBooks(parentId, next);
		bookToAdd = '';
		void hydrate(next);
	}

	function removeBook(bibleBook: string) {
		const next = extraShelves.map((shelf) => shelf.bibleBook).filter((book) => book !== bibleBook);
		saveCommentaryBooks(parentId, next);
		extraShelves = extraShelves.filter((shelf) => shelf.bibleBook !== bibleBook);
	}

	function isAttached(hit: SermonCommentaryShelf['commentaries'][number]): boolean {
		if (hit.kind === 'essay' && hit.essayId) return attachedEssays.has(hit.essayId);
		return attachedBooks.has(hit.bookId);
	}

	function ratingLabel(rating: number | null): string {
		if (rating == null) return '—';
		return `${rating}★`;
	}

	const attachEnhance: SubmitFunction = ({ formData }) => {
		pendingKey = String(formData.get('essay_id') || formData.get('book_id') || '');
		return async ({ result, update }) => {
			pendingKey = null;
			await update({ invalidateAll: false, reset: false });
			if (result.type === 'success') await onAttached();
		};
	};

	const lead = $derived(
		mode === 'add'
			? 'Add a Bible book, then attach the commentaries that apply.'
			: 'Same shelf as By book. Attach a volume to add it as a source.'
	);
</script>

<h2 class="text-sm font-semibold">Commentaries</h2>
<p class="mt-0.5 text-xs text-muted-foreground">{lead}</p>

{#if mode === 'add' && isOwner}
	<form
		class="mt-3 flex flex-wrap items-center gap-2"
		onsubmit={(event) => {
			event.preventDefault();
			addBook();
		}}
	>
		<select
			bind:value={bookToAdd}
			class="h-8 rounded-md border border-border bg-background px-2 text-sm"
			aria-label="Bible book"
		>
			<option value="">Bible book</option>
			{#each BIBLE_BOOK_NAMES as name (name)}
				<option value={name} disabled={shownBooks.has(name)}>{name}</option>
			{/each}
		</select>
		<Button type="submit" variant="outline" size="sm" label="Add" disabled={!bookToAdd || loading} />
	</form>
{/if}

{#if addError}
	<p class="mt-2 text-sm text-destructive" role="alert">{addError}</p>
{/if}
{#if loading}
	<p class="mt-2 text-sm text-muted-foreground">Loading commentaries…</p>
{/if}

{#if mode === 'passage' && displayShelves.length === 0}
	<p class="mt-3 text-sm text-muted-foreground">Add a passage to see commentaries for that book.</p>
{:else if mode === 'add' && displayShelves.length === 0 && !loading}
	<p class="mt-3 text-sm text-muted-foreground">No commentary shelves yet.</p>
{/if}

{#each displayShelves as shelf (shelf.bibleBook)}
	<div class="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
		<div class="flex items-center justify-between gap-2">
			<p class="text-xs font-medium text-muted-foreground">{shelf.bibleBook}</p>
			{#if mode === 'add' && isOwner && !passageBooks.has(shelf.bibleBook)}
				<button
					type="button"
					class="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
					onclick={() => removeBook(shelf.bibleBook)}
				>
					Remove
				</button>
			{/if}
		</div>
		{#if shelf.commentaries.length === 0}
			<p class="mt-1 text-xs text-muted-foreground">No commentaries tagged for this book.</p>
		{:else}
			<ul class="mt-1 space-y-0.5">
				{#each shelf.commentaries as hit (`${hit.kind}-${hit.essayId ?? hit.bookId}`)}
					<li class="flex items-start gap-2">
						<a
							href={hit.href}
							class="flex min-w-0 flex-1 items-start gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
						>
							<span class="min-w-0 flex-1">
								<span class="block truncate font-medium tracking-tight">{hit.title}</span>
								{#if hit.authorShort}
									<span class="mt-0.5 block truncate text-xs text-muted-foreground">{hit.authorShort}</span>
								{/if}
							</span>
							<span
								class="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs tabular-nums text-muted-foreground"
								aria-label={[
									hit.seriesLabel ? `Series ${hit.seriesLabel}` : null,
									hit.rating != null ? `Rated ${hit.rating} stars` : 'Unrated',
									hit.hitRate ? `Hit rate ${formatHitRate(hit.hitRate)}` : null
								]
									.filter(Boolean)
									.join(', ')}
							>
								{#if hit.seriesLabel}
									<span class="max-w-[7.5rem] truncate font-medium" title={hit.seriesLabel}
										>{hit.seriesLabel}</span
									>
								{/if}
								<span class="inline-flex items-center gap-0.5">
									{#if hit.rating != null}
										<Star
											class="size-3 fill-amber-500 text-amber-600 dark:text-amber-400"
											aria-hidden="true"
										/>
									{/if}
									{ratingLabel(hit.rating)}
								</span>
								{#if hit.hitRate}
									<span
										class="font-medium text-foreground"
										title="Consulted or cited in expository studies on this book since the commentary was acquired"
									>
										{formatHitRate(hit.hitRate)}
									</span>
								{/if}
							</span>
						</a>
						{#if isOwner}
							<div class="w-24 shrink-0 pt-1">
								{#if isAttached(hit)}
									<span
										class="inline-flex h-7 w-full items-center justify-center rounded-md border border-border text-xs text-muted-foreground"
									>
										Attached
									</span>
								{:else}
									{@const rowKey = hit.essayId ?? hit.bookId}
									<form method="POST" action="?/addPaperSource" use:enhance={attachEnhance} class="w-full">
										<input type="hidden" name={parentField} value={parentId} />
										{#if hit.kind === 'essay' && hit.essayId}
											<input type="hidden" name="essay_id" value={hit.essayId} />
										{:else}
											<input type="hidden" name="book_id" value={hit.bookId} />
										{/if}
										<Button
											type="submit"
											variant="outline"
											size="sm"
											class="w-full"
											label="Attach"
											disabled={pendingKey === rowKey}
										/>
									</form>
								{/if}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/each}

<script lang="ts">
	import { browser } from '$app/environment';
	import CommentaryShelfHit from '$lib/components/commentary-shelf-hit.svelte';
	import { Button } from '$lib/components/ui/button';
	import { BIBLE_BOOK_NAMES } from '$lib/library/bible-book-names';
	import {
		commentaryDismissKey,
		loadDismissedCommentaries,
		saveDismissedCommentaries
	} from '$lib/sermons/commentary-dismiss';
	import {
		loadCommentaryBooks,
		saveCommentaryBooks,
		uniqueBibleBooks
	} from '$lib/sermons/commentary-books';
	import { partitionCommentaryHits } from '$lib/sermons/by-book';
	import type { ByBookShelfHit, SermonCommentaryShelf } from '$lib/types/sermons';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

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
	/** Shelves the user just added start open. Passage shelves stay closed. */
	let preferOpen = $state<Set<string>>(new Set());
	let addError = $state<string | null>(null);
	let loading = $state(false);
	let hydrateGen = 0;
	let showDismissed = $state(false);
	let hiddenKeys = $state<Set<string>>(new Set());

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

	$effect(() => {
		const id = parentId;
		showDismissed = false;
		if (!browser || !id) {
			hiddenKeys = new Set();
			return;
		}
		hiddenKeys = loadDismissedCommentaries(id);
	});

	function persistHidden(next: Set<string>) {
		hiddenKeys = next;
		if (browser && parentId) saveDismissedCommentaries(parentId, next);
	}

	function dismissLocal(hit: ByBookShelfHit) {
		const next = new Set(hiddenKeys);
		next.add(commentaryDismissKey(hit));
		persistHidden(next);
	}

	function restoreLocal(hit: ByBookShelfHit) {
		const next = new Set(hiddenKeys);
		next.delete(commentaryDismissKey(hit));
		persistHidden(next);
	}

	function locallyDismissed(hit: ByBookShelfHit): boolean {
		return hiddenKeys.has(commentaryDismissKey(hit));
	}

	function rowConcealed(hit: ByBookShelfHit): boolean {
		return hit.shelfDismissed || locallyDismissed(hit);
	}

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
			if (shelvesLoaded.length !== books.length)
				addError = 'Could not load every commentary shelf.';
			extraShelves = shelvesLoaded;
		} finally {
			if (gen === hydrateGen) loading = false;
		}
	}

	function addBook() {
		const book = uniqueBibleBooks([bookToAdd])[0];
		if (!book || shownBooks.has(book)) return;
		const next = uniqueBibleBooks([...extraShelves.map((shelf) => shelf.bibleBook), book]);
		saveCommentaryBooks(parentId, next);
		preferOpen = new Set([...preferOpen, book]);
		bookToAdd = '';
		void hydrate(next);
	}

	/** Uncontrolled `<details>` keeps the user's toggle. This only opens a shelf on first mount. */
	function openIfPreferred(node: HTMLDetailsElement, bibleBook: string) {
		if (preferOpen.has(bibleBook)) node.open = true;
	}

	function shelfCountLabel(active: number, parked: number): string {
		if (active === 1) return '1 commentary';
		if (active > 1) return `${active} commentaries`;
		if (parked === 1) return '1 dismissed';
		if (parked > 1) return `${parked} dismissed`;
		return 'No commentaries';
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

	const lead = $derived(
		mode === 'add'
			? 'Add a Bible book, then attach the commentaries that apply.'
			: 'Same shelf as By book. Attach a volume to add it as a source.'
	);

	const concealedCount = $derived(
		displayShelves.reduce(
			(count, shelf) => count + shelf.commentaries.filter((hit) => rowConcealed(hit)).length,
			0
		)
	);
</script>

<h2 class="text-sm font-semibold">Commentaries</h2>
<p class="mt-0.5 text-xs text-muted-foreground">{lead}</p>
{#if concealedCount > 0}
	<button
		type="button"
		class="mt-2 min-h-9 rounded-md px-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
		aria-pressed={showDismissed}
		onclick={() => (showDismissed = !showDismissed)}
	>
		{showDismissed ? 'Hide dismissed' : `Show dismissed (${concealedCount})`}
	</button>
{/if}

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
		<Button
			type="submit"
			variant="outline"
			size="sm"
			label="Add"
			disabled={!bookToAdd || loading}
		/>
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

{#if displayShelves.length > 0}
	<div class="mt-3 flex flex-col gap-2">
		{#each displayShelves as shelf (shelf.bibleBook)}
			{@const parts = partitionCommentaryHits(shelf.commentaries)}
			{@const visible = shelf.commentaries.filter((hit) => showDismissed || !rowConcealed(hit))}
			<details
				class="group rounded-lg border border-border bg-card"
				use:openIfPreferred={shelf.bibleBook}
			>
				<summary
					class="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden"
				>
					<ChevronDown
						class="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
						aria-hidden="true"
					/>
					<span class="min-w-0 flex-1 truncate text-sm font-medium tracking-tight">
						{shelf.bibleBook}
					</span>
					<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
						{shelfCountLabel(parts.active.length, parts.parked.length)}
					</span>
					{#if mode === 'add' && isOwner && !passageBooks.has(shelf.bibleBook)}
						<button
							type="button"
							class="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
							onclick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								removeBook(shelf.bibleBook);
							}}
						>
							Remove
						</button>
					{/if}
				</summary>
				<div class="border-t border-border px-3 py-2.5">
					{#if shelf.commentaries.length === 0}
						<p class="text-xs text-muted-foreground">No commentaries tagged for this book.</p>
					{:else if visible.length === 0}
						<p class="text-xs text-muted-foreground">Dismissed. Show dismissed to attach one.</p>
					{:else}
						<ul class="divide-y divide-border/70">
							{#each visible as hit (`${hit.kind}-${hit.essayId ?? hit.bookId}`)}
								<li class={rowConcealed(hit) ? 'bg-muted/40' : ''}>
									<CommentaryShelfHit
										{hit}
										{isOwner}
										{parentField}
										{parentId}
										attached={isAttached(hit)}
										locallyDismissed={locallyDismissed(hit)}
										{onAttached}
										onDismissLocal={() => dismissLocal(hit)}
										onRestoreLocal={() => restoreLocal(hit)}
									/>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</details>
		{/each}
	</div>
{/if}

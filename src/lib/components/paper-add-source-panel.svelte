<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { BookListRow, EssaySearchHit } from '$lib/types/library';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';

	let {
		paperId,
		query = '',
		bookHits = [],
		essayHits = [],
		attachedBookIds = [],
		attachedEssayIds = [],
		onAdded
	}: {
		paperId: string;
		query?: string;
		bookHits?: BookListRow[];
		essayHits?: EssaySearchHit[];
		attachedBookIds?: string[];
		attachedEssayIds?: string[];
		onAdded?: () => void | Promise<void>;
	} = $props();

	let searchValue = $state('');
	let stubOpen = $state(false);
	let stubTitle = $state('');
	let stubAuthor = $state('');
	let stubYear = $state('');
	let pending = $state(false);

	$effect(() => {
		searchValue = query;
	});

	const attachedBooks = $derived(new Set(attachedBookIds));
	const attachedEssays = $derived(new Set(attachedEssayIds));
	const hasResults = $derived(bookHits.length > 0 || essayHits.length > 0);

	const attachEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				await onAdded?.();
			}
		};
	};

	const stubEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				stubOpen = false;
				stubTitle = '';
				stubAuthor = '';
				stubYear = '';
				await onAdded?.();
			}
		};
	};

	function bookLabel(b: BookListRow): string {
		return b.title?.trim() || '(untitled)';
	}
</script>

<div class="rounded-lg border border-dashed border-border p-3">
	<form method="GET" data-sveltekit-keepfocus data-sveltekit-noscroll class="flex gap-2">
		<div class="relative min-w-0 flex-1">
			<Search
				class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				type="search"
				name="src_q"
				bind:value={searchValue}
				placeholder="Search catalog — title, author, essay…"
				class="pl-8"
				aria-label="Search library for sources"
			/>
		</div>
		<Button type="submit" variant="outline" label="Search" />
	</form>

	{#if query}
		{#if !hasResults}
			<p class="mt-3 text-sm text-muted-foreground">
				No catalog matches for “{query}”. Add it as a not-owned book below.
			</p>
		{:else}
			<ul class="mt-3 space-y-1.5">
				{#each bookHits as b (b.id)}
					{@const attached = attachedBooks.has(b.id)}
					<li
						class="flex items-center justify-between gap-3 rounded-md border border-border px-2.5 py-2"
					>
						<div class="min-w-0">
							<p class="truncate text-sm">{bookLabel(b)}</p>
							<p class="truncate text-xs text-muted-foreground">
								{b.authors_label ?? 'No author'} · Book
							</p>
						</div>
						{#if attached}
							<span class="shrink-0 text-xs text-muted-foreground">Attached</span>
						{:else}
							<form method="POST" action="?/addPaperSource" use:enhance={attachEnhance}>
								<input type="hidden" name="paper_id" value={paperId} />
								<input type="hidden" name="book_id" value={b.id} />
								<Button
									type="submit"
									variant="outline"
									size="sm"
									class="gap-1"
									disabled={pending}
								>
									<Plus class="size-3.5" />
									Add
								</Button>
							</form>
						{/if}
					</li>
				{/each}
				{#each essayHits as e (e.id)}
					{@const attached = attachedEssays.has(e.id)}
					<li
						class="flex items-center justify-between gap-3 rounded-md border border-border px-2.5 py-2"
					>
						<div class="min-w-0">
							<p class="truncate text-sm">“{e.essay_title}”</p>
							<p class="truncate text-xs text-muted-foreground">
								{e.authors_label ?? 'Unsigned'} · Essay in {e.parent_book_title ?? '(untitled)'}
							</p>
						</div>
						{#if attached}
							<span class="shrink-0 text-xs text-muted-foreground">Attached</span>
						{:else}
							<form method="POST" action="?/addPaperSource" use:enhance={attachEnhance}>
								<input type="hidden" name="paper_id" value={paperId} />
								<input type="hidden" name="essay_id" value={e.id} />
								<Button
									type="submit"
									variant="outline"
									size="sm"
									class="gap-1"
									disabled={pending}
								>
									<Plus class="size-3.5" />
									Add
								</Button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	<div class="mt-3 border-t border-border pt-3">
		{#if !stubOpen}
			<button
				type="button"
				class="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
				onclick={() => {
					stubTitle = query;
					stubOpen = true;
				}}
			>
				Not in the catalog? Add a not-owned book
			</button>
		{:else}
			<form
				method="POST"
				action="?/createNotOwnedSource"
				use:enhance={stubEnhance}
				class="space-y-2"
			>
				<input type="hidden" name="paper_id" value={paperId} />
				<p class="text-xs font-medium text-muted-foreground">
					Creates a library stub (owned = no) and attaches it here.
				</p>
				<div class="space-y-1.5">
					<Label for="stub_title" class="text-xs">Title</Label>
					<Input id="stub_title" name="title" bind:value={stubTitle} required />
				</div>
				<div class="grid grid-cols-[1fr_5.5rem] gap-2">
					<div class="space-y-1.5">
						<Label for="stub_author" class="text-xs">Author</Label>
						<Input
							id="stub_author"
							name="author"
							bind:value={stubAuthor}
							placeholder="First Last"
						/>
					</div>
					<div class="space-y-1.5">
						<Label for="stub_year" class="text-xs">Year</Label>
						<Input
							id="stub_year"
							name="year"
							bind:value={stubYear}
							inputmode="numeric"
							placeholder="2004"
						/>
					</div>
				</div>
				<div class="flex gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						hotkey="Escape"
						label="Cancel"
						onclick={() => (stubOpen = false)}
					/>
					<Button
						type="submit"
						size="sm"
						hotkey="s"
						label={pending ? 'Adding…' : 'Create stub + attach'}
						disabled={pending || !stubTitle.trim()}
					/>
				</div>
			</form>
		{/if}
	</div>
</div>

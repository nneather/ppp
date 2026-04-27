<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import SourcePicker from '$lib/components/source-picker.svelte';
	import type { PolymorphicParent } from '$lib/library/polymorphic';
	import type { BookListRow } from '$lib/types/library';

	/**
	 * <ScriptureReferenceForm>
	 *
	 * Embedded sub-form for adding a scripture_reference to a book or essay.
	 * Designed for inline use on `/library/books/[id]` (Session 2 wires it).
	 * Manual entry only — `source_image_url` is a TEXT input, no upload yet
	 * (Tracker_1 Open Question 3 resolves the Storage bucket name).
	 *
	 * Page numbers are TEXT — schema handles `IV.317`, `xiv`. We intentionally
	 * do NOT coerce.
	 */

	type FormMessage = { message?: string } | null | undefined;

	let {
		books,
		bibleBookNames,
		lockedBookId = null,
		actionPath = '',
		formMessage = null,
		onSaved
	}: {
		books: BookListRow[];
		bibleBookNames: string[];
		lockedBookId?: string | null;
		actionPath?: string;
		formMessage?: FormMessage;
		onSaved?: (refId: string) => void;
	} = $props();

	let parent = $state<PolymorphicParent | null>(null);
	$effect(() => {
		if (lockedBookId) parent = { kind: 'book', book_id: lockedBookId };
	});
	let bible_book = $state('');
	let chapter_start = $state('');
	let verse_start = $state('');
	let chapter_end = $state('');
	let verse_end = $state('');
	let page_start = $state('');
	let page_end = $state('');
	let needs_review = $state(false);
	let review_note = $state('');
	let source_image_url = $state('');
	let pending = $state(false);

	const bibleBookItems = $derived([
		{ value: '', label: '— Pick a book —' },
		...bibleBookNames.map((n) => ({ value: n, label: n }))
	]);
	const bibleBookLabel = $derived(bible_book.length > 0 ? bible_book : '— Pick a book —');

	const sourceKind = $derived<'book' | 'essay'>(parent?.kind ?? 'book');
	const sourceBookId = $derived(parent?.kind === 'book' ? parent.book_id : '');
	const sourceEssayId = $derived(parent?.kind === 'essay' ? parent.essay_id : '');

	const submitEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				const r = (result.data ?? {}) as { kind?: string; refId?: string };
				if (r.refId) {
					if (browser) {
						bible_book = '';
						chapter_start = '';
						verse_start = '';
						chapter_end = '';
						verse_end = '';
						page_start = '';
						page_end = '';
						needs_review = false;
						review_note = '';
						source_image_url = '';
					}
					onSaved?.(r.refId);
				}
			}
		};
	};
</script>

<form
	method="POST"
	action={`${actionPath}?/createScriptureRef`}
	use:enhance={submitEnhance}
	class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground"
>
	<input type="hidden" name="source_kind" value={sourceKind} />
	<input type="hidden" name="book_id" value={sourceBookId} />
	<input type="hidden" name="essay_id" value={sourceEssayId} />
	<input type="hidden" name="needs_review" value={needs_review ? 'true' : 'false'} />

	<header>
		<h3 class="text-sm font-semibold tracking-tight">Add scripture reference</h3>
		<p class="text-xs text-muted-foreground">
			Pages are free text — `IV.317`, `xiv`, etc. all welcome. Image upload arrives in a later
			session.
		</p>
	</header>

	{#if formMessage?.message}
		<p
			class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
			role="alert"
		>
			{formMessage.message}
		</p>
	{/if}

	<SourcePicker bind:value={parent} {books} {lockedBookId} />

	<div class="space-y-2">
		<Label for="sr-bible">Bible book <span class="text-destructive">*</span></Label>
		<Select.Root type="single" bind:value={bible_book} items={bibleBookItems}>
			<Select.Trigger id="sr-bible" size="default" class="h-11 w-full justify-between px-3">
				<span data-slot="select-value" class="truncate text-left">{bibleBookLabel}</span>
			</Select.Trigger>
			<Select.Content class="max-h-72">
				{#each bibleBookItems as b (b.value)}
					<Select.Item value={b.value} label={b.label} class="min-h-10 py-2">
						{b.label}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
		<input type="hidden" name="bible_book" value={bible_book} />
	</div>

	<div class="grid gap-3 sm:grid-cols-4">
		<div class="space-y-2">
			<Label for="sr-cs">Chapter start</Label>
			<Input
				id="sr-cs"
				name="chapter_start"
				type="number"
				inputmode="numeric"
				min="0"
				max="199"
				bind:value={chapter_start}
				class="h-11 text-base tabular-nums"
			/>
		</div>
		<div class="space-y-2">
			<Label for="sr-vs">Verse start</Label>
			<Input
				id="sr-vs"
				name="verse_start"
				type="number"
				inputmode="numeric"
				min="0"
				max="999"
				bind:value={verse_start}
				class="h-11 text-base tabular-nums"
			/>
		</div>
		<div class="space-y-2">
			<Label for="sr-ce">Chapter end</Label>
			<Input
				id="sr-ce"
				name="chapter_end"
				type="number"
				inputmode="numeric"
				min="0"
				max="199"
				bind:value={chapter_end}
				class="h-11 text-base tabular-nums"
			/>
		</div>
		<div class="space-y-2">
			<Label for="sr-ve">Verse end</Label>
			<Input
				id="sr-ve"
				name="verse_end"
				type="number"
				inputmode="numeric"
				min="0"
				max="999"
				bind:value={verse_end}
				class="h-11 text-base tabular-nums"
			/>
		</div>
	</div>

	<div class="grid gap-3 sm:grid-cols-2">
		<div class="space-y-2">
			<Label for="sr-ps">Page start <span class="text-destructive">*</span></Label>
			<Input
				id="sr-ps"
				name="page_start"
				bind:value={page_start}
				placeholder="e.g. 317, IV.317, xiv"
				required
				class="h-11 text-base"
			/>
		</div>
		<div class="space-y-2">
			<Label for="sr-pe">Page end</Label>
			<Input
				id="sr-pe"
				name="page_end"
				bind:value={page_end}
				placeholder="(blank for single page)"
				class="h-11 text-base"
			/>
		</div>
	</div>

	<div class="space-y-2">
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" bind:checked={needs_review} class="size-4" />
			<span>Needs review</span>
		</label>
		{#if needs_review}
			<textarea
				name="review_note"
				bind:value={review_note}
				rows={2}
				class="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
				placeholder="Why does this need review?"
			></textarea>
		{/if}
	</div>

	<div class="space-y-2">
		<Label for="sr-img">Source image URL <span class="text-xs text-muted-foreground">(optional)</span></Label>
		<Input
			id="sr-img"
			name="source_image_url"
			bind:value={source_image_url}
			placeholder="https://… (upload UI coming later)"
			class="h-11 text-base"
		/>
	</div>

	<div class="flex justify-end">
		<Button type="submit" disabled={pending || !parent || !bible_book || !page_start}>
			{pending ? 'Saving…' : 'Add reference'}
		</Button>
	</div>
</form>

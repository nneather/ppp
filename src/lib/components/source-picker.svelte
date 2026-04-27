<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { FEATURE_ESSAYS_UI } from '$lib/library/polymorphic';
	import type { PolymorphicParent } from '$lib/library/polymorphic';
	import type { BookListRow } from '$lib/types/library';

	/**
	 * SourcePicker — the polymorphic `(book_id OR essay_id)` chooser per
	 * .cursor/rules/library-module.mdc. Reused by scripture_references,
	 * book_topics, book_bible_coverage, and book_ancient_coverage.
	 *
	 * Essay branch is gated behind FEATURE_ESSAYS_UI per the Session 2
	 * decision (essays UI is post-fall). Renders disabled until the flag
	 * flips so the layout reserves the slot.
	 *
	 * Pass `lockedBookId` when the picker is auto-populated to the host
	 * page's book — e.g. a scripture_reference form on /library/books/[id]
	 * always points at that book and shouldn't allow re-selection.
	 */

	let {
		value = $bindable<PolymorphicParent | null>(null),
		books,
		lockedBookId = null,
		label = 'Source',
		labelHelp = null
	}: {
		value?: PolymorphicParent | null;
		books: BookListRow[];
		lockedBookId?: string | null;
		label?: string;
		labelHelp?: string | null;
	} = $props();

	type Kind = 'book' | 'essay';

	let kind = $state<Kind>('book');
	let bookId = $state<string>('');

	const bookItems = $derived([
		{ value: '', label: '— Pick a book —' },
		...books.map((b) => ({
			value: b.id,
			label: bookLabel(b)
		}))
	]);

	const bookSelectLabel = $derived.by(() => {
		const found = bookItems.find((b) => b.value === bookId);
		return found?.label ?? '— Pick a book —';
	});

	function bookLabel(b: BookListRow): string {
		const segs = [b.title];
		if (b.volume_number) segs.push(`vol. ${b.volume_number}`);
		if (b.authors_label) segs.push(`— ${b.authors_label}`);
		return segs.join(' ');
	}

	$effect(() => {
		if (lockedBookId) {
			kind = 'book';
			bookId = lockedBookId;
		}
	});

	$effect(() => {
		if (value && value.kind === 'book' && !lockedBookId) {
			kind = 'book';
			bookId = value.book_id;
		}
	});

	$effect(() => {
		if (kind === 'book' && bookId) {
			value = { kind: 'book', book_id: bookId };
		} else {
			value = null;
		}
	});
</script>

<div class="space-y-2">
	<Label for="src-picker-book">{label}</Label>
	{#if labelHelp}
		<p class="text-xs text-muted-foreground">{labelHelp}</p>
	{/if}

	<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
		<div class="flex gap-1 rounded-lg border border-border p-1 text-xs">
			<button
				type="button"
				class={[
					'rounded-md px-3 py-1.5 font-medium transition-colors',
					kind === 'book'
						? 'bg-foreground/10 text-foreground'
						: 'text-muted-foreground hover:text-foreground'
				].join(' ')}
				onclick={() => (kind = 'book')}
				disabled={!!lockedBookId}
				aria-pressed={kind === 'book'}
			>
				Book
			</button>
			<button
				type="button"
				class={[
					'rounded-md px-3 py-1.5 font-medium transition-colors',
					kind === 'essay'
						? 'bg-foreground/10 text-foreground'
						: 'text-muted-foreground hover:text-foreground',
					!FEATURE_ESSAYS_UI && 'cursor-not-allowed opacity-50'
				].join(' ')}
				onclick={() => FEATURE_ESSAYS_UI && (kind = 'essay')}
				disabled={!FEATURE_ESSAYS_UI || !!lockedBookId}
				title={!FEATURE_ESSAYS_UI ? 'Essays UI ships post-fall' : undefined}
				aria-pressed={kind === 'essay'}
			>
				Essay
			</button>
		</div>

		<div class="flex-1">
			{#if kind === 'book'}
				{#if lockedBookId}
					<div
						class="flex h-11 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground"
					>
						{bookSelectLabel}
					</div>
				{:else}
					<Select.Root type="single" bind:value={bookId} items={bookItems}>
						<Select.Trigger
							id="src-picker-book"
							size="default"
							class="h-11 w-full justify-between px-3"
						>
							<span data-slot="select-value" class="truncate text-left">{bookSelectLabel}</span>
						</Select.Trigger>
						<Select.Content class="max-h-72">
							{#each bookItems as b (b.value)}
								<Select.Item value={b.value} label={b.label} class="min-h-10 py-2">
									{b.label}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				{/if}
			{:else}
				<div
					class="flex h-11 items-center rounded-md border border-dashed border-border bg-muted/20 px-3 text-sm text-muted-foreground"
				>
					Essays UI ships post-fall (FEATURE_ESSAYS_UI = false)
				</div>
			{/if}
		</div>
	</div>
</div>

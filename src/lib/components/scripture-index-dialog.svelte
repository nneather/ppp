<script lang="ts">
	import { browser } from '$app/environment';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import ScriptureIndexRow from '$lib/components/scripture-index-row.svelte';
	import {
		passageSearchHref,
		type BibleBookTally
	} from '$lib/library/scripture-index';
	import type { ScriptureIndexRefRow } from '$lib/library/server/scripture-index-loaders';
	import { cn } from '$lib/utils.js';

	let {
		open = $bindable(false),
		bookId,
		bibleBook,
		bookTally = null,
		scope = 'volume',
		showVolume = false,
		highlightRefId = null,
		/** `undefined` = auto first numbered chapter; `null` = whole-book chip; number = chapter. */
		initialChapter = undefined,
		onEdit,
		onDelete
	}: {
		open?: boolean;
		bookId: string;
		bibleBook: string;
		bookTally?: BibleBookTally | null;
		scope?: 'volume' | 'set';
		showVolume?: boolean;
		highlightRefId?: string | null;
		initialChapter?: number | null;
		onEdit?: (id: string) => void;
		onDelete?: (id: string) => void;
	} = $props();

	/** `undefined` = not seeded yet; `null` = whole-book; number = chapter. */
	let chapterFilter = $state<number | null | undefined>(undefined);
	let rows = $state<ScriptureIndexRefRow[]>([]);
	let filteredCount = $state(0);
	let loading = $state(false);
	let errorMsg = $state<string | null>(null);
	let loadToken = 0;
	let seededFor = $state<string | null>(null);

	const chapters = $derived(bookTally?.chapters ?? []);

	function pickDefaultChapter(
		chs: { chapter: number | null; count: number }[],
		prefer: number | null | undefined
	): number | null | undefined {
		if (prefer !== undefined) return prefer;
		const firstNum = chs.find((c) => c.chapter != null)?.chapter;
		if (firstNum != null) return firstNum;
		if (chs.some((c) => c.chapter == null)) return null;
		return undefined;
	}

	$effect(() => {
		if (!open) {
			seededFor = null;
			chapterFilter = undefined;
			return;
		}
		const prefer = initialChapter;
		const key = `${bibleBook}|${scope}|${prefer === undefined ? 'auto' : prefer === null ? 'book' : prefer}`;
		if (seededFor !== key) {
			seededFor = key;
			chapterFilter = pickDefaultChapter(chapters, prefer);
			rows = [];
			return;
		}
		if (chapterFilter === undefined && chapters.length > 0) {
			chapterFilter = pickDefaultChapter(chapters, prefer);
		}
	});

	$effect(() => {
		if (!browser || !open || !bibleBook) return;
		const ch = chapterFilter;
		// Wait until seeded (unless this bible book has no chapter chips yet and we still want a load).
		if (ch === undefined && chapters.length > 0) return;
		const token = ++loadToken;
		loading = true;
		errorMsg = null;
		const params = new URLSearchParams();
		params.set('bible_book', bibleBook);
		params.set('scope', scope);
		if (ch === null) params.set('whole_book', '1');
		else if (ch != null) params.set('chapter', String(ch));
		params.set('limit', '500');
		void fetch(`/library/books/${bookId}/scripture-refs.json?${params}`)
			.then(async (res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return (await res.json()) as {
					rows: ScriptureIndexRefRow[];
					filteredCount?: number;
				};
			})
			.then((data) => {
				if (token !== loadToken) return;
				rows = data.rows ?? [];
				filteredCount = data.filteredCount ?? rows.length;
			})
			.catch((err: unknown) => {
				if (token !== loadToken) return;
				errorMsg = err instanceof Error ? err.message : 'Failed to load.';
				rows = [];
				filteredCount = 0;
			})
			.finally(() => {
				if (token === loadToken) loading = false;
			});
	});

	$effect(() => {
		if (!browser || !open || !highlightRefId || loading) return;
		const id = highlightRefId;
		if (!rows.some((r) => r.id === id)) return;
		queueMicrotask(() => {
			requestAnimationFrame(() => {
				document.getElementById(`ref-${id}`)?.scrollIntoView({
					behavior: 'smooth',
					block: 'center'
				});
			});
		});
	});

	const searchHref = $derived(
		passageSearchHref({
			bibleBook,
			chapter: typeof chapterFilter === 'number' ? chapterFilter : null,
			verse: null
		})
	);

	const showChapterStrip = $derived(chapters.length > 1);
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="flex max-h-[min(92dvh,900px)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
	>
		<Dialog.Header class="shrink-0 space-y-1 border-b border-border px-4 py-4 pr-12 text-left sm:px-5">
			<Dialog.Title>{bibleBook}</Dialog.Title>
			<Dialog.Description class="text-sm text-muted-foreground">
				{bookTally?.count ?? rows.length} reference{(bookTally?.count ?? rows.length) === 1
					? ''
					: 's'}
				{#if scope === 'set'}
					· whole set
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		{#if showChapterStrip}
			<div
				class="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border px-4 py-2.5 sm:px-5"
				role="tablist"
				aria-label="Chapters"
			>
				{#each chapters as chip (chip.chapter ?? 'book')}
					<button
						type="button"
						role="tab"
						aria-selected={chapterFilter === chip.chapter}
						class={cn(
							'shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors',
							chapterFilter === chip.chapter
								? 'border-foreground bg-foreground text-background'
								: 'border-border bg-card text-muted-foreground hover:text-foreground'
						)}
						onclick={() => (chapterFilter = chip.chapter)}
					>
						{chip.chapter == null ? 'Book' : chip.chapter}
						<span class="opacity-70">({chip.count})</span>
					</button>
				{/each}
			</div>
		{/if}

		<div class="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
			{#if loading}
				<p class="py-8 text-center text-sm text-muted-foreground">Loading…</p>
			{:else if errorMsg}
				<p class="py-8 text-center text-sm text-destructive">{errorMsg}</p>
			{:else if rows.length === 0}
				<p class="py-8 text-center text-sm text-muted-foreground">
					{chapterFilter === null ? 'No whole-book references.' : 'No references in this chapter.'}
				</p>
			{:else}
				{#if filteredCount > rows.length}
					<p class="mb-2 text-xs text-muted-foreground">
						Showing {rows.length.toLocaleString()} of {filteredCount.toLocaleString()}.
					</p>
				{/if}
				<ul class="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-card text-sm">
					{#each rows as row (row.id)}
						<ScriptureIndexRow
							ref={row}
							{showVolume}
							highlighted={highlightRefId === row.id}
							onEdit={onEdit}
							onDelete={onDelete}
						/>
					{/each}
				</ul>
			{/if}
		</div>

		<Dialog.Footer
			class="shrink-0 flex-row items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5"
		>
			<a
				href={searchHref}
				class="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
			>
				Open in passage search
				<ExternalLink class="size-3.5" />
			</a>
			<Button type="button" variant="outline" size="sm" hotkey="Escape" label="Close" onclick={() => (open = false)} />
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

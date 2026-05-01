<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Search from '@lucide/svelte/icons/search';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import type { PassageResult } from '$lib/types/library';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Initialize empty then hydrate via $effect so the form re-syncs on back/
	// forward navigation (and to silence the state_referenced_locally warning).
	let bibleBook = $state('');
	let chapter = $state('');
	let verse = $state('');
	$effect(() => {
		bibleBook = data.query.bible_book ?? '';
		chapter = data.query.chapter != null ? String(data.query.chapter) : '';
		verse = data.query.verse != null ? String(data.query.verse) : '';
	});

	function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		const params = new URLSearchParams();
		if (bibleBook) params.set('bible_book', bibleBook);
		if (chapter.trim()) params.set('chapter', chapter.trim());
		if (verse.trim()) params.set('verse', verse.trim());
		const qs = params.toString();
		goto('/library/search-passage' + (qs ? `?${qs}` : ''), {
			replaceState: false,
			keepFocus: true,
			noScroll: true
		});
	}

	function fmtRef(r: PassageResult): string {
		const cs = r.chapter_start;
		const vs = r.verse_start;
		const ce = r.chapter_end;
		const ve = r.verse_end;
		if (cs == null && ce == null) return r.bible_book;
		const startPart =
			cs != null && vs != null ? `${cs}:${vs}` : cs != null ? `${cs}` : '';
		const endPart = ce != null && ve != null ? `${ce}:${ve}` : ce != null ? `${ce}` : '';
		let rangeText = startPart;
		if (endPart && endPart !== startPart) {
			if (cs != null && ce != null && cs === ce && ve != null && ve !== vs) {
				rangeText = `${startPart}–${ve}`;
			} else {
				rangeText = `${startPart}–${endPart}`;
			}
		}
		return `${r.bible_book} ${rangeText}`.trim();
	}

	function fmtPages(r: PassageResult): string {
		if (!r.page_start) return '';
		const end = r.page_end ?? '';
		return end && end !== r.page_start
			? `pp. ${r.page_start}–${end}`
			: `p. ${r.page_start}`;
	}

	const hasQuery = $derived(Boolean(data.query.bible_book));
	const queryLabel = $derived.by(() => {
		const q = data.query;
		if (!q.bible_book) return '';
		const parts = [q.bible_book];
		if (q.chapter != null) {
			parts.push(' ' + String(q.chapter));
			if (q.verse != null) parts.push(':' + String(q.verse));
		}
		return parts.join('');
	});
</script>

<svelte:head>
	<title>Search passage — Library — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
	<a
		href="/library"
		class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> Library
	</a>

	<header class="mt-3 flex items-center gap-2 text-muted-foreground">
		<Search class="size-6" />
		<h1 class="text-2xl font-semibold tracking-tight text-foreground">Search passage</h1>
	</header>
	<p class="mt-1 text-sm text-muted-foreground">
		Find every book in your library that engages a passage. Includes overlapping
		ranges (a book covering Phil 2:1–11 surfaces on a search for Phil 2:5).
	</p>

	<form
		onsubmit={onSubmit}
		class="mt-5 flex flex-col gap-4 sm:grid sm:grid-cols-[1fr_5.5rem_5.5rem_auto] sm:gap-3"
	>
		<div class="min-w-0">
			<label
				for="bible_book"
				class="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
			>
				Bible book
			</label>
			<select
				id="bible_book"
				bind:value={bibleBook}
				class="h-12 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base sm:h-10 sm:text-sm"
				required
			>
				<option value="" disabled>— Select —</option>
				{#each data.bibleBookNames as name (name)}
					<option value={name}>{name}</option>
				{/each}
			</select>
		</div>
		<div>
			<label
				for="chapter"
				class="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
			>
				Chapter
			</label>
			<Input
				id="chapter"
				type="number"
				inputmode="numeric"
				min="1"
				bind:value={chapter}
				placeholder="—"
				class="h-12 min-h-11 text-base tabular-nums sm:h-10 sm:text-sm"
			/>
		</div>
		<div>
			<label
				for="verse"
				class="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
			>
				Verse
			</label>
			<Input
				id="verse"
				type="number"
				inputmode="numeric"
				min="1"
				bind:value={verse}
				placeholder="—"
				class="h-12 min-h-11 text-base tabular-nums sm:h-10 sm:text-sm"
			/>
		</div>
		<div class="flex items-end pt-1 sm:pt-0">
			<Button type="submit" class="h-12 min-h-11 w-full text-base sm:h-10 sm:w-auto sm:text-sm" hotkey="s">
				<Search class="size-4" /> <HotkeyLabel label="Search" mnemonic="s" />
			</Button>
		</div>
	</form>

	{#if data.queryError}
		<p class="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{data.queryError}
		</p>
	{/if}

	{#if hasQuery}
		<div class="mt-6 flex flex-wrap items-baseline justify-between gap-2 sm:gap-3">
			<h2 class="text-lg font-semibold tracking-tight text-foreground sm:text-base">
				{queryLabel}
			</h2>
			<span class="text-sm tabular-nums text-muted-foreground">
				{data.results.length} match{data.results.length === 1 ? '' : 'es'}
			</span>
		</div>

		{#if data.results.length === 0}
			<div class="mt-3 rounded-xl border border-dashed border-border p-8 text-center">
				<BookOpen class="mx-auto size-8 text-muted-foreground" />
				<p class="mt-3 text-sm text-muted-foreground">
					No references match this passage in your library yet.
				</p>
			</div>
		{:else}
			<ul class="mt-3 flex flex-col gap-3 sm:gap-2">
				{#each data.results as r (r.ref_id)}
					<li>
						<a
							href={r.book_id
								? r.source_kind === 'ref'
									? `/library/books/${r.book_id}#ref-${r.ref_id}`
									: `/library/books/${r.book_id}`
								: '#'}
							class="block min-h-[4.5rem] rounded-lg border border-border bg-card px-4 py-4 text-card-foreground transition-colors active:bg-muted/30 hover:border-ring/60 hover:bg-muted/20 sm:min-h-0 sm:p-3"
						>
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div class="min-w-0 flex-1">
									<p
										class="break-words text-base font-medium leading-snug text-foreground sm:truncate sm:text-sm sm:leading-normal"
									>
										{#if r.book_title}
											{r.book_title}
										{:else if r.essay_id}
											<span class="italic text-muted-foreground">(essay)</span>
										{:else}
											<span class="italic text-muted-foreground">(untitled)</span>
										{/if}
									</p>
									{#if r.book_subtitle}
										<p
											class="mt-0.5 break-words text-sm leading-snug text-muted-foreground sm:truncate sm:text-xs sm:leading-normal"
										>
											{r.book_subtitle}
										</p>
									{/if}
									<p class="mt-2 text-sm text-muted-foreground sm:mt-1 sm:text-xs">
										<span class="font-medium text-foreground">{fmtRef(r)}</span>
										{#if fmtPages(r)}
											<span class="ml-1.5">{fmtPages(r)}</span>
										{/if}
									</p>
									{#if r.review_note}
										<p class="mt-1.5 text-sm italic text-muted-foreground sm:text-xs">{r.review_note}</p>
									{/if}
								</div>
								<div class="flex w-full shrink-0 flex-wrap gap-1.5 sm:w-auto sm:gap-1">
									{#if r.source_kind === 'coverage'}
										<span
											class="inline-flex min-h-8 items-center rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-sky-700 sm:min-h-0 sm:px-2 sm:py-0.5 sm:text-[10px] dark:text-sky-200"
											title="Book tagged as covering this bible book; no specific page entry yet."
										>
											Coverage
										</span>
									{:else if r.manual_entry}
										<span
											class="inline-flex min-h-8 items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-700 sm:min-h-0 sm:px-2 sm:py-0.5 sm:text-[10px] dark:text-emerald-200"
										>
											Manual
										</span>
									{:else if r.confidence_score != null}
										<span
											class="inline-flex min-h-8 items-center rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:min-h-0 sm:px-2 sm:py-0.5 sm:text-[10px]"
											title="OCR confidence"
										>
											{Math.round(r.confidence_score * 100)}%
										</span>
									{/if}
									{#if r.needs_review}
										<span
											class="inline-flex min-h-8 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-800 sm:min-h-0 sm:px-2 sm:py-0.5 sm:text-[10px] dark:text-amber-200"
										>
											<AlertCircle class="size-3.5 shrink-0 sm:size-3" /> Review
										</span>
									{/if}
								</div>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

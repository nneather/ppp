<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import Search from '@lucide/svelte/icons/search';
	import PageHeader from '$lib/components/page-header.svelte';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import type { PassageResult } from '$lib/types/library';
	import {
		PASSAGE_BAND_LABELS,
		PASSAGE_BAND_ORDER,
		type PassageBand
	} from '$lib/library/passage-search-bands';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Initialize empty then hydrate via $effect so the form re-syncs on back/
	// forward navigation (and to silence the state_referenced_locally warning).
	let bibleBook = $state('');
	let chapter = $state('');
	let verse = $state('');
	let verseEnd = $state('');
	$effect(() => {
		bibleBook = data.query.bible_book ?? '';
		chapter = data.query.chapter != null ? String(data.query.chapter) : '';
		verse = data.query.verse != null ? String(data.query.verse) : '';
		verseEnd = data.query.verse_end != null ? String(data.query.verse_end) : '';
	});

	const backHref = $derived(data.returnTo ?? '/library');
	const backLabel = $derived(
		data.returnTo?.startsWith('/sermons') || data.returnTo?.startsWith('/studies')
			? 'Studies'
			: 'Library'
	);

	function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		const params = new URLSearchParams();
		if (bibleBook) params.set('bible_book', bibleBook);
		if (chapter.trim()) params.set('chapter', chapter.trim());
		if (verse.trim()) params.set('verse', verse.trim());
		if (verseEnd.trim()) params.set('verse_end', verseEnd.trim());
		if (data.query.chapter_end != null) {
			params.set('chapter_end', String(data.query.chapter_end));
		}
		if (data.returnTo) params.set('returnTo', data.returnTo);
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

	function hrefFor(r: PassageResult): string {
		if (!r.book_id) return '#';
		if (r.source_kind === 'index') return `/library/books/${r.book_id}#ref-${r.ref_id}`;
		if (r.source_kind === 'section') return `/library/books/${r.book_id}#section-${r.ref_id}`;
		return `/library/books/${r.book_id}`;
	}

	const hasQuery = $derived(Boolean(data.query.bible_book));
	const queryLabel = $derived.by(() => {
		const q = data.query;
		if (!q.bible_book) return '';
		if (q.chapter == null) return q.bible_book;
		if (q.verse == null) {
			if (q.chapter_end != null && q.chapter_end !== q.chapter) {
				return `${q.bible_book} ${q.chapter}–${q.chapter_end}`;
			}
			return `${q.bible_book} ${q.chapter}`;
		}
		let s = `${q.bible_book} ${q.chapter}:${q.verse}`;
		if (q.verse_end != null && (q.chapter_end == null || q.chapter_end === q.chapter)) {
			if (q.verse_end !== q.verse) s += `–${q.verse_end}`;
		} else if (q.chapter_end != null && q.verse_end != null) {
			s += `–${q.chapter_end}:${q.verse_end}`;
		}
		return s;
	});

	const bands = $derived.by(() => {
		const byBand = new Map<PassageBand, PassageResult[]>();
		for (const band of PASSAGE_BAND_ORDER) byBand.set(band, []);
		for (const r of data.results) {
			const list = byBand.get(r.source_kind as PassageBand);
			if (list) list.push(r);
		}
		return PASSAGE_BAND_ORDER.map((band) => ({
			band,
			label: PASSAGE_BAND_LABELS[band],
			rows: byBand.get(band) ?? []
		})).filter((b) => b.rows.length > 0);
	});
</script>

<svelte:head>
	<title>Search passage — Library — ppp</title>
</svelte:head>

{#snippet searchPassageLead()}
	<Search class="size-6" />
{/snippet}

{#snippet searchPassageMeta()}
	<p class="text-sm text-muted-foreground">
		Find every book in your library that engages a passage. Commentaries and curated
		sections lead; the scripture index stays below for the eventual backload.
	</p>
{/snippet}

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
	<PageHeader
		back={{ href: backHref, label: backLabel }}
		title="Search passage"
		lead={searchPassageLead}
		meta={searchPassageMeta}
		class="mb-4"
	/>

	<form
		onsubmit={onSubmit}
		class="mt-5 flex flex-col gap-4 sm:grid sm:grid-cols-[1fr_5rem_5rem_5rem_auto] sm:gap-3"
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
		<div>
			<label
				for="verse_end"
				class="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
			>
				End
			</label>
			<Input
				id="verse_end"
				type="number"
				inputmode="numeric"
				min="1"
				bind:value={verseEnd}
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
			{#each bands as band (band.band)}
				<div class="mt-5">
					<h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						{band.label}
						<span class="ml-1 font-normal tabular-nums">({band.rows.length})</span>
					</h3>
					<ul class="mt-2 flex flex-col gap-3 sm:gap-2">
						{#each band.rows as r (r.ref_id)}
							<li>
								<a
									href={hrefFor(r)}
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
											{#if r.section_label}
												<p class="mt-1 text-sm text-muted-foreground sm:text-xs">
													{r.section_label}
												</p>
											{/if}
											{#if r.source_kind === 'section' || r.source_kind === 'index'}
												<p class="mt-2 text-sm text-muted-foreground sm:mt-1 sm:text-xs">
													<span class="font-medium text-foreground">{fmtRef(r)}</span>
													{#if fmtPages(r)}
														<span class="ml-1.5">{fmtPages(r)}</span>
													{/if}
												</p>
											{:else if r.source_kind === 'commentary' || r.source_kind === 'coverage'}
												<p class="mt-2 text-sm text-muted-foreground sm:mt-1 sm:text-xs">
													{r.bible_book}
												</p>
											{/if}
											{#if r.review_note}
												<p class="mt-1.5 text-sm italic text-muted-foreground sm:text-xs">
													{r.review_note}
												</p>
											{/if}
										</div>
										<div class="flex w-full shrink-0 flex-wrap gap-1.5 sm:w-auto sm:gap-1">
											{#if r.source_kind === 'commentary'}
												<span
													class="inline-flex min-h-8 items-center rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-violet-800 sm:min-h-0 sm:px-2 sm:py-0.5 sm:text-[10px] dark:text-violet-200"
												>
													Commentary
												</span>
											{:else if r.source_kind === 'section'}
												<span
													class="inline-flex min-h-8 items-center rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-indigo-800 sm:min-h-0 sm:px-2 sm:py-0.5 sm:text-[10px] dark:text-indigo-200"
													title="Curated section with page range for this passage."
												>
													Section
												</span>
											{:else if r.source_kind === 'coverage'}
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
				</div>
			{/each}
		{/if}
	{/if}
</div>

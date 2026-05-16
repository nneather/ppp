<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { disableScrollHandling, goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { tick, untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Trophy from '@lucide/svelte/icons/trophy';
	import {
		GENRES,
		IMPORT_MATCH_TYPE_LABELS,
		LANGUAGES,
		LANGUAGE_LABELS,
		READING_STATUSES,
		READING_STATUS_LABELS
	} from '$lib/types/library';
	import type {
		Genre,
		ImportMatchType,
		Language,
		ReadingStatus,
		ReviewCard,
		ReviewQueueFilters
	} from '$lib/types/library';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// -------------------------------------------------------------------------
	// Card stack — local state seeded from the server load, refilled by the
	// `/library/review/queue` JSON endpoint when low.
	// -------------------------------------------------------------------------

	// Initial seed via untrack so Svelte's "state references local data on
	// mount only" warning doesn't fire — the $effect below re-seeds when
	// the URL filters change.
	let cards = $state<ReviewCard[]>(untrack(() => data.cards));
	let remaining = $state<number>(untrack(() => data.remaining));
	let reviewedThisSession = $state(0);
	/** Skipped + just-saved ids — passed back to the queue endpoint to avoid replays. */
	let excludedIds = $state<Set<string>>(new Set());
	/** Skipped cards only — Back can return one to the front of the stack. */
	let skippedStack = $state<ReviewCard[]>([]);
	let refilling = $state(false);

	let previousUrlSearch = $state<string | undefined>(undefined);

	const currentCard = $derived<ReviewCard | null>(cards.length > 0 ? cards[0] : null);

	// Per-card edit state — null means "leave field as-is".
	let editTitle = $state<string | null>(null);
	let editYear = $state<string | null>(null);
	let editPublisher = $state<string | null>(null);
	let editGenre = $state<Genre | null>(null);
	let editLanguage = $state<Language | null>(null);
	let editReadingStatus = $state<ReadingStatus | null>(null);
	let pendingSaveId = $state<string | null>(null);
	let confirmDeleteOpen = $state(false);
	let confirmDeletePending = $state(false);

	/** Collapsed chip rows default closed when the server already has a value. */
	let metaGenreExpanded = $state(false);
	let metaStatusExpanded = $state(false);
	let metaLangExpanded = $state(false);

	/**
	 * Re-seed only when the queue URL changes (slice / filters), not when `data`
	 * refreshes after a form action — otherwise excludedIds and the local stack reset.
	 */
	$effect(() => {
		const search = page.url.search;
		const seedCards = data.cards;
		const seedRemaining = data.remaining;
		if (previousUrlSearch === undefined) {
			previousUrlSearch = search;
			return;
		}
		if (search === previousUrlSearch) return;
		previousUrlSearch = search;
		cards = seedCards;
		remaining = seedRemaining;
		excludedIds = new Set();
		skippedStack = [];
		pendingSaveId = null;
		editTitle = null;
		editYear = null;
		editPublisher = null;
		editGenre = null;
		editLanguage = null;
		editReadingStatus = null;
		confirmDeleteOpen = false;
	});

	function resetEditState() {
		editTitle = null;
		editYear = null;
		editPublisher = null;
		editGenre = null;
		editLanguage = null;
		editReadingStatus = null;
	}

	/** When the visible card changes, clear in-progress edits and metadata row layout. */
	$effect(() => {
		const c = currentCard;
		const id = c?.id;
		untrack(() => {
			if (id !== pendingSaveId) {
				resetEditState();
				confirmDeleteOpen = false;
				if (c) {
					metaGenreExpanded = !c.genre;
					metaStatusExpanded = false;
					metaLangExpanded = false;
				}
			}
		});
	});

	async function scrollReviewCardIntoView() {
		if (!browser) return;
		await tick();
		document.getElementById('review-card')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
	}

	// -------------------------------------------------------------------------
	// Refetch when the local stack runs low. Pulls the next batch via the JSON
	// endpoint, excluding everything the user has already touched this session.
	// -------------------------------------------------------------------------

	const REFETCH_THRESHOLD = 3;

	async function refillIfLow() {
		if (refilling) return;
		if (cards.length > REFETCH_THRESHOLD) return;
		if (remaining === 0) return;
		if (!browser) return;
		refilling = true;
		try {
			const params = new URLSearchParams(page.url.searchParams);
			params.set('exclude', Array.from(excludedIds).join(','));
			params.set('limit', String(data.queuePageSize));
			const res = await fetch(`/library/review/queue?${params.toString()}`);
			if (!res.ok) return;
			const body = (await res.json()) as { cards: ReviewCard[]; remaining: number };
			const knownIds = new Set(cards.map((c) => c.id));
			const fresh = body.cards.filter((c) => !knownIds.has(c.id) && !excludedIds.has(c.id));
			cards = [...cards, ...fresh];
			remaining = body.remaining;
		} finally {
			refilling = false;
		}
	}

	function advance(savedOrSkippedId: string) {
		excludedIds = new Set([...excludedIds, savedOrSkippedId]);
		cards = cards.filter((c) => c.id !== savedOrSkippedId);
		void refillIfLow();
		void scrollReviewCardIntoView();
	}

	function goBackToSkipped() {
		if (skippedStack.length === 0) return;
		const prev = skippedStack[skippedStack.length - 1];
		skippedStack = skippedStack.slice(0, -1);
		excludedIds = new Set([...excludedIds].filter((id) => id !== prev.id));
		cards = [prev, ...cards];
		void scrollReviewCardIntoView();
	}

	// -------------------------------------------------------------------------
	// Form submitters
	// -------------------------------------------------------------------------

	function saveSubmit(): SubmitFunction {
		return ({ formData }) => {
			const id = String(formData.get('id') ?? '');
			pendingSaveId = id;
			return async ({ result, update }) => {
				disableScrollHandling();
				await update({ reset: false, invalidateAll: false });
				if (result.type === 'success') {
					reviewedThisSession += 1;
					remaining = Math.max(0, remaining - 1);
					advance(id);
				}
				pendingSaveId = null;
			};
		};
	}

	function skipCurrent() {
		if (!currentCard) return;
		skippedStack = [...skippedStack, currentCard];
		advance(currentCard.id);
	}

	function deleteSubmit(): SubmitFunction {
		return ({ formData }) => {
			const id = String(formData.get('id') ?? '');
			confirmDeletePending = true;
			return async ({ result, update }) => {
				disableScrollHandling();
				await update({ reset: false, invalidateAll: false });
				confirmDeletePending = false;
				confirmDeleteOpen = false;
				if (result.type === 'success') {
					remaining = Math.max(0, remaining - 1);
					advance(id);
				}
			};
		};
	}

	// -------------------------------------------------------------------------
	// Slice pills (subject + match_type) — URL is the source of truth.
	// -------------------------------------------------------------------------

	type SliceSpec = {
		key: string;
		label: string;
		filters: ReviewQueueFilters;
	};

	const SLICES: SliceSpec[] = [
		{ key: 'all', label: 'All', filters: {} },
		{ key: 'subject_blank', label: 'No subject', filters: { subject_blank: true } },
		{
			key: 'no_match',
			label: 'No OL match',
			filters: { import_match_type: ['no-match'] }
		},
		{
			key: 'title_only',
			label: 'Title-only OL',
			filters: { import_match_type: ['title-only'] }
		}
	];

	function isSliceActive(slice: SliceSpec): boolean {
		if (slice.key === 'all') {
			return (
				!data.filters.subject_blank &&
				(!data.filters.import_match_type || data.filters.import_match_type.length === 0)
			);
		}
		if (slice.filters.subject_blank) return data.filters.subject_blank === true;
		if (slice.filters.import_match_type) {
			const wanted = slice.filters.import_match_type;
			const have = data.filters.import_match_type ?? [];
			return wanted.length === have.length && wanted.every((m) => have.includes(m));
		}
		return false;
	}

	function gotoSlice(slice: SliceSpec) {
		if (!browser) return;
		const url = new URL(page.url);
		// Strip subject + match_type but keep other filter params (genre, language, …).
		url.searchParams.delete('subject');
		url.searchParams.delete('match_type');
		if (slice.filters.subject_blank) url.searchParams.set('subject', 'blank');
		if (slice.filters.import_match_type) {
			for (const m of slice.filters.import_match_type) url.searchParams.append('match_type', m);
		}
		goto(url.pathname + (url.search ? url.search : ''), {
			keepFocus: true,
			noScroll: true
		});
	}

	// -------------------------------------------------------------------------
	// Card-level helpers
	// -------------------------------------------------------------------------

	function chipClasses(active: boolean): string {
		return active
			? 'border-primary bg-primary text-primary-foreground'
			: 'border-border bg-background text-foreground hover:bg-muted';
	}

	function effectiveTitle(c: ReviewCard): string | null {
		return editTitle !== null ? editTitle.trim() || null : c.title;
	}
	function effectiveYear(c: ReviewCard): number | null {
		if (editYear === null) return c.year;
		const t = editYear.trim();
		if (!t) return null;
		const n = Number(t);
		return Number.isFinite(n) && Number.isInteger(n) ? n : c.year;
	}
	function effectivePublisher(c: ReviewCard): string | null {
		return editPublisher !== null ? editPublisher.trim() || null : c.publisher;
	}
	function effectiveGenre(c: ReviewCard): Genre | null {
		return editGenre !== null ? editGenre : (c.genre as Genre | null);
	}
	function effectiveLanguage(c: ReviewCard): Language {
		return editLanguage ?? c.language;
	}
	function effectiveReadingStatus(c: ReviewCard): ReadingStatus {
		return editReadingStatus ?? c.reading_status;
	}

	/** Author counts as "present" iff the card already shows authors. */
	function previewMissing(c: ReviewCard): string[] {
		const out: string[] = [];
		if (!effectiveTitle(c)) out.push('title');
		if (!c.authors_label) out.push('author');
		if (!effectiveGenre(c)) out.push('genre');
		if (effectiveYear(c) == null) out.push('year');
		if (!effectivePublisher(c)) out.push('publisher');
		return out;
	}

	function matchTypeLabel(mt: ImportMatchType | null): string | null {
		return mt ? IMPORT_MATCH_TYPE_LABELS[mt] : null;
	}

	function autoLinePart(note: string | null): string | null {
		if (!note) return null;
		const m = note.match(/^Missing:\s[^\n]*/);
		return m ? m[0] : null;
	}
	function userNotePart(note: string | null): string | null {
		if (!note) return null;
		const stripped = note.replace(/^Missing:\s[^\n]*\r?\n\r?\n?/, '').trim();
		return stripped.length > 0 && stripped !== note ? stripped : (autoLinePart(note) ? null : note);
	}

	// -------------------------------------------------------------------------
	// Hotkey: Esc → skip+next (the form Save button itself owns `s`).
	// -------------------------------------------------------------------------

	function onKey(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (e.defaultPrevented) return;
		if (confirmDeleteOpen) return; // ConfirmDialog owns its own Esc
		if (!currentCard) return;
		// Ignore when typing in an input — let the field own Esc.
		const target = e.target as HTMLElement | null;
		if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
		e.preventDefault();
		skipCurrent();
	}
</script>

<svelte:head>
	<title>Review queue — Library — ppp</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

<div class="mx-auto flex min-h-screen max-w-md flex-col px-4 py-4 md:max-w-lg md:py-6">
	<header class="flex items-center justify-between gap-3">
		<a
			href="/library"
			class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="size-4" /> Library
		</a>
		<div class="text-right text-xs text-muted-foreground">
			<div class="font-medium text-foreground">
				<CheckCircle2 class="inline-block size-3.5 text-emerald-600" />
				{reviewedThisSession} reviewed
			</div>
			<div>{remaining.toLocaleString()} left in this slice</div>
		</div>
	</header>

	<!-- Slice pill rail -->
	<div class="mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
		{#each SLICES as s (s.key)}
			{@const active = isSliceActive(s)}
			<button
				type="button"
				class={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition-colors ${chipClasses(active)}`}
				onclick={() => gotoSlice(s)}
				aria-pressed={active}
			>
				{s.label}
			</button>
		{/each}
	</div>

	<div class="mt-4 flex-1">
		{#if currentCard}
			{@const card = currentCard}
			{@const missing = previewMissing(card)}
			{@const auto = autoLinePart(card.needs_review_note)}
			{@const userNote = userNotePart(card.needs_review_note)}
			{@const genreRowOpen = !card.genre || editGenre !== null || metaGenreExpanded}
			{@const statusRowOpen = editReadingStatus !== null || metaStatusExpanded}
			{@const langRowOpen = editLanguage !== null || metaLangExpanded}
			<article
				id="review-card"
				class="rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm"
			>
				<!-- Title block -->
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						{#if card.title}
							<h2 class="text-lg font-semibold leading-snug">{card.title}</h2>
						{:else}
							<h2 class="text-lg italic text-muted-foreground">(untitled)</h2>
						{/if}
						{#if card.subtitle}
							<p class="mt-0.5 text-sm text-muted-foreground">{card.subtitle}</p>
						{/if}
						{#if card.authors_label}
							<p class="mt-1 text-xs text-muted-foreground">{card.authors_label}</p>
						{:else}
							<p class="mt-1 text-xs italic text-amber-700 dark:text-amber-300">No author on file</p>
						{/if}
					</div>
					<div class="flex flex-col items-end gap-1 text-right">
						{#if card.import_match_type}
							<span
								class="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
								title="Open Library match type at import"
							>
								{matchTypeLabel(card.import_match_type)}
							</span>
						{/if}
						{#if card.series_abbreviation}
							<span
								class="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
								title={card.series_name ?? undefined}
							>
								{card.series_abbreviation}{#if card.volume_number}, vol. {card.volume_number}{/if}
							</span>
						{/if}
					</div>
				</div>

				<!-- Auto-line + user note -->
				{#if auto}
					<div
						class="mt-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-900 dark:text-amber-100"
					>
						<AlertCircle class="mt-0.5 size-3.5 flex-shrink-0" />
						<div class="flex-1">{auto}</div>
					</div>
				{/if}
				{#if userNote}
					<p class="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{userNote}</p>
				{/if}

				<!-- Quick-edit form -->
				<form
					method="POST"
					action="?/saveReviewed"
					use:enhance={saveSubmit()}
					class="mt-4 flex flex-col gap-4"
				>
					<input type="hidden" name="id" value={card.id} />

					<!-- Citation-critical text fields -->
					<div class="flex flex-col gap-3">
						{#if !card.title}
							<label class="flex flex-col gap-1 text-xs">
								<span class="font-medium text-muted-foreground">Title</span>
								<Input
									name="title"
									type="text"
									autocomplete="off"
									placeholder={card.title ?? 'Add a title…'}
									value={editTitle ?? ''}
									oninput={(e) =>
										(editTitle = (e.currentTarget as HTMLInputElement).value)}
								/>
							</label>
						{/if}
						{#if card.year == null}
							<label class="flex flex-col gap-1 text-xs">
								<span class="font-medium text-muted-foreground">Year</span>
								<Input
									name="year"
									type="text"
									inputmode="numeric"
									autocomplete="off"
									placeholder="e.g. 1987"
									value={editYear ?? ''}
									oninput={(e) =>
										(editYear = (e.currentTarget as HTMLInputElement).value)}
								/>
							</label>
						{/if}
						{#if !card.publisher}
							<label class="flex flex-col gap-1 text-xs">
								<span class="font-medium text-muted-foreground">Publisher</span>
								<Input
									name="publisher"
									type="text"
									autocomplete="off"
									placeholder="e.g. Eerdmans"
									value={editPublisher ?? ''}
									oninput={(e) =>
										(editPublisher = (e.currentTarget as HTMLInputElement).value)}
								/>
							</label>
						{/if}
					</div>

					<!-- Genre chip row -->
					<div>
						{#if genreRowOpen}
							<div class="mb-1.5 text-xs font-medium text-muted-foreground">Genre</div>
							<div class="flex flex-wrap gap-1.5">
								{#each GENRES as g (g)}
									{@const active = effectiveGenre(card) === g}
									<button
										type="button"
										class={`rounded-full border px-2.5 py-1 text-xs transition-colors ${chipClasses(active)}`}
										onclick={() => {
											metaGenreExpanded = true;
											editGenre = active ? null : g;
										}}
										aria-pressed={active}
									>
										{g}
									</button>
								{/each}
								{#if effectiveGenre(card)}
									<button
										type="button"
										class="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
										onclick={() => (editGenre = null as unknown as Genre)}
										title="Clear genre"
									>
										clear
									</button>
								{/if}
							</div>
						{:else}
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/30 px-2 py-2 text-left hover:bg-muted/50"
								onclick={() => (metaGenreExpanded = true)}
							>
								<ChevronRight
									class="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
								/>
								<span class="text-xs font-medium text-muted-foreground">Genre</span>
								<span class="min-w-0 flex-1 truncate text-xs text-foreground"
									>{effectiveGenre(card)}</span
								>
							</button>
						{/if}
						{#if effectiveGenre(card)}
							<input type="hidden" name="genre" value={effectiveGenre(card)} />
						{:else}
							<input type="hidden" name="genre" value="" />
						{/if}
					</div>

					<!-- Reading status chip row -->
					<div>
						{#if statusRowOpen}
							<div class="mb-1.5 text-xs font-medium text-muted-foreground">Reading status</div>
							<div class="flex flex-wrap gap-1.5">
								{#each READING_STATUSES as s (s)}
									{@const active = effectiveReadingStatus(card) === s}
									<button
										type="button"
										class={`rounded-full border px-2.5 py-1 text-xs transition-colors ${chipClasses(active)}`}
										onclick={() => {
											metaStatusExpanded = true;
											editReadingStatus = s;
										}}
										aria-pressed={active}
									>
										{READING_STATUS_LABELS[s]}
									</button>
								{/each}
							</div>
						{:else}
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/30 px-2 py-2 text-left hover:bg-muted/50"
								onclick={() => (metaStatusExpanded = true)}
							>
								<ChevronRight
									class="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
								/>
								<span class="text-xs font-medium text-muted-foreground">Reading status</span>
								<span class="min-w-0 flex-1 truncate text-xs text-foreground"
									>{READING_STATUS_LABELS[effectiveReadingStatus(card)]}</span
								>
							</button>
						{/if}
						<input type="hidden" name="reading_status" value={effectiveReadingStatus(card)} />
					</div>

					<!-- Language chip row -->
					<div>
						{#if langRowOpen}
							<div class="mb-1.5 text-xs font-medium text-muted-foreground">Language</div>
							<div class="flex flex-wrap gap-1.5">
								{#each LANGUAGES as l (l)}
									{@const active = effectiveLanguage(card) === l}
									<button
										type="button"
										class={`rounded-full border px-2.5 py-1 text-xs transition-colors ${chipClasses(active)}`}
										onclick={() => {
											metaLangExpanded = true;
											editLanguage = l as Language;
										}}
										aria-pressed={active}
									>
										{LANGUAGE_LABELS[l as Language]}
									</button>
								{/each}
							</div>
						{:else}
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/30 px-2 py-2 text-left hover:bg-muted/50"
								onclick={() => (metaLangExpanded = true)}
							>
								<ChevronRight
									class="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
								/>
								<span class="text-xs font-medium text-muted-foreground">Language</span>
								<span class="min-w-0 flex-1 truncate text-xs text-foreground"
									>{LANGUAGE_LABELS[effectiveLanguage(card) as Language]}</span
								>
							</button>
						{/if}
						<input type="hidden" name="language" value={effectiveLanguage(card)} />
					</div>

					<!-- Live missing-fields preview -->
					<div class="text-xs text-muted-foreground">
						{#if missing.length === 0}
							<span class="text-emerald-700 dark:text-emerald-300">
								Save will clear the review flag. No fields still missing.
							</span>
						{:else}
							Still missing after save: <span class="font-medium">{missing.join(', ')}</span>.
							Save anyway will clear the review flag and strip the auto-line.
						{/if}
					</div>

					<!-- Footer actions -->
					<div class="flex flex-wrap items-center gap-2 pt-1">
						<Button
							type="submit"
							hotkey="s"
							label={pendingSaveId === card.id ? 'Saving…' : 'Save'}
							disabled={pendingSaveId !== null}
						/>
						<Button
							type="button"
							variant="outline"
							label="Back"
							onclick={goBackToSkipped}
							disabled={pendingSaveId !== null || skippedStack.length === 0}
						/>
						<Button
							type="button"
							variant="outline"
							hotkey="Escape"
							label="Skip"
							onclick={skipCurrent}
							disabled={pendingSaveId !== null}
						/>
						<Button
							variant="ghost"
							size="sm"
							href={`/library/books/${card.id}/edit`}
							class="ml-auto gap-1 text-xs"
						>
							<ExternalLink class="size-3.5" /> Edit full
						</Button>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							hotkey="d"
							onclick={() => (confirmDeleteOpen = true)}
							disabled={pendingSaveId !== null}
						>
							<Trash2 class="size-3.5" /> <HotkeyLabel label="Delete" mnemonic="d" />
						</Button>
					</div>
				</form>
			</article>

			<p class="mt-3 hidden text-center text-[11px] text-muted-foreground md:block">
				<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">⌘S</kbd> save
				·
				<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">Esc</kbd> skip
				·
				<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">⌘D</kbd> delete
				· Back returns the last skipped card
			</p>
		{:else if refilling}
			<div class="flex flex-col items-center gap-3 py-12 text-center">
				<div
					class="size-8 animate-spin rounded-full border-2 border-muted border-t-foreground"
					aria-label="Loading next batch"
				></div>
				<p class="text-sm text-muted-foreground">Loading next batch…</p>
			</div>
		{:else}
			<!-- Celebration -->
			<div
				class="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-10 text-center"
			>
				<Trophy class="size-10 text-emerald-600 dark:text-emerald-300" />
				<h2 class="text-xl font-semibold">Done for now</h2>
				<p class="text-sm text-muted-foreground">
					{#if reviewedThisSession === 0}
						No books left in this slice.
					{:else}
						You reviewed <span class="font-semibold text-foreground"
							>{reviewedThisSession}</span
						>
						{reviewedThisSession === 1 ? 'book' : 'books'} this session.
					{/if}
				</p>
				<div class="mt-2 flex flex-wrap items-center justify-center gap-2">
					<Button variant="outline" href="/library">
						<ArrowLeft class="size-4" /> Back to library
					</Button>
					{#if remaining > 0}
						<Button onclick={() => invalidateAll()} class="gap-1">
							<ChevronRight class="size-4" /> Reload queue
						</Button>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	{#if data.scriptureRefsNeedingReview.length > 0}
		<section
			class="mt-10 border-t border-border pt-6"
			aria-labelledby="scripture-refs-review-heading"
		>
			<h2 id="scripture-refs-review-heading" class="text-sm font-semibold tracking-tight">
				Scripture references needing review ({data.scriptureRefsNeedingReview.length})
			</h2>
			<p class="mt-1 text-xs text-muted-foreground">
				Low-confidence OCR rows link to the book page — edit inline, then clear
				<span class="font-medium">Needs review</span> when done.
			</p>
			<ul class="mt-3 flex flex-col gap-2">
				{#each data.scriptureRefsNeedingReview as row (row.refId)}
					<li>
						<a
							href="/library/books/{row.bookId}#ref-{row.refId}"
							class="block rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
						>
							<div class="font-medium leading-snug text-foreground">{row.bookTitle}</div>
							<div class="mt-0.5 text-xs text-muted-foreground">
								<span class="text-foreground">{row.rangeLabel}</span>
								{#if row.pageSummary}
									<span class="mx-1">·</span>
									{row.pageSummary}
								{/if}
								{#if row.confidence != null}
									<span class="mx-1">·</span>
									conf {(row.confidence * 100).toFixed(0)}%
								{/if}
							</div>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<!-- Hidden delete form posts to ?/softDeleteBook for the current card -->
{#if currentCard}
	{@const card = currentCard}
	<form
		method="POST"
		action="?/softDeleteBook"
		use:enhance={deleteSubmit()}
		id="review-delete-form"
		class="hidden"
	>
		<input type="hidden" name="id" value={card.id} />
	</form>
	<ConfirmDialog
		bind:open={confirmDeleteOpen}
		title="Delete this book?"
		description={`"${card.title ?? '(untitled)'}" will be soft-deleted. You can restore it from the library list.`}
		confirmLabel="Delete"
		destructive
		pending={confirmDeletePending}
		onConfirm={() => {
			(document.getElementById('review-delete-form') as HTMLFormElement | null)?.requestSubmit();
		}}
	/>
{/if}

<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { invalidate, goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Plus from '@lucide/svelte/icons/plus';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import Search from '@lucide/svelte/icons/search';
	import ScanBarcode from '@lucide/svelte/icons/scan-barcode';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import X from '@lucide/svelte/icons/x';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import {
		GENRES,
		LANGUAGES,
		LANGUAGE_LABELS,
		LIBRARY_PAGE_SIZE,
		READING_STATUSES,
		READING_STATUS_LABELS
	} from '$lib/types/library';
	import type {
		ReadingStatus,
		Language,
		BookListFilters,
		PersonRow,
		Genre,
		BookListRow
	} from '$lib/types/library';
	import { bookListFiltersToSearchParams } from '$lib/library/server/url-params';
	import { LIBRARY_PEOPLE_JSON } from '$lib/library/vocab-cache-paths';
	import { scorePersonMatch } from '$lib/library/person-search';
	import type { MultiComboboxItem } from '$lib/components/multi-combobox.svelte';
	import type { default as MultiComboboxComponent } from '$lib/components/multi-combobox.svelte';
	import type { PageProps } from './$types';
	import { cn } from '$lib/utils.js';

	let { data, form }: PageProps = $props();

	let MultiCombobox = $state<typeof MultiComboboxComponent | null>(null);
	let facetUiReady = $state(false);

	async function ensureFacetUi() {
		if (facetUiReady) return;
		const mod = await import('$lib/components/multi-combobox.svelte');
		MultiCombobox = mod.default;
		facetUiReady = true;
	}

	/** Client-side filter mirror during JSON refresh; cleared when server `data` updates. */
	let clientFilters = $state<BookListFilters | null>(null);
	const filters = $derived<BookListFilters>(clientFilters ?? data.filters);

	let loadedBooks = $state<BookListRow[]>([]);
	let clientFilteredCount = $state<number | null>(null);
	let loadingMore = $state(false);
	let loadMoreError = $state<string | null>(null);
	let listFetchPending = $state(false);
	let listFetchError = $state<string | null>(null);
	let listFetchSeq = 0;
	let loadMoreSentinel = $state<HTMLDivElement | null>(null);

	$effect(() => {
		void data.books;
		void data.filters;
		clientFilters = null;
		loadedBooks = [...data.books];
		clientFilteredCount = null;
		loadMoreError = null;
		listFetchError = null;
	});

	const filteredCount = $derived(clientFilteredCount ?? data.filteredCount);
	const showPagedMore = $derived(
		filters.all !== true && loadedBooks.length < filteredCount && filteredCount > 0
	);

	const Q_DEBOUNCE_MS = 300;

	function listTargetUrl(next: BookListFilters): string {
		const keep = bookListFiltersToSearchParams(next, page.url);
		const search = keep.toString();
		return page.url.pathname + (search ? `?${search}` : '');
	}

	async function fetchBooksPage(
		next: BookListFilters,
		offset: number
	): Promise<{ books: BookListRow[]; filteredCount: number }> {
		const q = bookListFiltersToSearchParams(next, page.url);
		if (offset > 0) q.set('offset', String(offset));
		const res = await fetch(`/library/books.json?${q.toString()}`);
		if (!res.ok) throw new Error('fetch failed');
		return (await res.json()) as { books: BookListRow[]; filteredCount: number };
	}

	/** Client JSON refresh for filters/search; full `goto` only for `?all=true`. */
	async function applyListFilters(next: BookListFilters) {
		if (!browser) return;
		clientFilters = next;

		if (next.all === true) {
			clientFilteredCount = null;
			goto(listTargetUrl(next), { keepFocus: true, noScroll: true });
			return;
		}

		replaceState(listTargetUrl(next), {});

		const seq = ++listFetchSeq;
		listFetchPending = true;
		listFetchError = null;
		try {
			const { books, filteredCount: count } = await fetchBooksPage(next, 0);
			if (seq !== listFetchSeq) return;
			loadedBooks = books;
			clientFilteredCount = count;
			loadMoreError = null;
		} catch {
			if (seq !== listFetchSeq) return;
			listFetchError = 'Could not update list.';
		} finally {
			if (seq === listFetchSeq) listFetchPending = false;
		}
	}

	async function loadMore() {
		if (!browser || loadingMore || filters.all === true) return;
		if (loadedBooks.length >= filteredCount) return;
		loadingMore = true;
		loadMoreError = null;
		try {
			const q = bookListFiltersToSearchParams(filters, page.url);
			q.set('offset', String(loadedBooks.length));
			const res = await fetch(`/library/books.json?${q.toString()}`);
			if (!res.ok) {
				loadMoreError = 'Could not load more.';
				return;
			}
			const body = (await res.json()) as { books?: BookListRow[] };
			const next = body.books ?? [];
			const seen = new Set(loadedBooks.map((b) => b.id));
			const appended = next.filter((b) => !seen.has(b.id));
			loadedBooks = [...loadedBooks, ...appended];
		} catch {
			loadMoreError = 'Could not load more.';
		} finally {
			loadingMore = false;
		}
	}

	$effect(() => {
		if (!browser || !showPagedMore || filters.all === true) return;
		const el = loadMoreSentinel;
		if (!el) return;
		const obs = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) void loadMore();
				}
			},
			{ root: null, rootMargin: '600px 0px', threshold: 0 }
		);
		obs.observe(el);
		return () => obs.disconnect();
	});

	// 10s undo toast for soft-deletes coming back from the detail-page redirect.
	let undoToastVisible = $state(false);
	let undoToastBookId = $state<string | null>(null);
	let undoTimer = $state<number | null>(null);
	let undoPending = $state(false);
	let toastShownForId = $state<string | null>(null);

	$effect(() => {
		if (!browser) return;
		const id = data.recentlyDeletedId;
		if (!id) return;
		if (toastShownForId === id) return;
		toastShownForId = id;
		undoToastBookId = id;
		undoToastVisible = true;
		if (undoTimer != null) clearTimeout(undoTimer);
		undoTimer = window.setTimeout(() => {
			closeToastAndStripQuery();
		}, 10_000);
	});

	function closeToastAndStripQuery() {
		undoToastVisible = false;
		undoToastBookId = null;
		if (undoTimer != null) {
			clearTimeout(undoTimer);
			undoTimer = null;
		}
		if (browser) {
			const url = new URL(window.location.href);
			url.searchParams.delete('deleted');
			goto(url.pathname + (url.search || ''), { replaceState: true, keepFocus: true });
		}
	}

	const undoEnhance: SubmitFunction = () => {
		undoPending = true;
		return async ({ result, update }) => {
			undoPending = false;
			if (undoTimer != null) {
				clearTimeout(undoTimer);
				undoTimer = null;
			}
			await update({ reset: false });
			if (result.type === 'success') {
				undoToastVisible = false;
				const restoredId = undoToastBookId;
				undoToastBookId = null;
				await invalidate('app:library:list');
				if (browser && restoredId) {
					goto(`/library/books/${restoredId}`);
				}
			}
		};
	};

	function statusToneClasses(s: ReadingStatus): string {
		switch (s) {
			case 'in_progress':
				return 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-200';
			case 'read':
				return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
			case 'reference':
				return 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-200';
			case 'n_a':
				return 'border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-200';
			default:
				return 'border-border bg-muted text-muted-foreground';
		}
	}

	let statusOptimistic = $state<Record<string, ReadingStatus>>({});
	function effectiveStatus(b: { id: string; reading_status: ReadingStatus }): ReadingStatus {
		return statusOptimistic[b.id] ?? b.reading_status;
	}

	function statusSubmit(bookId: string): SubmitFunction {
		return ({ formData }) => {
			const next = formData.get('reading_status');
			if (typeof next === 'string') {
				statusOptimistic = { ...statusOptimistic, [bookId]: next as ReadingStatus };
			}
			return async ({ update }) => {
				await update({ reset: false });
			};
		};
	}

	// -------------------------------------------------------------------------
	// Filters: server snapshot in `data.filters`; client refresh via books.json.
	// -------------------------------------------------------------------------

	let mobileFilterOpen = $state(false);

	let qInput = $state('');
	$effect(() => {
		qInput = filters.q ?? '';
	});

	let qDebounce: number | null = null;
	function onQInput(e: Event & { currentTarget: HTMLInputElement }) {
		qInput = e.currentTarget.value;
		if (!browser) return;
		if (qDebounce != null) clearTimeout(qDebounce);
		qDebounce = window.setTimeout(() => {
			void applyListFilters({ ...filters, q: qInput.trim() || undefined });
		}, Q_DEBOUNCE_MS);
	}

	function toggleArrayFilter<K extends keyof BookListFilters>(
		key: K,
		value: string
	) {
		const current = (filters[key] as string[] | undefined) ?? [];
		const has = current.includes(value);
		const nextArr = has ? current.filter((v) => v !== value) : [...current, value];
		void applyListFilters({ ...filters, [key]: nextArr.length === 0 ? undefined : nextArr });
	}

	function setArrayFilter<K extends keyof BookListFilters>(key: K, next: string[]) {
		void applyListFilters({ ...filters, [key]: next.length === 0 ? undefined : next });
	}

	function toggleNeedsReview() {
		void applyListFilters({
			...filters,
			needs_review: filters.needs_review ? undefined : true
		});
	}

	function clearAll() {
		qInput = '';
		clearBulkSelection();
		void applyListFilters({});
	}

	const hasAnyFilter = $derived(
		Boolean(
			(filters.genre?.length ?? 0) > 0 ||
				(filters.series_id?.length ?? 0) > 0 ||
				(filters.author_id?.length ?? 0) > 0 ||
				(filters.language?.length ?? 0) > 0 ||
				(filters.reading_status?.length ?? 0) > 0 ||
				filters.needs_review === true ||
				(filters.q && filters.q.length > 0)
		)
	);

	const activeFilterCount = $derived(
		(filters.genre?.length ?? 0) +
			(filters.series_id?.length ?? 0) +
			(filters.author_id?.length ?? 0) +
			(filters.language?.length ?? 0) +
			(filters.reading_status?.length ?? 0) +
			(filters.needs_review === true ? 1 : 0)
	);

	function chipBaseClasses(active: boolean): string {
		return active
			? 'border-primary bg-primary text-primary-foreground'
			: 'border-border bg-background text-foreground hover:bg-muted';
	}

	function seriesLabel(id: string): string {
		const s = data.series.find((s) => s.id === id);
		if (!s) return id;
		return s.abbreviation ? `${s.abbreviation} — ${s.name}` : s.name;
	}

	function personShort(p: PersonRow): string {
		const first = (p.first_name ?? '').trim();
		const middle = (p.middle_name ?? '').trim();
		const middleInitial = middle ? `${middle.charAt(0)}.` : '';
		return [first, middleInitial, p.last_name].filter((s) => s.length > 0).join(' ');
	}

	let facetPeople = $state<PersonRow[]>([]);
	let facetPeopleLoading = $state(false);

	async function ensureFacetPeople() {
		if (facetPeople.length > 0 || facetPeopleLoading) return;
		facetPeopleLoading = true;
		try {
			const res = await fetch(LIBRARY_PEOPLE_JSON);
			if (!res.ok) return;
			const body = (await res.json()) as { people?: PersonRow[] };
			facetPeople = body.people ?? [];
		} finally {
			facetPeopleLoading = false;
		}
	}

	$effect(() => {
		if (!browser) return;
		if (mobileFilterOpen) void ensureFacetPeople();
	});

	$effect(() => {
		if (!browser) return;
		if (mobileFilterOpen) void ensureFacetUi();
		const idle =
			typeof requestIdleCallback === 'function'
				? requestIdleCallback(() => void ensureFacetUi(), { timeout: 2500 })
				: window.setTimeout(() => void ensureFacetUi(), 300);
		return () => {
			if (typeof cancelIdleCallback === 'function' && typeof idle === 'number') {
				cancelIdleCallback(idle);
			} else {
				clearTimeout(idle);
			}
		};
	});

	$effect(() => {
		if (!browser) return;
		const run = () => void ensureFacetPeople();
		if (typeof requestIdleCallback === 'function') {
			const id = requestIdleCallback(run);
			return () => cancelIdleCallback(id);
		}
		const id = window.setTimeout(run, 1);
		return () => clearTimeout(id);
	});

	const peopleById = $derived(new Map(facetPeople.map((p) => [p.id, p])));

	function authorFacetMatcher(it: MultiComboboxItem, query: string): number {
		const p = peopleById.get(it.id);
		return p ? scorePersonMatch(query, p) : 0;
	}

	const seriesItems = $derived<MultiComboboxItem[]>(
		data.series.map((s) => ({
			id: s.id,
			label: s.abbreviation ?? s.name,
			sublabel: s.abbreviation ? s.name : null,
			keywords: [s.name, ...(s.abbreviation ? [s.abbreviation] : [])]
		}))
	);

	const peopleItems = $derived<MultiComboboxItem[]>(
		facetPeople.map((p) => ({
			id: p.id,
			label: personShort(p),
			sublabel: p.aliases && p.aliases.length > 0 ? p.aliases.join(', ') : null,
			keywords: [p.last_name, p.first_name ?? '', ...(p.aliases ?? [])].filter(
				(k) => k.length > 0
			)
		}))
	);

	// Bindable mirrors for MultiCombobox. The source of truth remains the
	// URL; these re-hydrate in a $effect tracking filters.* so back/forward
	// sync works.
	let seriesSelection = $state<string[]>([]);
	let authorSelection = $state<string[]>([]);
	$effect(() => {
		seriesSelection = filters.series_id ?? [];
	});
	$effect(() => {
		authorSelection = filters.author_id ?? [];
	});

	// -------------------------------------------------------------------------
	// Bulk selection (desktop table + mobile cards)
	// -------------------------------------------------------------------------

	let selectedIds = $state<string[]>([]);
	let bulkDialogOpen = $state(false);
	let bulkPending = $state(false);

	const selectedCount = $derived(selectedIds.length);
	const allPageSelected = $derived(
		loadedBooks.length > 0 && loadedBooks.every((b) => selectedIds.includes(b.id))
	);

	/** Some but not all rows on this page are selected — drives header checkbox indeterminate. */
	const pagePartialSelected = $derived(
		loadedBooks.length > 0 &&
			loadedBooks.some((b) => selectedIds.includes(b.id)) &&
			!allPageSelected
	);

	let selectAllCheckboxEl = $state<HTMLInputElement | null>(null);
	$effect(() => {
		const el = selectAllCheckboxEl;
		if (!el) return;
		el.indeterminate = pagePartialSelected;
	});

	function toggleSelectAllPage() {
		const pageIds = loadedBooks.map((b) => b.id);
		if (allPageSelected) {
			const pageSet = new Set(pageIds);
			selectedIds = selectedIds.filter((id) => !pageSet.has(id));
		} else {
			selectedIds = [...new Set([...selectedIds, ...pageIds])];
		}
	}

	function clearBulkSelection() {
		selectedIds = [];
	}

	/** Empty string = leave this field alone on selected books. */
	let bulkLanguage = $state<Language | ''>('');
	let bulkReadingStatus = $state<ReadingStatus | ''>('');
	let bulkGenre = $state<Genre | ''>('');
	let bulkBibleBook = $state('');

	const bulkApplySummary = $derived.by(() => {
		const parts: string[] = [];
		if (bulkLanguage) parts.push(`Language → ${LANGUAGE_LABELS[bulkLanguage]}`);
		if (bulkReadingStatus) parts.push(`Status → ${READING_STATUS_LABELS[bulkReadingStatus]}`);
		if (bulkGenre) parts.push(`Genre → ${bulkGenre}`);
		if (bulkBibleBook) parts.push(`Add coverage → ${bulkBibleBook}`);
		return parts;
	});
	const bulkHasChanges = $derived(bulkApplySummary.length > 0);

	function resetBulkFields() {
		bulkLanguage = '';
		bulkReadingStatus = '';
		bulkGenre = '';
		bulkBibleBook = '';
	}

	function openBulkDialog() {
		resetBulkFields();
		bulkDialogOpen = true;
	}

	const bulkFormFeedback = $derived.by(() => {
		const f = form as { kind?: string; message?: string; success?: boolean } | null | undefined;
		if (!f || f.kind !== 'bulkUpdateBooks') return null;
		return f;
	});

	const bulkEnhance: SubmitFunction = ({ cancel }) => {
		if (!bulkHasChanges || selectedCount === 0) {
			cancel();
			return;
		}
		bulkPending = true;
		return async ({ result, update }) => {
			bulkPending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				const d = result.data as { kind?: string; success?: boolean } | undefined;
				if (d?.kind === 'bulkUpdateBooks' && d.success) {
					selectedIds = [];
					bulkDialogOpen = false;
					resetBulkFields();
					await invalidate('app:library:list');
				}
			}
		};
	};

	$effect(() => {
		const ids = new Set(loadedBooks.map((b) => b.id));
		const pruned = selectedIds.filter((id) => ids.has(id));
		if (pruned.length !== selectedIds.length) {
			selectedIds = pruned;
		}
	});
</script>

{#snippet filterBody()}
	<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-6">
		<section class="sm:col-span-2 lg:col-span-6">
			<h3 class="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
				Genre
			</h3>
			<div class="flex flex-wrap gap-1">
				{#each GENRES as g (g)}
					{@const active = filters.genre?.includes(g) ?? false}
					<button
						type="button"
						class={`rounded-full border px-2 py-0.5 text-[11px] leading-tight transition-colors ${chipBaseClasses(active)}`}
						onclick={() => toggleArrayFilter('genre', g)}
						aria-pressed={active}
					>
						{g}
					</button>
				{/each}
			</div>
		</section>

		<section class="sm:col-span-2 lg:col-span-3">
			<h3 class="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
				Author
			</h3>
			{#if MultiCombobox}
				<MultiCombobox
					bind:values={authorSelection}
					items={peopleItems}
					placeholder="Search authors by last name…"
					ariaLabel="Authors"
					matcher={authorFacetMatcher}
					onChange={(next) => setArrayFilter('author_id', next)}
				/>
			{:else}
				<div class="h-10 animate-pulse rounded-md bg-muted" aria-hidden="true"></div>
			{/if}
		</section>

		{#if data.series.length > 0}
			<section class="sm:col-span-2 lg:col-span-3">
				<h3 class="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
					Series
				</h3>
				{#if MultiCombobox}
					<MultiCombobox
						bind:values={seriesSelection}
						items={seriesItems}
						placeholder="Search series by name or abbreviation…"
						ariaLabel="Series"
						onChange={(next) => setArrayFilter('series_id', next)}
					/>
				{:else}
					<div class="h-10 animate-pulse rounded-md bg-muted" aria-hidden="true"></div>
				{/if}
			</section>
		{/if}

		<section class="sm:col-span-2 lg:col-span-3">
			<h3 class="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
				Language
			</h3>
			<div class="flex flex-wrap gap-1">
				{#each LANGUAGES as l (l)}
					{@const active = filters.language?.includes(l as Language) ?? false}
					<button
						type="button"
						class={`rounded-full border px-2 py-0.5 text-[11px] leading-tight transition-colors ${chipBaseClasses(active)}`}
						onclick={() => toggleArrayFilter('language', l)}
						aria-pressed={active}
					>
						{LANGUAGE_LABELS[l as Language]}
					</button>
				{/each}
			</div>
		</section>

		<section class="sm:col-span-2 lg:col-span-3">
			<h3 class="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
				Reading status
			</h3>
			<div class="flex flex-wrap gap-1">
				{#each READING_STATUSES as s (s)}
					{@const active = filters.reading_status?.includes(s as ReadingStatus) ?? false}
					<button
						type="button"
						class={`rounded-full border px-2 py-0.5 text-[11px] leading-tight transition-colors ${chipBaseClasses(active)}`}
						onclick={() => toggleArrayFilter('reading_status', s)}
						aria-pressed={active}
					>
						{READING_STATUS_LABELS[s as ReadingStatus]}
					</button>
				{/each}
			</div>
		</section>

		<section class="sm:col-span-2 lg:col-span-6">
			<h3 class="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Flags</h3>
			<button
				type="button"
				class={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] leading-tight transition-colors ${chipBaseClasses(filters.needs_review === true)}`}
				onclick={toggleNeedsReview}
				aria-pressed={filters.needs_review === true}
			>
				<AlertCircle class="size-3.5" /> Needs review
			</button>
		</section>
	</div>
{/snippet}

{#snippet libraryLead()}
	<BookOpen class="size-6 shrink-0 text-muted-foreground" />
{/snippet}

{#snippet libraryListMeta()}
	<span class="text-sm text-muted-foreground">
		Showing {loadedBooks.length.toLocaleString()} of {filteredCount.toLocaleString()} filtered
		({data.totalCount.toLocaleString()} total)
		{#if filters.all !== true && filteredCount > LIBRARY_PAGE_SIZE}
			<button
				type="button"
				class="ml-1.5 text-primary underline-offset-2 hover:underline"
				onclick={() => void applyListFilters({ ...filters, all: true })}
			>
				View all ({filteredCount.toLocaleString()})
			</button>
		{:else if filters.all === true}
			<button
				type="button"
				class="ml-1.5 text-primary underline-offset-2 hover:underline"
				onclick={() => void applyListFilters({ ...filters, all: undefined })}
			>
				Switch to paged view
			</button>
		{/if}
	</span>
{/snippet}

{#snippet libraryListActions()}
	<div class="hidden md:flex md:flex-wrap md:items-center md:justify-end md:gap-2">
		<Button variant="outline" href="/library/search-passage">
			<Search class="size-4" /> Search passage
		</Button>
		<Button variant="outline" href="/library/add" class="gap-2">
			<ScanBarcode class="size-4" /> Add by ISBN
		</Button>
		<Button variant="outline" href="/library/review" class="gap-2">
			<ClipboardCheck class="size-4" />
			{#if filters.needs_review === true && filteredCount > 0}
				Review queue ({filteredCount.toLocaleString()})
			{:else}
				Review queue
			{/if}
		</Button>
		<Button href="/library/books/new" class="gap-2" hotkey="b">
			<Plus class="size-4" /> <HotkeyLabel label="New book" mnemonic="b" />
		</Button>
	</div>
	<div class="grid w-full grid-cols-4 gap-1 md:hidden">
		<a
			href="/library/books/new"
			class="relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md border border-input bg-primary px-1 py-2 text-[0.65rem] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
		>
			<Plus class="size-5 shrink-0" />
			<span class="max-w-full truncate px-0.5">New book</span>
		</a>
		<a
			href="/library/add"
			class="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md border border-input bg-background px-1 py-2 text-[0.65rem] font-medium text-foreground transition-colors hover:bg-muted/80"
		>
			<ScanBarcode class="size-5 shrink-0" />
			<span class="max-w-full truncate px-0.5">Add by ISBN</span>
		</a>
		<a
			href="/library/search-passage"
			class="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md border border-input bg-background px-1 py-2 text-[0.65rem] font-medium text-foreground transition-colors hover:bg-muted/80"
		>
			<Search class="size-5 shrink-0" />
			<span class="max-w-full truncate px-0.5">Search passage</span>
		</a>
		<a
			href="/library/review"
			class="relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md border border-input bg-background px-1 py-2 text-[0.65rem] font-medium text-foreground transition-colors hover:bg-muted/80"
			aria-label={filters.needs_review === true && filteredCount > 0
				? `Review queue (${filteredCount.toLocaleString()})`
				: 'Review queue'}
		>
			{#if filters.needs_review === true && filteredCount > 0}
				<span
					class="absolute -right-0.5 -top-0.5 flex size-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[0.55rem] font-semibold leading-none text-primary-foreground"
					aria-hidden="true"
				>
					{filteredCount > 99 ? '99+' : filteredCount}
				</span>
			{/if}
			<ClipboardCheck class="size-5 shrink-0" />
			<span class="max-w-full truncate px-0.5">Review queue</span>
		</a>
	</div>
{/snippet}

<svelte:head>
	<title>Library — ppp</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
	<PageHeader
		title="Library"
		lead={libraryLead}
		meta={libraryListMeta}
		actions={libraryListActions}
	/>

	{#if listFetchError}
		<p
			class="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
			role="alert"
		>
			{listFetchError}
		</p>
	{/if}

	<!-- Search + mobile filter trigger row -->
	<div class="mt-4 flex flex-wrap items-center gap-2">
		<div class="relative flex-1 min-w-[14rem]">
			<Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
			{#if listFetchPending}
				<Loader2
					class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
					aria-hidden="true"
				/>
			{/if}
			<Input
				type="search"
				placeholder="Search title, subtitle, or authors…"
				value={qInput}
				oninput={onQInput}
				class={cn('pl-9', listFetchPending && 'pr-9')}
				aria-label="Search books"
				aria-busy={listFetchPending}
			/>
		</div>
		<Button
			type="button"
			variant="outline"
			class="max-md:min-h-11 md:hidden"
			onclick={() => (mobileFilterOpen = true)}
		>
			<SlidersHorizontal class="size-4" />
			Filters
			{#if activeFilterCount > 0}
				<span class="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
					{activeFilterCount}
				</span>
			{/if}
		</Button>
	</div>

	<!-- Desktop: full-width collapsible filters (mobile uses Sheet below) -->
	<details
		class="group mt-4 hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm md:block"
		open
		ontoggle={(e) => {
			if (e.currentTarget.open) void ensureFacetPeople();
		}}
	>
		<summary
			class="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden"
		>
			<span class="flex items-center gap-2">
				<SlidersHorizontal class="size-4 text-muted-foreground" />
				Filters
				{#if activeFilterCount > 0}
					<span
						class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground"
					>
						{activeFilterCount}
					</span>
				{/if}
			</span>
			<ChevronDown
				class="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
			/>
		</summary>
		<div class="border-t border-border px-4 pb-4 pt-3">
			{@render filterBody()}
		</div>
	</details>

	<!-- Active-filter chip rail + clear-all -->
	{#if hasAnyFilter}
		<div class="mt-3 flex flex-wrap items-center gap-1.5">
			{#each filters.genre ?? [] as g (g)}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/15"
					onclick={() => toggleArrayFilter('genre', g)}
				>
					{g} <X class="size-3" />
				</button>
			{/each}
			{#each filters.author_id ?? [] as id (id)}
				{@const p = peopleById.get(id)}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/15"
					onclick={() => toggleArrayFilter('author_id', id)}
				>
					{p ? personShort(p) : id} <X class="size-3" />
				</button>
			{/each}
			{#each filters.series_id ?? [] as id (id)}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/15"
					onclick={() => toggleArrayFilter('series_id', id)}
				>
					{seriesLabel(id)} <X class="size-3" />
				</button>
			{/each}
			{#each filters.language ?? [] as l (l)}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/15"
					onclick={() => toggleArrayFilter('language', l)}
				>
					{LANGUAGE_LABELS[l]} <X class="size-3" />
				</button>
			{/each}
			{#each filters.reading_status ?? [] as s (s)}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/15"
					onclick={() => toggleArrayFilter('reading_status', s)}
				>
					{READING_STATUS_LABELS[s]} <X class="size-3" />
				</button>
			{/each}
			{#if filters.needs_review === true}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-amber-500/60 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-200 transition-colors hover:bg-amber-500/15"
					onclick={toggleNeedsReview}
				>
					<AlertCircle class="size-3" /> Needs review <X class="size-3" />
				</button>
			{/if}
			{#if filters.q}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground transition-colors hover:bg-muted/70"
					onclick={() => {
						qInput = '';
						void applyListFilters({ ...filters, q: undefined });
					}}
				>
					“{filters.q}” <X class="size-3" />
				</button>
			{/if}
			<button
				type="button"
				class="ml-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
				onclick={clearAll}
			>
				Clear all
			</button>
		</div>
	{/if}

	<div class="mt-6 min-w-0">
			{#if data.totalCount === 0 && loadedBooks.length === 0 && !listFetchPending}
				<div class="rounded-xl border border-dashed border-border p-8 text-center">
					<BookOpen class="mx-auto size-8 text-muted-foreground" />
					<p class="mt-3 text-sm text-muted-foreground">No books yet. Add one to get started.</p>
					<Button href="/library/books/new" class="mt-4">
						<Plus class="size-4" /> Add book
					</Button>
				</div>
			{:else if filteredCount === 0 && loadedBooks.length === 0 && !listFetchPending}
				<div class="rounded-xl border border-dashed border-border p-8 text-center">
					<Search class="mx-auto size-8 text-muted-foreground" />
					<p class="mt-3 text-sm text-muted-foreground">
						No books match these filters.
					</p>
					<Button variant="outline" class="mt-4" onclick={clearAll}>
						Clear filters
					</Button>
				</div>
			{:else}
				{#if selectedCount > 0}
					<div
						class="sticky top-0 z-10 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-foreground shadow-sm backdrop-blur-sm"
					>
						<span class="font-medium">
							{selectedCount} book{selectedCount === 1 ? '' : 's'} selected
						</span>
						<div class="flex flex-wrap gap-2">
							<Button type="button" variant="ghost" size="sm" onclick={clearBulkSelection}>
								Clear
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								href={`/library/bibliography?ids=${selectedIds.join(',')}`}
							>
								Bibliography
							</Button>
							<Button type="button" size="sm" onclick={openBulkDialog}>
								Update…
							</Button>
						</div>
					</div>
				{/if}
				<!-- Mobile cards -->
				<ul class="flex flex-col gap-2 md:hidden">
					{#each loadedBooks as b (b.id)}
						<li
							class="relative rounded-xl border border-border bg-card px-3 py-2.5 text-card-foreground transition-colors hover:border-ring/50"
						>
							<a
								href={`/library/books/${b.id}`}
								data-sveltekit-preload-data="hover"
								class="absolute inset-0 z-0 rounded-xl"
								aria-label={`Open ${b.title ?? 'book'}`}
							></a>
							<div class="relative z-10 flex gap-2 pointer-events-none">
								<label
									class="pointer-events-auto flex size-11 shrink-0 items-center justify-center"
								>
									<input
										type="checkbox"
										class="size-4 rounded border-border"
										bind:group={selectedIds}
										value={b.id}
										aria-label={`Select ${b.title ?? 'book'}`}
									/>
								</label>
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-start gap-2">
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium leading-snug">
												{#if b.title}{b.title}{:else}<span class="italic text-muted-foreground">(untitled)</span>{/if}{#if b.volume_number}, vol. {b.volume_number}{/if}
											</p>
											{#if b.authors_label}
												<p class="truncate text-xs text-muted-foreground">{b.authors_label}</p>
											{/if}
										</div>
										<form
											method="POST"
											action="?/updateReadingStatus"
											use:enhance={statusSubmit(b.id)}
											class="pointer-events-auto shrink-0"
										>
											<input type="hidden" name="id" value={b.id} />
											<select
												name="reading_status"
												value={effectiveStatus(b)}
												onchange={(e) =>
													(e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()}
												class={`max-w-[7.5rem] w-auto rounded-md border bg-background px-2 py-1 text-xs ${statusToneClasses(effectiveStatus(b))}`}
												aria-label="Reading status"
											>
												{#each READING_STATUSES as s (s)}
													<option value={s}>{READING_STATUS_LABELS[s]}</option>
												{/each}
											</select>
										</form>
										{#if b.needs_review}
											<span
												class="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200"
											>
												<AlertCircle class="size-3" /> Review
											</span>
										{/if}
									</div>
									{#if b.genre || b.series_abbreviation}
										<div class="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
											{#if b.genre}
												<span
													class="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground"
												>
													{b.genre}
												</span>
											{/if}
											{#if b.series_abbreviation}
												<span
													class="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground"
													title={b.series_name ?? undefined}
												>
													{b.series_abbreviation}
												</span>
											{/if}
										</div>
									{/if}
								</div>
							</div>
						</li>
					{/each}
				</ul>

				<!-- Desktop table -->
				<div class="hidden overflow-x-auto rounded-xl border border-border md:block">
					<table class="min-w-full divide-y divide-border text-sm">
						<thead class="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
							<tr>
								<th class="w-10 px-2 py-2">
									<input
										bind:this={selectAllCheckboxEl}
										type="checkbox"
										class="size-4 rounded border-border"
										checked={allPageSelected}
										onclick={(e) => {
											e.preventDefault();
											toggleSelectAllPage();
										}}
										title="Select all on this page"
										aria-label="Select all books on this page"
									/>
								</th>
								<th class="px-4 py-2">Title</th>
								<th class="px-4 py-2">Authors</th>
								<th class="px-4 py-2">Genre</th>
								<th class="px-4 py-2">Series</th>
								<th class="px-4 py-2">Status</th>
								<th class="px-4 py-2 text-right">Flags</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each loadedBooks as b (b.id)}
								<tr class="hover:bg-muted/20">
									<td class="px-2 py-2.5 align-top">
										<input
											type="checkbox"
											class="mt-1 size-4 rounded border-border"
											bind:group={selectedIds}
											value={b.id}
											aria-label={`Select ${b.title ?? 'book'}`}
										/>
									</td>
									<td class="px-4 py-2.5">
										<a
											href={`/library/books/${b.id}`}
											data-sveltekit-preload-data="hover"
											class="block"
										>
											{#if b.title}
												<span class="font-medium">{b.title}</span>
											{:else}
												<span class="italic text-muted-foreground">(untitled)</span>
											{/if}
											{#if b.volume_number}<span class="text-muted-foreground">, vol. {b.volume_number}</span>{/if}
											{#if b.subtitle}
												<p class="text-xs text-muted-foreground">{b.subtitle}</p>
											{/if}
										</a>
									</td>
									<td class="px-4 py-2.5 text-muted-foreground">{b.authors_label ?? '—'}</td>
									<td class="px-4 py-2.5 text-muted-foreground">{b.genre ?? '—'}</td>
									<td
										class="px-4 py-2.5 text-muted-foreground"
										title={b.series_name ?? undefined}
									>
										{b.series_abbreviation ?? '—'}
									</td>
									<td class="px-4 py-2.5">
										<form
											method="POST"
											action="?/updateReadingStatus"
											use:enhance={statusSubmit(b.id)}
										>
											<input type="hidden" name="id" value={b.id} />
											<select
												name="reading_status"
												value={effectiveStatus(b)}
												onchange={(e) => (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()}
												class={`rounded-md border bg-background px-2 py-1 text-xs ${statusToneClasses(effectiveStatus(b))}`}
												aria-label="Reading status"
											>
												{#each READING_STATUSES as s (s)}
													<option value={s}>{READING_STATUS_LABELS[s]}</option>
												{/each}
											</select>
										</form>
									</td>
									<td class="px-4 py-2.5 text-right">
										{#if b.needs_review}
											<span
												class="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200"
											>
												<AlertCircle class="size-3" /> Review
											</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if showPagedMore}
					<div bind:this={loadMoreSentinel} class="h-2 w-full shrink-0" aria-hidden="true"></div>
					<div class="mt-4 flex justify-center">
						<Button
							type="button"
							variant="outline"
							disabled={loadingMore}
							onclick={() => void loadMore()}
						>
							{#if loadingMore}
								<Loader2 class="mr-2 size-4 animate-spin" aria-hidden="true" />
								Loading…
							{:else}
								Load more
							{/if}
						</Button>
					</div>
				{/if}
				{#if loadMoreError}
					<p class="mt-2 text-center text-sm text-destructive" role="alert">{loadMoreError}</p>
				{/if}
			{/if}
	</div>
</div>

<Dialog.Root bind:open={bulkDialogOpen}>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Update {selectedCount} book{selectedCount === 1 ? '' : 's'}</Dialog.Title>
			<Dialog.Description class="text-muted-foreground text-sm">
				Leave a field on “Don’t change” to keep each book’s current value. Only fields you pick are
				written.
			</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/bulkUpdateBooks" use:enhance={bulkEnhance} class="flex flex-col gap-4 py-2">
			<input type="hidden" name="book_ids_json" value={JSON.stringify(selectedIds)} />
			<div class="space-y-4">
				<div class="space-y-1.5">
					<Label for="bulk-language">Language</Label>
					<select
						id="bulk-language"
						name="bulk_language"
						bind:value={bulkLanguage}
						class="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm"
					>
						<option value="">Don’t change</option>
						{#each LANGUAGES as l (l)}
							<option value={l}>{LANGUAGE_LABELS[l]}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-1.5">
					<Label for="bulk-reading-status">Reading status</Label>
					<select
						id="bulk-reading-status"
						name="bulk_reading_status"
						bind:value={bulkReadingStatus}
						class="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm"
					>
						<option value="">Don’t change</option>
						{#each READING_STATUSES as s (s)}
							<option value={s}>{READING_STATUS_LABELS[s]}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-1.5">
					<Label for="bulk-genre">Genre</Label>
					<select
						id="bulk-genre"
						name="bulk_genre"
						bind:value={bulkGenre}
						class="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm"
					>
						<option value="">Don’t change</option>
						{#each GENRES as g (g)}
							<option value={g}>{g}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-1.5">
					<Label for="bulk-bible-book">Bible book coverage</Label>
					<p class="text-xs text-muted-foreground">
						Adds this book to commentary coverage on each selected volume. Existing coverage stays.
					</p>
					<select
						id="bulk-bible-book"
						name="bulk_bible_book"
						bind:value={bulkBibleBook}
						class="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm"
					>
						<option value="">Don’t change</option>
						{#each data.bibleBookNames as name (name)}
							<option value={name}>{name}</option>
						{/each}
					</select>
				</div>
			</div>

			{#if bulkHasChanges}
				<p class="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
					<span class="font-medium text-foreground">Will apply:</span>
					{bulkApplySummary.join(' · ')}
				</p>
			{:else}
				<p class="text-xs text-muted-foreground">Pick at least one field to enable Update.</p>
			{/if}

			{#if bulkFormFeedback?.message && !bulkFormFeedback.success}
				<p
					class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
					role="alert"
				>
					{bulkFormFeedback.message}
				</p>
			{/if}

			<Dialog.Footer class="flex-col gap-2 sm:flex-row sm:justify-end">
				<Button
					type="button"
					variant="outline"
					hotkey="Escape"
					label="Cancel"
					onclick={() => (bulkDialogOpen = false)}
				/>
				<Button
					type="submit"
					disabled={bulkPending || selectedCount === 0 || !bulkHasChanges}
					hotkey="u"
					label={bulkPending
						? 'Updating…'
						: `Update ${selectedCount} book${selectedCount === 1 ? '' : 's'}`}
				/>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Mobile filter sheet (hidden on desktop) -->
<Sheet.Root bind:open={mobileFilterOpen}>
	<Sheet.Content side="bottom" class="max-h-[85vh] overflow-y-auto px-4 pt-3 pb-6">
		<Sheet.Header class="px-0 pt-0 pb-3">
			<Sheet.Title>Filters</Sheet.Title>
			<Sheet.Description class="text-muted-foreground text-xs">
				AND between sections, OR within. Tap to toggle.
			</Sheet.Description>
		</Sheet.Header>
		{@render filterBody()}
		<Sheet.Footer class="mt-4 flex-row justify-between gap-2 border-0 p-0 sm:flex-row">
			<Button
				type="button"
				variant="ghost"
				onclick={clearAll}
				disabled={!hasAnyFilter}
			>
				Clear all
			</Button>
			<Button type="button" onclick={() => (mobileFilterOpen = false)} hotkey="Escape" label="Done" />
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>

{#if undoToastVisible && undoToastBookId}
	<div
		class="fixed inset-x-0 bottom-tabbar z-50 mx-auto flex w-full max-w-sm items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg md:bottom-6"
		role="status"
	>
		<Trash2 class="size-4 text-muted-foreground" />
		<span class="flex-1">Book deleted.</span>
		<form method="POST" action="?/undoSoftDeleteBook" use:enhance={undoEnhance}>
			<input type="hidden" name="id" value={undoToastBookId} />
			<Button type="submit" size="sm" variant="outline" disabled={undoPending} class="gap-1">
				<Undo2 class="size-3.5" /> {undoPending ? 'Undoing…' : 'Undo'}
			</Button>
		</form>
		<Button type="button" size="sm" variant="ghost" onclick={closeToastAndStripQuery}>
			Dismiss
		</Button>
	</div>
{/if}

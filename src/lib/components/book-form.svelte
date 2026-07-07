<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { enhance, deserialize } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import BookFormAuthors from '$lib/components/book-form-authors.svelte';
	import BookFormPublication, {
		type BookPublicationFields
	} from '$lib/components/book-form-publication.svelte';
	import {
		GENRES,
		LANGUAGES,
		LANGUAGE_LABELS,
		READING_STATUSES,
		READING_STATUS_LABELS,
		WORK_TYPES,
		WORK_TYPE_LABELS
	} from '$lib/types/library';
	import type {
		BookDetail,
		SeriesRow,
		PublisherRow,
		PersonRow,
		Genre,
		Language,
		ReadingStatus,
		WorkType
	} from '$lib/types/library';
	import type { OpenLibraryBookPrefill } from '$lib/library/open-library-prefill';
	import {
		applyOlPrefillFields,
		applyOlRefreshPatch,
		type BookAuthorRow,
		type BookOlPrefillFieldPatch
	} from '$lib/library/book-form-ol';
	import { detectBibleBookFromTitle } from '$lib/library/match';
	import type { OlApplyKey } from '$lib/components/book-ol-refresh-dialog.svelte';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import ScanBarcode from '@lucide/svelte/icons/scan-barcode';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Save from '@lucide/svelte/icons/save';

	/**
	 * <BookForm>
	 *
	 * Presentational create/edit form for `books`. Hosted by the dedicated
	 * `/library/books/new` and `/library/books/[id]/edit` pages — promoted out
	 * of the cramped `<BookFormSheet>` (Session 1.5e). Two-column desktop
	 * layout: Identity + Authors + Notes span full width; Classification + State
	 * (left) and Publication + Reprint + Identifiers/Shelf (right) split the
	 * middle.
	 *
	 * Form action is `?/createBook` or `?/updateBook` — both must be defined
	 * on the host +page.server.ts.
	 *
	 * `onDirtyChange` lets the host page wire `beforeNavigate` to intercept
	 * unsaved-edit dismissal (browser back, breadcrumb click, link click).
	 *
	 * `onCancel` — when set, Cancel is shown in the sticky footer with Save
	 * (mobile: stacked above tab bar clearance; desktop: row, end-aligned).
	 *
	 * `scanSessionLayout` + `onBackToScanner` — after barcode → new book, mobile summary + collapsible “more fields”, and actions to return to `/library/add` or save then continue scanning.
	 */

	type FormMessage = { message?: string } | null | undefined;

	function emptyPublicationFields(): BookPublicationFields {
		return {
			publisher: '',
			publisher_location: '',
			publisher_id: '',
			year: '',
			edition: '',
			total_volumes: '',
			original_year: '',
			reprint_publisher: '',
			reprint_publisher_id: '',
			reprint_location: '',
			reprint_year: '',
			page_count: '',
			isbn: '',
			shelving_location: ''
		};
	}

	function applyOlPatchToForm(patch: BookOlPrefillFieldPatch) {
		if (patch.title !== undefined) title = patch.title;
		if (patch.subtitle !== undefined) subtitle = patch.subtitle;
		if (patch.publisher !== undefined) pub.publisher = patch.publisher;
		if (patch.publisher_id !== undefined) pub.publisher_id = patch.publisher_id;
		if (patch.publisher_location !== undefined) pub.publisher_location = patch.publisher_location;
		if (patch.edition !== undefined) pub.edition = patch.edition;
		if (patch.year !== undefined) pub.year = patch.year;
		if (patch.page_count !== undefined) pub.page_count = patch.page_count;
		if (patch.isbn !== undefined) pub.isbn = patch.isbn;
		if (patch.genre !== undefined) genre = patch.genre as Genre;
		if (patch.work_type !== undefined) work_type = patch.work_type as WorkType;
		if (patch.language !== undefined) language = patch.language as Language;
		if (patch.series_id !== undefined) series_id = patch.series_id;
		if (patch.volume_number !== undefined) volume_number = patch.volume_number;
		if (patch.olSeriesHint !== undefined) olSeriesHint = patch.olSeriesHint;
		if (patch.olImportSnapshot !== undefined) olImportSnapshot = patch.olImportSnapshot;
		if (patch.authorRows !== undefined) authorRows = patch.authorRows;
	}

	let {
		mode,
		book = null,
		people: initialPeople,
		personBookCounts,
		series: initialSeries,
		publishers,
		bibleBooks = [],
		formMessage = null,
		onSaved,
		onDirtyChange,
		onCancel,
		openLibraryPrefill = null,
		onOpenLibraryPrefillConsumed,
		olRefreshOpen = $bindable(false),
		scanSessionLayout = false,
		onBackToScanner
	}: {
		mode: 'create' | 'edit';
		book?: BookDetail | null;
		people: PersonRow[];
		personBookCounts: Record<string, number>;
		series: SeriesRow[];
		publishers: PublisherRow[];
		/** Canonical bible book names for commentary auto-coverage (create mode). */
		bibleBooks?: { name: string; testament: 'OT' | 'NT' }[];
		formMessage?: FormMessage;
		onSaved?: (bookId: string, opts?: { returnToScanner?: boolean }) => void;
		onDirtyChange?: (dirty: boolean) => void;
		/** Leave without submit; host wires dirty confirm + `goto`. */
		onCancel?: () => void;
		/** One-shot metadata from `/library/add` + Open Library (create mode). */
		openLibraryPrefill?: OpenLibraryBookPrefill | null;
		onOpenLibraryPrefillConsumed?: () => void;
		/** Bindable: Open Library ISBN refresh dialog (edit mode). */
		olRefreshOpen?: boolean;
		/** Mobile-first layout after barcode scan: summary card + collapsible middle columns. */
		scanSessionLayout?: boolean;
		/** Return to `/library/add` without save; host wires dirty confirm. */
		onBackToScanner?: () => void;
	} = $props();

	let people = $state<PersonRow[]>([]);
	$effect(() => {
		people = initialPeople;
	});

	let seriesRows = $state<SeriesRow[]>([]);
	$effect(() => {
		seriesRows = initialSeries;
	});

	let title = $state('');
	let subtitle = $state('');
	let pub = $state<BookPublicationFields>(emptyPublicationFields());
	let series_id = $state<string>('');
	let volume_number = $state('');
	let genre = $state<Genre | ''>('');
	let work_type = $state<WorkType>('monograph');
	let language = $state<Language>('english');
	let barcode = $state('');
	let reading_status = $state<ReadingStatus>('unread');
	let borrowed_to = $state('');
	let personal_notes = $state('');
	let rating = $state('');
	let needs_review = $state<boolean>(false);
	let needs_review_note = $state('');
	let authorRows = $state<BookAuthorRow[]>([]);

	let seriesDialogOpen = $state(false);
	let newSeriesName = $state('');
	let newSeriesAbbrev = $state('');
	let seriesDialogMessage = $state<string | null>(null);
	let seriesDialogPending = $state(false);

	let pending = $state(false);

	let initialSnapshot = $state<string>('');

	/** Last-applied OL payload (scan summary + “missing fields” checklist). */
	let olImportSnapshot = $state<OpenLibraryBookPrefill | null>(null);
	/** Shown when OL had a series string but it did not match local `series`. */
	let olSeriesHint = $state<{ name: string; volume: string | null } | null>(null);

	let bookFormEl = $state<HTMLFormElement | null>(null);
	/** When true, successful submit calls `onSaved` with `returnToScanner: true`. */
	let returnToScannerAfterSave = $state(false);

	/** When `scanSessionLayout`, desktop keeps middle fields open; mobile starts collapsed. */
	let middleFieldsOpen = $state(false);
	$effect(() => {
		if (!browser || !scanSessionLayout) return;
		const mq = window.matchMedia('(min-width: 1024px)');
		const sync = () => {
			middleFieldsOpen = mq.matches;
		};
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});

	function currentFormSnapshot(): string {
		return JSON.stringify({
			title,
			subtitle,
			pub,
			series_id,
			volume_number,
			genre,
			work_type,
			language,
			barcode,
			reading_status,
			borrowed_to,
			personal_notes,
			rating,
			needs_review,
			needs_review_note,
			authorRows: authorRows.map((a) => ({ person_id: a.person_id, role: a.role }))
		});
	}

	const dirty = $derived(currentFormSnapshot() !== initialSnapshot);

	$effect(() => {
		onDirtyChange?.(dirty);
	});

	const hasAnyField = $derived(
		[
			title,
			subtitle,
			pub.publisher,
			pub.publisher_location,
			pub.publisher_id,
			pub.reprint_publisher_id,
			pub.year,
			pub.edition,
			pub.total_volumes,
			pub.original_year,
			pub.reprint_publisher,
			pub.reprint_location,
			pub.reprint_year,
			volume_number,
			pub.isbn,
			barcode,
			pub.shelving_location,
			personal_notes,
			pub.page_count,
			borrowed_to,
			rating,
			needs_review_note
		].some((v) => String(v ?? '').trim().length > 0) ||
			authorRows.some((a) => a.person_id) ||
			!!series_id ||
			!!genre ||
			needs_review === true
	);

	const missingImportantPreview = $derived.by<string[]>(() => {
		const out: string[] = [];
		if (!title.trim()) out.push('title');
		if (work_type === 'monograph') {
			if (authorRows.filter((a) => a.role === 'author' && a.person_id).length === 0)
				out.push('author');
		} else if (authorRows.filter((a) => a.role === 'editor' && a.person_id).length === 0) {
			out.push('editor');
		}
		if (!genre) out.push('genre');
		if (!pub.year || String(pub.year).trim().length === 0) out.push('year');
		if (!pub.publisher.trim()) out.push('publisher');
		return out;
	});

	const formAction = $derived(`?/${mode === 'create' ? 'createBook' : 'updateBook'}`);
	const personActionPath = '?/createPerson';
	const seriesActionPath = '?/createSeries';

	const seriesSelectItems = $derived([
		{ value: '', label: '— None —' },
		...seriesRows.map((s) => ({
			value: s.id,
			label: s.abbreviation ? `${s.abbreviation} — ${s.name}` : s.name
		}))
	]);
	const workTypeSelectItems = $derived(
		WORK_TYPES.map((wt) => ({ value: wt, label: WORK_TYPE_LABELS[wt] }))
	);

	const genreSelectItems = $derived([
		{ value: '', label: '— None —' },
		...GENRES.map((g) => ({ value: g, label: g }))
	]);
	const languageSelectItems = $derived(
		LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))
	);
	const readingStatusSelectItems = $derived(
		READING_STATUSES.map((s) => ({ value: s, label: READING_STATUS_LABELS[s] }))
	);

	const seriesLabel = $derived.by(() => {
		if (!series_id) return '— None —';
		const s = seriesRows.find((x) => x.id === series_id);
		if (!s) return '— None —';
		return s.abbreviation ? `${s.abbreviation} — ${s.name}` : s.name;
	});
	const languageLabel = $derived(LANGUAGE_LABELS[language]);
	const readingStatusLabel = $derived(READING_STATUS_LABELS[reading_status]);

	let prevGenreForDefaults = $state<Genre | '' | null>(null);
	let bibleBookDismissed = $state<string | null>(null);

	const detectedBibleBook = $derived.by(() => {
		if (mode !== 'create' || genre !== 'Commentary') return null;
		if (title.trim().length === 0) return null;
		return detectBibleBookFromTitle(title, subtitle, bibleBooks);
	});

	$effect(() => {
		const d = detectedBibleBook;
		if (bibleBookDismissed != null && d !== bibleBookDismissed) {
			bibleBookDismissed = null;
		}
	});

	/** On transition into Commentary only, fill reading_status default if untouched. */
	$effect(() => {
		const g = genre;
		const prev = prevGenreForDefaults;
		if (g === prev) return;
		untrack(() => {
			if (prev != null && g === 'Commentary' && prev !== 'Commentary') {
				if (reading_status === 'unread') reading_status = 'reference';
			}
			prevGenreForDefaults = g;
		});
	});

	const olScanMissingLabels = $derived.by(() => {
		const snap = olImportSnapshot;
		if (!snap || !scanSessionLayout) return [] as string[];
		const miss: string[] = [];
		if (!snap.publisher?.trim()) miss.push('Publisher');
		if (!snap.publisher_location?.trim()) miss.push('Publisher location');
		if (snap.page_count == null) miss.push('Page count');
		if (!snap.edition?.trim()) miss.push('Edition');
		if (snap.year == null) miss.push('Year');
		if (!snap.seriesName?.trim()) miss.push('Series');
		return miss;
	});

	const authorsJson = $derived(
		JSON.stringify(
			authorRows
				.filter(
					(a) => a.person_id.length > 0 || (a.prefillName?.trim().length ?? 0) > 0
				)
				.map((a, idx) => {
					if (a.person_id.length > 0) {
						return { person_id: a.person_id, role: a.role, sort_order: idx };
					}
					return { name: a.prefillName!.trim(), role: a.role, sort_order: idx };
				})
		)
	);

	// Seed fields once on mount (for edit mode pre-fill) and snapshot the
	// baseline so the dirty-form interceptor only fires on user-driven changes.
	// Wrap currentFormSnapshot in untrack so the snapshot's reads don't add
	// every form $state var to this $effect's dep set (Session 1.5c bug —
	// caused every keystroke to reset the form).
	$effect(() => {
		if (mode === 'edit' && book) {
			title = book.title ?? '';
			subtitle = book.subtitle ?? '';
			pub = {
				publisher: book.publisher ?? '',
				publisher_location: book.publisher_location ?? '',
				publisher_id: book.publisher_id ?? '',
				year: book.year != null ? String(book.year) : '',
				edition: book.edition ?? '',
				total_volumes: book.total_volumes != null ? String(book.total_volumes) : '',
				original_year: book.original_year != null ? String(book.original_year) : '',
				reprint_publisher: book.reprint_publisher ?? '',
				reprint_publisher_id: book.reprint_publisher_id ?? '',
				reprint_location: book.reprint_location ?? '',
				reprint_year: book.reprint_year != null ? String(book.reprint_year) : '',
				page_count: book.page_count != null ? String(book.page_count) : '',
				isbn: book.isbn ?? '',
				shelving_location: book.shelving_location ?? ''
			};
			series_id = book.series_id ?? '';
			volume_number = book.volume_number ?? '';
			genre = (book.genre as Genre | null) ?? '';
			work_type = book.work_type;
			language = book.language;
			barcode = book.barcode ?? '';
			reading_status = book.reading_status;
			borrowed_to = book.borrowed_to ?? '';
			personal_notes = book.personal_notes ?? '';
			rating = book.rating != null ? String(book.rating) : '';
			needs_review = book.needs_review;
			needs_review_note = book.needs_review_note ?? '';
			authorRows = book.authors.map((a, idx) => ({
				key: `existing-${idx}-${a.person_id}-${a.role}`,
				person_id: a.person_id,
				role: a.role
			}));
		}
		// Seed one empty author row so the search input is visible by default.
		// Covers create mode (where authorRows starts as []) and edit mode for
		// books with no existing authors. Empty seed row is filtered out at
		// submit by `authorsJson` and ignored by `hasAnyField`.
		//
		// CRITICAL: wrap the .length read in untrack(). Otherwise this $effect
		// adds authorRows.length to its dep set, and every add/remove (or
		// handleAutoCreatePerson reassignment) re-fires the effect — which
		// re-pre-fills fields from `book` (silently wiping user edits in edit
		// mode) and re-baselines initialSnapshot (silently flipping dirty back
		// to false). Same shape of bug as the Session 1.5c snapshot trap.
		if (untrack(() => authorRows.length === 0)) {
			authorRows = [
				{
					key: `seed-${Date.now()}-${Math.random()}`,
					person_id: '',
					role: 'author'
				}
			];
		}
		prevGenreForDefaults = untrack(() => genre);
		initialSnapshot = untrack(() => currentFormSnapshot());
	});

	$effect(() => {
		const p = openLibraryPrefill;
		if (!p || mode !== 'create') return;
		untrack(() => {
			const patch = applyOlPrefillFields({
				prefill: p,
				people,
				seriesRows,
				current: { genre, work_type, language }
			});
			applyOlPatchToForm(patch);
		});
		initialSnapshot = untrack(() => currentFormSnapshot());
		onOpenLibraryPrefillConsumed?.();
	});

	function openSeriesDialog(prefill?: { name?: string; abbreviation?: string }) {
		newSeriesName = prefill?.name?.trim() ?? '';
		newSeriesAbbrev = prefill?.abbreviation?.trim() ?? '';
		seriesDialogMessage = null;
		seriesDialogOpen = true;
	}

	async function submitSeriesDialog() {
		if (!browser) return;
		if (newSeriesName.trim().length === 0) {
			seriesDialogMessage = 'Name is required.';
			return;
		}
		seriesDialogPending = true;
		seriesDialogMessage = null;
		try {
			const fd = new FormData();
			fd.append('name', newSeriesName.trim());
			if (newSeriesAbbrev.trim()) fd.append('abbreviation', newSeriesAbbrev.trim());
			const resp = await fetch(seriesActionPath, {
				method: 'POST',
				headers: { 'x-sveltekit-action': 'true' },
				body: fd
			});
			const result = deserialize(await resp.text()) as ActionResult;
			if (result.type === 'success' || result.type === 'failure') {
				const data = (result.data ?? {}) as {
					kind?: string;
					seriesId?: string;
					series?: SeriesRow;
					message?: string;
				};
				if (result.type === 'failure' || !data.seriesId || !data.series) {
					seriesDialogMessage = data.message ?? 'Could not create series.';
					return;
				}
				const created = data.series;
				seriesRows = [...seriesRows, created].sort((a, b) => a.name.localeCompare(b.name));
				series_id = created.id;
				olSeriesHint = null;
				seriesDialogOpen = false;
				await invalidate('app:library:series').catch(() => {});
				await invalidate('app:library:facets').catch(() => {});
			} else {
				seriesDialogMessage = 'Network error creating series.';
			}
		} catch (err) {
			console.error(err);
			seriesDialogMessage = 'Network error creating series.';
		} finally {
			seriesDialogPending = false;
		}
	}

	const submitEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			if (result.type === 'failure') {
				console.error('[book form]', result.data);
			}
			await update();
			if (result.type === 'success') {
				const data = (result.data ?? {}) as { kind?: string; bookId?: string };
				const bookId = data.bookId;
				// Re-baseline so onDirtyChange flips back to false and the host's
				// beforeNavigate doesn't intercept the success-driven goto().
				initialSnapshot = currentFormSnapshot();
				const rt = returnToScannerAfterSave;
				returnToScannerAfterSave = false;
				if (bookId) onSaved?.(bookId, { returnToScanner: rt });
			}
		};
	};

	const olRefreshCurrent = $derived({
		title,
		subtitle,
		publisher: pub.publisher,
		publisher_location: pub.publisher_location,
		year: pub.year,
		edition: pub.edition,
		page_count: pub.page_count,
		isbn: pub.isbn,
		genre: genre === '' ? '' : genre,
		work_type
	});

	function applyOlRefresh(keys: OlApplyKey[], data: OpenLibraryBookPrefill) {
		const patch = applyOlRefreshPatch(keys, data);
		untrack(() => {
			applyOlPatchToForm(patch);
		});
		initialSnapshot = untrack(() => currentFormSnapshot());
	}
</script>

{#if formMessage?.message}
	<p
		class="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
		role="alert"
	>
		{formMessage.message}
	</p>
{/if}

{#if mode === 'edit' && book}
	<div class="mb-4 flex flex-wrap justify-end gap-2">
		<Button type="button" variant="outline" class="gap-2" onclick={() => (olRefreshOpen = true)}>
			<ScanBarcode class="size-4" /> Refresh from Open Library
		</Button>
	</div>
	{#if olRefreshOpen}
		{#await import('$lib/components/book-ol-refresh-dialog.svelte') then mod}
			<mod.default
				bind:open={olRefreshOpen}
				initialIsbn={pub.isbn}
				{publishers}
				current={olRefreshCurrent}
				onApply={applyOlRefresh}
			/>
		{/await}
	{/if}
{/if}

<form
	bind:this={bookFormEl}
	method="POST"
	action={formAction}
	use:enhance={submitEnhance}
	class="flex flex-col gap-6"
>
	{#if mode === 'edit' && book}
		<input type="hidden" name="id" value={book.id} />
	{/if}
	<input type="hidden" name="series_id" value={series_id} />
	<input type="hidden" name="genre" value={genre} />
	<input type="hidden" name="work_type" value={work_type} />
	<input type="hidden" name="language" value={language} />
	<input type="hidden" name="reading_status" value={reading_status} />
	<input type="hidden" name="needs_review" value={needs_review ? 'true' : 'false'} />
	<input type="hidden" name="authors_json" value={authorsJson} />
	<input type="hidden" name="barcode" value={barcode} />
	<input
		type="hidden"
		name="auto_bible_book"
		value={detectedBibleBook && bibleBookDismissed !== detectedBibleBook ? detectedBibleBook : ''}
	/>

		<!-- Identity (full width) -->
		<section class="flex flex-col gap-4">
			<h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
				Identity
			</h3>
			<div class="grid gap-4 md:grid-cols-2">
				<div class="space-y-2">
					<Label for="bf-title">Title</Label>
					<Input id="bf-title" name="title" bind:value={title} class="h-11 text-base" />
				</div>
				<div class="space-y-2">
					<Label for="bf-subtitle">Subtitle</Label>
					<Input
						id="bf-subtitle"
						name="subtitle"
						bind:value={subtitle}
						class="h-11 text-base"
					/>
				</div>
			</div>
		</section>

		<!-- Turabian-critical fields: always above scan summary / collapsible middle -->
		<section class="flex flex-col gap-4">
			<h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
				Citation essentials
			</h3>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
				<BookFormPublication variant="essentials" bind:pub {publishers} />
				<div class="space-y-2">
					<Label for="bf-genre">Genre</Label>
					<Select.Root type="single" bind:value={genre} items={genreSelectItems}>
						<Select.Trigger id="bf-genre" size="default" class="h-11 w-full justify-between px-3">
							<span data-slot="select-value" class="truncate text-left">
								{genre || '— None —'}
							</span>
						</Select.Trigger>
						<Select.Content class="max-h-72">
							<Select.Item
								value=""
								label="— None —"
								class="min-h-10 py-2 text-muted-foreground"
							>
								— None —
							</Select.Item>
							{#each GENRES as g (g)}
								<Select.Item value={g} label={g} class="min-h-10 py-2">
									{g}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2">
					<Label for="bf-work-type">Work type</Label>
					<Select.Root type="single" bind:value={work_type} items={workTypeSelectItems}>
						<Select.Trigger
							id="bf-work-type"
							size="default"
							class="h-11 w-full justify-between px-3"
						>
							<span data-slot="select-value" class="truncate text-left">
								{WORK_TYPE_LABELS[work_type]}
							</span>
						</Select.Trigger>
						<Select.Content class="max-h-72">
							{#each WORK_TYPES as wt (wt)}
								<Select.Item value={wt} label={WORK_TYPE_LABELS[wt]} class="min-h-10 py-2">
									{WORK_TYPE_LABELS[wt]}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>
		</section>

		{#if detectedBibleBook && bibleBookDismissed !== detectedBibleBook}
			<div
				class="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-950 dark:text-emerald-100"
			>
				Detected Bible book: <strong>{detectedBibleBook}</strong>. Will be added to commentary
				coverage on save.
				<button
					type="button"
					class="ml-2 inline font-medium text-primary underline-offset-4 hover:underline"
					onclick={() => (bibleBookDismissed = detectedBibleBook)}
				>
					Dismiss
				</button>
			</div>
		{/if}

		{#if scanSessionLayout}
			<section
				class="rounded-lg border border-border bg-muted/20 p-4 md:hidden"
				aria-label="Imported metadata summary"
			>
				<h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					Imported from scan
				</h3>
				<dl class="mt-2 space-y-1.5 text-sm">
					<div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
						<dt class="text-muted-foreground">Title</dt>
						<dd class="min-w-0 font-medium text-foreground">{title.trim() || '—'}</dd>
						<dt class="text-muted-foreground">ISBN</dt>
						<dd class="font-mono tabular-nums">{pub.isbn.trim() || '—'}</dd>
						<dt class="text-muted-foreground">Author</dt>
						<dd class="min-w-0">{olImportSnapshot?.authorTyped?.trim() || '—'}</dd>
						<dt class="text-muted-foreground">Genre</dt>
						<dd>{genre || '—'}</dd>
					</div>
				</dl>
				{#if olScanMissingLabels.length > 0}
					<p class="mt-2 text-xs text-muted-foreground">
						Missing from Open Library: {olScanMissingLabels.join(', ')}
					</p>
				{/if}
				<details class="mt-3 border-t border-border pt-2">
					<summary class="cursor-pointer text-xs font-medium text-primary">All field values</summary>
					<ul class="mt-2 space-y-1 break-words font-mono text-xs text-muted-foreground">
						<li>Subtitle: {subtitle.trim() || '—'}</li>
						<li>Edition: {pub.edition.trim() || '—'}</li>
						<li>Page count: {pub.page_count.trim() || '—'}</li>
					</ul>
				</details>
			</section>
		{/if}

		<BookFormAuthors
			bind:authorRows
			bind:people
			{personBookCounts}
			personActionPath={personActionPath}
		/>

		{#snippet middleFieldsGrid()}
		<!-- 2-col split: classification/state on left, publication/reprint/identifiers on right -->
		<div class="grid gap-6 lg:grid-cols-2 lg:gap-x-8">
			<!-- LEFT COLUMN -->
			<div class="flex flex-col gap-6">
				<!-- Classification -->
				<section class="flex flex-col gap-4">
					<h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
						Classification
					</h3>
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<Label for="bf-language"
								>Language <span class="text-destructive">*</span></Label
							>
							<Select.Root
								type="single"
								bind:value={language}
								items={languageSelectItems}
							>
								<Select.Trigger
									id="bf-language"
									size="default"
									class="h-11 w-full justify-between px-3"
								>
									<span data-slot="select-value" class="truncate text-left"
										>{languageLabel}</span
									>
								</Select.Trigger>
								<Select.Content class="max-h-72">
									{#each LANGUAGES as l (l)}
										<Select.Item
											value={l}
											label={LANGUAGE_LABELS[l]}
											class="min-h-10 py-2"
										>
											{LANGUAGE_LABELS[l]}
										</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						{#if olSeriesHint}
							<div
								class="sm:col-span-2 flex flex-col gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-950 dark:text-sky-100"
							>
								<p class="min-w-0">
									Open Library mentions series <strong>{olSeriesHint.name}</strong>{#if olSeriesHint.volume}
										<span class="text-muted-foreground"> (vol. </span><strong>{olSeriesHint.volume}</strong><span
											class="text-muted-foreground">)</span>{/if}. Create it here or in settings.
								</p>
								<div class="flex flex-wrap gap-2">
									<Button
										type="button"
										size="sm"
										hotkey="b"
										label="Create series"
										onclick={() => openSeriesDialog({ name: olSeriesHint?.name })}
									>
										Create series
									</Button>
									<a
										href="/settings/library/series"
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted/60"
									>
										Series settings
									</a>
									<Button type="button" variant="ghost" size="sm" onclick={() => (olSeriesHint = null)}>
										Dismiss
									</Button>
								</div>
							</div>
						{/if}
						<div class="space-y-2">
							<div class="flex items-center justify-between gap-2">
								<Label for="bf-series">Series</Label>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									class="h-8 shrink-0 px-2 text-xs"
									onclick={() => openSeriesDialog()}
								>
									<Plus class="size-3.5" aria-hidden="true" />
									New series
								</Button>
							</div>
							<Select.Root
								type="single"
								bind:value={series_id}
								items={seriesSelectItems}
							>
								<Select.Trigger
									id="bf-series"
									size="default"
									class="h-11 w-full justify-between px-3"
								>
									<span data-slot="select-value" class="truncate text-left"
										>{seriesLabel}</span
									>
								</Select.Trigger>
								<Select.Content class="max-h-72">
									{#each seriesSelectItems as s (s.value)}
										<Select.Item
											value={s.value}
											label={s.label}
											class="min-h-10 py-2"
										>
											{s.label}
										</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="space-y-2">
							<Label for="bf-volume">Volume number</Label>
							<Input
								id="bf-volume"
								name="volume_number"
								bind:value={volume_number}
								placeholder="e.g. IV, 2b"
								class="h-11 text-base"
							/>
						</div>
					</div>
				</section>

				<!-- State -->
				<section class="flex flex-col gap-4">
					<h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
						State
					</h3>
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<Label for="bf-status">Reading status</Label>
							<Select.Root
								type="single"
								bind:value={reading_status}
								items={readingStatusSelectItems}
							>
								<Select.Trigger
									id="bf-status"
									size="default"
									class="h-11 w-full justify-between px-3"
								>
									<span data-slot="select-value" class="truncate text-left"
										>{readingStatusLabel}</span
									>
								</Select.Trigger>
								<Select.Content class="max-h-72">
									{#each READING_STATUSES as s (s)}
										<Select.Item
											value={s}
											label={READING_STATUS_LABELS[s]}
											class="min-h-10 py-2"
										>
											{READING_STATUS_LABELS[s]}
										</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="space-y-2">
							<Label for="bf-borrowed">Borrowed to</Label>
							<Input
								id="bf-borrowed"
								name="borrowed_to"
								bind:value={borrowed_to}
								placeholder="(leave blank if at home)"
								class="h-11 text-base"
							/>
						</div>
						<div class="space-y-2">
							<Label for="bf-rating">Rating (1–5)</Label>
							<Input
								id="bf-rating"
								name="rating"
								type="number"
								inputmode="numeric"
								min="1"
								max="5"
								bind:value={rating}
								class="h-11 text-base tabular-nums"
							/>
						</div>
						<div class="space-y-2">
							<Label class="block">Needs review</Label>
							<label
								class="flex h-11 items-center gap-2 rounded-md border border-input bg-background px-3 text-base"
							>
								<input
									type="checkbox"
									bind:checked={needs_review}
									class="size-4"
								/>
								<span class="text-sm">Flag this book for review</span>
							</label>
						</div>
					</div>
					{#if needs_review}
						<div class="space-y-2">
							<Label for="bf-review-note">Review note</Label>
							<textarea
								id="bf-review-note"
								name="needs_review_note"
								bind:value={needs_review_note}
								rows={2}
								class="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
								placeholder="Why does this need review?"
							></textarea>
						</div>
					{/if}
				</section>
			</div>

			<!-- RIGHT COLUMN -->
			<div class="flex flex-col gap-6">
				<BookFormPublication variant="extended" bind:pub {publishers} />
			</div>
		</div>
		{/snippet}

		{#if scanSessionLayout}
			<details
				bind:open={middleFieldsOpen}
				class="mb-4 overflow-hidden rounded-lg border border-border bg-card"
			>
				<summary
					class="cursor-pointer px-4 py-3 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
				>
					More fields — classification, publication, identifiers
				</summary>
				<div
					class="max-h-[70vh] overflow-y-auto border-t border-border px-2 pb-4 pt-3 lg:max-h-none lg:overflow-visible lg:border-t-0 lg:px-0 lg:pb-0 lg:pt-0"
				>
					{@render middleFieldsGrid()}
				</div>
			</details>
		{:else}
			{@render middleFieldsGrid()}
		{/if}

		<!-- Personal notes (full width) -->
		<section class="flex flex-col gap-2 max-md:pb-8">
			<Label for="bf-notes" class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
				Personal notes
			</Label>
			<textarea
				id="bf-notes"
				name="personal_notes"
				bind:value={personal_notes}
				rows={5}
				class="flex min-h-32 w-full rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
			></textarea>
		</section>

		<!-- Save bar (sticky at scrollport bottom; tab bar is flex footer, not fixed) -->
		<div
			class="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur max-md:shadow-[0_-4px_12px_-4px_rgb(0_0_0/0.06)] max-md:dark:shadow-[0_-4px_12px_-4px_rgb(0_0_0/0.25)] sm:-mx-6 sm:px-6"
		>
			<div
				class="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:justify-end"
			>
				{#if onCancel}
					<Button
						type="button"
						variant="outline"
						class="h-10 w-full gap-1.5 text-sm sm:h-12 sm:w-auto sm:min-w-28 sm:text-base"
						disabled={pending}
						hotkey="Escape"
						onclick={onCancel}
					>
						<X class="size-4 shrink-0" />
						<HotkeyLabel label="Cancel" />
					</Button>
				{/if}
				{#if onBackToScanner}
					<Button
						type="button"
						variant="ghost"
						class="h-10 w-full gap-1.5 text-sm sm:h-12 sm:w-auto sm:min-w-32 sm:text-base"
						disabled={pending}
						onclick={onBackToScanner}
					>
						<ArrowLeft class="size-4 shrink-0" />
						Back to scanner
					</Button>
				{/if}
				{#if scanSessionLayout && mode === 'create'}
					<Button
						type="button"
						variant="secondary"
						class="h-10 w-full gap-1.5 text-sm sm:h-12 sm:w-auto sm:min-w-40 sm:text-base"
						disabled={pending || !hasAnyField}
						onclick={() => {
							returnToScannerAfterSave = true;
							bookFormEl?.requestSubmit();
						}}
					>
						<ScanBarcode class="size-4 shrink-0" />
						Save &amp; scan another
					</Button>
				{/if}
				<Button
					type="submit"
					class="h-10 w-full gap-1.5 text-sm sm:h-12 sm:w-auto sm:min-w-40 sm:px-8 sm:text-base"
					disabled={pending || !hasAnyField}
					hotkey={mode === 'create' ? 's' : 'u'}
					onpointerdown={() => {
						returnToScannerAfterSave = false;
					}}
				>
					<Save class="size-4 shrink-0" />
					<HotkeyLabel
						label={pending ? 'Saving…' : mode === 'create' ? 'Save book' : 'Update book'}
						mnemonic={mode === 'create' ? 's' : 'u'}
					/>
				</Button>
			</div>
			{#if !pending && !hasAnyField}
				<p class="text-center text-[11px] text-muted-foreground sm:text-right sm:text-xs">
					Add at least one detail (title, ISBN, an author, anything) before saving.
				</p>
			{:else if !pending && missingImportantPreview.length > 0 && !needs_review}
				<p class="text-center text-[11px] text-amber-700 sm:text-right sm:text-xs dark:text-amber-300">
					Will be auto-flagged for review (missing: {missingImportantPreview.join(', ')}).
				</p>
			{/if}
		</div>
	</form>

<Dialog.Root bind:open={seriesDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>New series</Dialog.Title>
			<Dialog.Description>Name is required; abbreviation is optional.</Dialog.Description>
		</Dialog.Header>

		{#if seriesDialogMessage}
			<p class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
				{seriesDialogMessage}
			</p>
		{/if}

		<div class="flex flex-col gap-3">
			<div class="space-y-2">
				<Label for="ns-name">Name <span class="text-destructive">*</span></Label>
				<Input id="ns-name" bind:value={newSeriesName} maxlength={300} class="h-11 text-base" required />
			</div>
			<div class="space-y-2">
				<Label for="ns-abbrev">Abbreviation</Label>
				<Input id="ns-abbrev" bind:value={newSeriesAbbrev} maxlength={32} class="h-11 text-base" />
			</div>
		</div>

		<Dialog.Footer class="flex-col gap-2 sm:flex-row sm:justify-end">
			<Button
				type="button"
				variant="outline"
				class="h-11"
				onclick={() => (seriesDialogOpen = false)}
				disabled={seriesDialogPending}
				hotkey="Escape"
				label="Cancel"
			/>
			<Button
				type="button"
				class="h-11"
				onclick={submitSeriesDialog}
				disabled={seriesDialogPending}
				hotkey="s"
				label={seriesDialogPending ? 'Saving…' : 'Add series'}
			/>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

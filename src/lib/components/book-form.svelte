<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { enhance, deserialize } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import PersonAutocomplete from '$lib/components/person-autocomplete.svelte';
	import { cn } from '$lib/utils.js';
	import {
		AUTHOR_ROLES,
		AUTHOR_ROLE_LABELS,
		GENRES,
		LANGUAGES,
		LANGUAGE_LABELS,
		READING_STATUSES,
		READING_STATUS_LABELS
	} from '$lib/types/library';
	import type {
		BookDetail,
		CategoryRow,
		SeriesRow,
		PersonRow,
		AuthorRole,
		Genre,
		Language,
		ReadingStatus
	} from '$lib/types/library';
	import type { OpenLibraryBookPrefill } from '$lib/library/open-library-prefill';
	import {
		matchPersonExact,
		matchPersonFuzzyCandidates,
		matchSeries,
		splitAuthorString
	} from '$lib/library/match';
	import BookOlRefreshDialog from '$lib/components/book-ol-refresh-dialog.svelte';
	import type { OlApplyKey } from '$lib/components/book-ol-refresh-dialog.svelte';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import ScanBarcode from '@lucide/svelte/icons/scan-barcode';

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

	type AuthorRow = {
		key: string;
		person_id: string;
		role: AuthorRole;
		/** Open Library name when `person_id` still needs linking. */
		prefillName?: string;
		fuzzyCandidates?: PersonRow[];
	};

	let {
		mode,
		book = null,
		people: initialPeople,
		personBookCounts,
		categories,
		series,
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
		categories: CategoryRow[];
		series: SeriesRow[];
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

	let title = $state('');
	let subtitle = $state('');
	let publisher = $state('');
	let publisher_location = $state('');
	let year = $state('');
	let edition = $state('');
	let total_volumes = $state('');
	let original_year = $state('');
	let reprint_publisher = $state('');
	let reprint_location = $state('');
	let reprint_year = $state('');
	let primary_category_id = $state('');
	let extra_category_ids = $state<string[]>([]);
	let series_id = $state<string>('');
	let volume_number = $state('');
	let genre = $state<Genre | ''>('');
	let language = $state<Language>('english');
	let isbn = $state('');
	let barcode = $state('');
	let shelving_location = $state('');
	let reading_status = $state<ReadingStatus>('unread');
	let borrowed_to = $state('');
	let personal_notes = $state('');
	let rating = $state('');
	let needs_review = $state<boolean>(false);
	let needs_review_note = $state('');
	let page_count = $state('');
	let authorRows = $state<AuthorRow[]>([]);

	let personDialogOpen = $state(false);
	let newPersonFirst = $state('');
	let newPersonMiddle = $state('');
	let newPersonLast = $state('');
	let newPersonSuffix = $state('');
	let personDialogMessage = $state<string | null>(null);
	let personDialogMessageTone = $state<'error' | 'warning'>('error');
	let personDialogPending = $state(false);
	let personDialogConfirmedDuplicate = $state(false);
	let pendingAuthorRowKey = $state<string | null>(null);

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
			publisher,
			publisher_location,
			year,
			edition,
			total_volumes,
			original_year,
			reprint_publisher,
			reprint_location,
			reprint_year,
			primary_category_id,
			extra_category_ids,
			series_id,
			volume_number,
			genre,
			language,
			isbn,
			barcode,
			shelving_location,
			reading_status,
			borrowed_to,
			personal_notes,
			rating,
			needs_review,
			needs_review_note,
			page_count,
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
			publisher,
			publisher_location,
			year,
			edition,
			total_volumes,
			original_year,
			reprint_publisher,
			reprint_location,
			reprint_year,
			volume_number,
			isbn,
			barcode,
			shelving_location,
			personal_notes,
			page_count,
			borrowed_to,
			rating,
			needs_review_note
		].some((v) => String(v ?? '').trim().length > 0) ||
			authorRows.some((a) => a.person_id) ||
			extra_category_ids.length > 0 ||
			!!primary_category_id ||
			!!series_id ||
			!!genre ||
			needs_review === true
	);

	const missingImportantPreview = $derived.by<string[]>(() => {
		const out: string[] = [];
		if (!title.trim()) out.push('title');
		if (authorRows.filter((a) => a.role === 'author' && a.person_id).length === 0)
			out.push('author');
		if (!genre) out.push('genre');
		if (!year || String(year).trim().length === 0) out.push('year');
		if (!publisher.trim()) out.push('publisher');
		return out;
	});

	const formAction = $derived(`?/${mode === 'create' ? 'createBook' : 'updateBook'}`);
	const personActionPath = '?/createPerson';

	const categorySelectItems = $derived([
		{ value: '', label: '— None —' },
		...categories.map((c) => ({ value: c.id, label: c.name }))
	]);
	const seriesSelectItems = $derived([
		{ value: '', label: '— None —' },
		...series.map((s) => ({
			value: s.id,
			label: s.abbreviation ? `${s.abbreviation} — ${s.name}` : s.name
		}))
	]);
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
	const authorRoleSelectItems = $derived(
		AUTHOR_ROLES.map((r) => ({ value: r, label: AUTHOR_ROLE_LABELS[r] }))
	);

	const primaryCategoryLabel = $derived.by(() => {
		if (!primary_category_id) return '— None —';
		const found = categories.find((c) => c.id === primary_category_id);
		return found?.name ?? '— None —';
	});
	const seriesLabel = $derived.by(() => {
		if (!series_id) return '— None —';
		const s = series.find((x) => x.id === series_id);
		if (!s) return '— None —';
		return s.abbreviation ? `${s.abbreviation} — ${s.name}` : s.name;
	});
	const languageLabel = $derived(LANGUAGE_LABELS[language]);
	const readingStatusLabel = $derived(READING_STATUS_LABELS[reading_status]);

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

	function isInitial(s: string): boolean {
		return /^[A-Za-z]\.?$/.test(s);
	}
	function stripDot(s: string): string {
		return s.replace(/\.$/, '');
	}

	/**
	 * Best-effort name parse with three input shapes:
	 *   "Bauckham"                  → { last: 'Bauckham' }
	 *   "Robert Bauckham"           → { first: 'Robert', last: 'Bauckham' }
	 *   "John Q. Smith"             → { first: 'John', middle: 'Q', last: 'Smith' }
	 *   "John Quincy Smith"         → { first: 'John Quincy', last: 'Smith' }
	 *   "Mary Anne T Smith"         → { first: 'Mary Anne', middle: 'T', last: 'Smith' }
	 *   "Bauckham, Richard"         → { first: 'Richard', last: 'Bauckham' }
	 *   "Bauckham, Richard J."      → { first: 'Richard', middle: 'J', last: 'Bauckham' }
	 */
	function parseTypedName(text: string): {
		first?: string;
		middle?: string;
		last?: string;
	} {
		const trimmed = text.trim();
		if (!trimmed) return {};

		// "Last, First Middle" — split on first comma
		if (trimmed.includes(',')) {
			const commaIdx = trimmed.indexOf(',');
			const last = trimmed.slice(0, commaIdx).trim();
			const after = trimmed.slice(commaIdx + 1).trim();
			if (!last) return {};
			const tokens = after.split(/\s+/).filter(Boolean);
			if (tokens.length === 0) return { last };
			if (tokens.length === 1) return { first: tokens[0], last };
			const lastTok = tokens[tokens.length - 1];
			if (isInitial(lastTok)) {
				return {
					first: tokens.slice(0, -1).join(' '),
					middle: stripDot(lastTok),
					last
				};
			}
			return { first: tokens.join(' '), last };
		}

		// "First [Middle] Last"
		const tokens = trimmed.split(/\s+/);
		if (tokens.length === 1) return { last: tokens[0] };
		if (tokens.length === 2) return { first: tokens[0], last: tokens[1] };
		const last = tokens[tokens.length - 1];
		const maybeMiddle = tokens[tokens.length - 2];
		if (isInitial(maybeMiddle)) {
			return {
				first: tokens.slice(0, -2).join(' '),
				middle: stripDot(maybeMiddle),
				last
			};
		}
		return { first: tokens.slice(0, -1).join(' '), last };
	}

	const dedupHints = $derived.by(() => {
		const map = new Map<string, number>();
		for (const p of people) {
			const initial = p.first_name?.trim().charAt(0).toLowerCase() ?? '';
			const key = `${p.last_name.toLowerCase()}|${initial}`;
			map.set(key, (map.get(key) ?? 0) + 1);
		}
		const out: Record<string, string | null> = {};
		for (const a of authorRows) {
			const p = people.find((x) => x.id === a.person_id);
			if (!p) {
				out[a.key] = null;
				continue;
			}
			const initial = p.first_name?.trim().charAt(0).toLowerCase() ?? '';
			const key = `${p.last_name.toLowerCase()}|${initial}`;
			const dupes = (map.get(key) ?? 0) - 1;
			out[a.key] =
				dupes > 0
					? `${dupes} other person(s) share "${p.last_name}, ${initial.toUpperCase()}." — confirm this is the right one.`
					: null;
		}
		return out;
	});

	const authorsJson = $derived(
		JSON.stringify(
			authorRows
				.filter((a) => a.person_id.length > 0)
				.map((a, idx) => ({
					person_id: a.person_id,
					role: a.role,
					sort_order: idx
				}))
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
			publisher = book.publisher ?? '';
			publisher_location = book.publisher_location ?? '';
			year = book.year != null ? String(book.year) : '';
			edition = book.edition ?? '';
			total_volumes = book.total_volumes != null ? String(book.total_volumes) : '';
			original_year = book.original_year != null ? String(book.original_year) : '';
			reprint_publisher = book.reprint_publisher ?? '';
			reprint_location = book.reprint_location ?? '';
			reprint_year = book.reprint_year != null ? String(book.reprint_year) : '';
			primary_category_id = book.primary_category_id ?? '';
			extra_category_ids = book.category_ids.filter((id) => id !== book.primary_category_id);
			series_id = book.series_id ?? '';
			volume_number = book.volume_number ?? '';
			genre = (book.genre as Genre | null) ?? '';
			language = book.language;
			isbn = book.isbn ?? '';
			barcode = book.barcode ?? '';
			shelving_location = book.shelving_location ?? '';
			reading_status = book.reading_status;
			borrowed_to = book.borrowed_to ?? '';
			personal_notes = book.personal_notes ?? '';
			rating = book.rating != null ? String(book.rating) : '';
			needs_review = book.needs_review;
			needs_review_note = book.needs_review_note ?? '';
			page_count = book.page_count != null ? String(book.page_count) : '';
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
		initialSnapshot = untrack(() => currentFormSnapshot());
	});

	$effect(() => {
		const p = openLibraryPrefill;
		if (!p || mode !== 'create') return;
		untrack(() => {
			const plist = people;
			const slist = series;

			if (p.title) title = p.title;
			if (p.subtitle != null && p.subtitle !== '') subtitle = p.subtitle;
			if (p.publisher != null && p.publisher !== '') publisher = p.publisher;
			if (p.publisher_location != null && p.publisher_location !== '')
				publisher_location = p.publisher_location;
			if (p.edition != null && p.edition !== '') edition = p.edition;
			if (p.year != null) year = String(p.year);
			if (p.page_count != null) page_count = String(p.page_count);
			if (p.isbn) isbn = p.isbn;
			if (p.genreSuggested && genre === '') genre = p.genreSuggested;
			if (p.languageCode) language = p.languageCode;

			olImportSnapshot = p;

			const seriesLabelRaw = p.seriesName?.trim() ?? '';
			if (seriesLabelRaw) {
				const matchedSeries = matchSeries(seriesLabelRaw, slist);
				if (matchedSeries) {
					series_id = matchedSeries.id;
					volume_number = p.seriesVolume ?? '';
					olSeriesHint = null;
				} else {
					olSeriesHint = { name: seriesLabelRaw, volume: p.seriesVolume };
					if (p.seriesVolume) volume_number = p.seriesVolume;
				}
			} else {
				olSeriesHint = null;
			}

			const authorList = Array.isArray(p.authors) ? p.authors : [];
			const names =
				authorList.length > 0
					? authorList.map((a) => a.name.trim()).filter(Boolean)
					: p.authorTyped
						? splitAuthorString(p.authorTyped)
						: [];

			const nextRows: AuthorRow[] = [];
			for (let idx = 0; idx < names.length; idx++) {
				const nm = names[idx]!;
				const exact = matchPersonExact(nm, plist);
				if (exact) {
					nextRows.push({
						key: `ol-${idx}-${exact.id}-${crypto.randomUUID()}`,
						person_id: exact.id,
						role: 'author'
					});
					continue;
				}
				const fuzzy = matchPersonFuzzyCandidates(nm, plist);
				nextRows.push({
					key: `ol-${idx}-${crypto.randomUUID()}`,
					person_id: '',
					role: 'author',
					prefillName: nm,
					...(fuzzy.length > 0 ? { fuzzyCandidates: fuzzy } : {})
				});
			}
			if (nextRows.length > 0) {
				authorRows = nextRows;
			}
		});
		initialSnapshot = untrack(() => currentFormSnapshot());
		onOpenLibraryPrefillConsumed?.();
	});

	function addAuthorRow() {
		authorRows = [
			...authorRows,
			{ key: `new-${Date.now()}-${Math.random()}`, person_id: '', role: 'author' }
		];
	}
	function removeAuthorRow(key: string) {
		authorRows = authorRows.filter((a) => a.key !== key);
	}
	function moveAuthor(key: string, delta: -1 | 1) {
		const idx = authorRows.findIndex((a) => a.key === key);
		if (idx < 0) return;
		const target = idx + delta;
		if (target < 0 || target >= authorRows.length) return;
		const next = authorRows.slice();
		[next[idx], next[target]] = [next[target], next[idx]];
		authorRows = next;
	}

	function applyAuthorFuzzyPick(rowKey: string, personId: string) {
		authorRows = authorRows.map((a) =>
			a.key === rowKey ? { key: a.key, person_id: personId, role: a.role } : a
		);
	}

	function toggleExtraCategory(id: string) {
		if (id === primary_category_id) return;
		extra_category_ids = extra_category_ids.includes(id)
			? extra_category_ids.filter((x) => x !== id)
			: [...extra_category_ids, id];
	}

	function openPersonDialog(
		rowKey: string | null,
		prefill?: { first?: string; middle?: string; last?: string }
	) {
		pendingAuthorRowKey = rowKey;
		newPersonFirst = prefill?.first ?? '';
		newPersonMiddle = prefill?.middle ?? '';
		newPersonLast = prefill?.last ?? '';
		newPersonSuffix = '';
		personDialogMessage = null;
		personDialogMessageTone = 'error';
		personDialogConfirmedDuplicate = false;
		personDialogOpen = true;
	}

	$effect(() => {
		newPersonFirst;
		newPersonLast;
		if (personDialogConfirmedDuplicate) {
			personDialogConfirmedDuplicate = false;
		}
		if (personDialogMessageTone === 'warning') {
			personDialogMessage = null;
		}
	});

	function findCollidingPeople(first: string, last: string): PersonRow[] {
		const lastLower = last.trim().toLowerCase();
		if (!lastLower) return [];
		const initial = first.trim().charAt(0).toLowerCase();
		return people.filter(
			(p) =>
				p.last_name.toLowerCase() === lastLower &&
				(p.first_name?.trim().charAt(0).toLowerCase() ?? '') === initial
		);
	}

	function formatPersonLong(p: PersonRow): string {
		return [p.first_name, p.middle_name, p.last_name, p.suffix]
			.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
			.join(' ');
	}

	async function submitPersonDialog() {
		if (!browser) return;
		if (newPersonLast.trim().length === 0) {
			personDialogMessage = 'Last name is required.';
			personDialogMessageTone = 'error';
			return;
		}
		if (!personDialogConfirmedDuplicate) {
			const collisions = findCollidingPeople(newPersonFirst, newPersonLast);
			if (collisions.length > 0) {
				const names = collisions
					.map((p) => [p.first_name, p.last_name].filter(Boolean).join(' '))
					.join(', ');
				personDialogMessage = `Already in your library: ${names}. Continue creating a separate person?`;
				personDialogMessageTone = 'warning';
				return;
			}
		}
		personDialogPending = true;
		personDialogMessage = null;
		personDialogMessageTone = 'error';
		try {
			const fd = new FormData();
			fd.append('first_name', newPersonFirst);
			fd.append('middle_name', newPersonMiddle);
			fd.append('last_name', newPersonLast);
			fd.append('suffix', newPersonSuffix);
			const resp = await fetch(personActionPath, {
				method: 'POST',
				headers: { 'x-sveltekit-action': 'true' },
				body: fd
			});
			const result = deserialize(await resp.text()) as ActionResult;
			if (result.type === 'success' || result.type === 'failure') {
				const data = (result.data ?? {}) as {
					kind?: string;
					personId?: string;
					message?: string;
				};
				if (result.type === 'failure' || !data.personId) {
					personDialogMessage = data.message ?? 'Could not create person.';
					return;
				}
				const personId = data.personId;
				const newPerson: PersonRow = {
					id: personId,
					first_name: newPersonFirst.trim() || null,
					middle_name: newPersonMiddle.trim() || null,
					last_name: newPersonLast.trim(),
					suffix: newPersonSuffix.trim() || null,
					aliases: []
				};
				people = [...people, newPerson].sort((a, b) =>
					a.last_name.localeCompare(b.last_name)
				);
				if (pendingAuthorRowKey) {
					authorRows = authorRows.map((a) =>
						a.key === pendingAuthorRowKey
							? { key: a.key, person_id: personId, role: a.role }
							: a
					);
				} else {
					authorRows = [
						...authorRows,
						{
							key: `new-${Date.now()}-${Math.random()}`,
							person_id: personId,
							role: 'author'
						}
					];
				}
				personDialogOpen = false;
				pendingAuthorRowKey = null;
				await invalidate('app:library:people').catch(() => {});
			} else {
				personDialogMessage = 'Network error creating person.';
			}
		} catch (err) {
			console.error(err);
			personDialogMessage = 'Network error creating person.';
		} finally {
			personDialogPending = false;
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
		publisher,
		publisher_location,
		year,
		edition,
		page_count,
		isbn,
		genre: genre === '' ? '' : genre
	});

	function applyOlRefresh(keys: OlApplyKey[], data: OpenLibraryBookPrefill) {
		const set = new Set(keys);
		untrack(() => {
			if (set.has('title') && data.title) title = data.title;
			if (set.has('subtitle') && data.subtitle != null) subtitle = data.subtitle;
			if (set.has('publisher') && data.publisher != null) publisher = data.publisher;
			if (set.has('publisher_location') && data.publisher_location != null)
				publisher_location = data.publisher_location;
			if (set.has('year') && data.year != null) year = String(data.year);
			if (set.has('edition') && data.edition != null) edition = data.edition;
			if (set.has('page_count') && data.page_count != null)
				page_count = String(data.page_count);
			if (set.has('isbn') && data.isbn) isbn = data.isbn;
			if (set.has('genre') && data.genreSuggested) genre = data.genreSuggested;
		});
		initialSnapshot = untrack(() => currentFormSnapshot());
	}
</script>

{#if categories.length === 0}
	<p class="text-sm text-muted-foreground">
		No categories found. Run <code>supabase/seed/library_seed.sql</code> against prod before
		adding books.
	</p>
{:else}
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
		<BookOlRefreshDialog
			bind:open={olRefreshOpen}
			initialIsbn={isbn}
			current={olRefreshCurrent}
			onApply={applyOlRefresh}
		/>
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
		<input type="hidden" name="primary_category_id" value={primary_category_id} />
		<input type="hidden" name="series_id" value={series_id} />
		<input type="hidden" name="genre" value={genre} />
		<input type="hidden" name="language" value={language} />
		<input type="hidden" name="reading_status" value={reading_status} />
		<input type="hidden" name="needs_review" value={needs_review ? 'true' : 'false'} />
		<input type="hidden" name="authors_json" value={authorsJson} />
		{#each extra_category_ids as cid (cid)}
			<input type="hidden" name="category_ids" value={cid} />
		{/each}
		{#if primary_category_id}
			<input type="hidden" name="category_ids" value={primary_category_id} />
		{/if}

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
						<dd class="font-mono tabular-nums">{isbn.trim() || '—'}</dd>
						<dt class="text-muted-foreground">Author</dt>
						<dd class="min-w-0">{olImportSnapshot?.authorTyped?.trim() || '—'}</dd>
						<dt class="text-muted-foreground">Publisher</dt>
						<dd class="min-w-0">{publisher.trim() || '—'}</dd>
						<dt class="text-muted-foreground">Year</dt>
						<dd>{year.trim() || '—'}</dd>
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
						<li>Publisher location: {publisher_location.trim() || '—'}</li>
						<li>Edition: {edition.trim() || '—'}</li>
						<li>Page count: {page_count.trim() || '—'}</li>
						<li>Barcode: {barcode.trim() || '—'}</li>
					</ul>
				</details>
			</section>
		{/if}

		<!-- Authors (full width) -->
		<section class="flex flex-col gap-3">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
					Authors
				</h3>
				<Button type="button" size="sm" variant="outline" onclick={addAuthorRow}>
					<Plus class="size-4" /> Add author
				</Button>
			</div>

			{#each authorRows as row, idx (row.key)}
				<div class="flex flex-col gap-2 rounded-md border-l-2 border-border bg-muted/20 p-3">
					{#if row.prefillName && !row.person_id && (row.fuzzyCandidates?.length ?? 0) > 0}
						<div
							class="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100"
						>
							<p>
								Open Library says <strong class="font-medium">{row.prefillName}</strong>. Possible
								match{row.fuzzyCandidates!.length > 1 ? 'es' : ''} in your library:
							</p>
							<div class="flex flex-wrap items-center gap-2">
								{#each row.fuzzyCandidates ?? [] as c (c.id)}
									{@const cnt = personBookCounts[c.id] ?? 0}
									<Button
										type="button"
										variant="outline"
										size="sm"
										class="min-h-9 text-xs"
										onclick={() => applyAuthorFuzzyPick(row.key, c.id)}
									>
										Use {formatPersonLong(c)} ({cnt} book{cnt === 1 ? '' : 's'})
									</Button>
								{/each}
								<Button
									type="button"
									variant="secondary"
									size="sm"
									class="min-h-9 text-xs"
									onclick={() =>
										row.prefillName && openPersonDialog(row.key, parseTypedName(row.prefillName))}
								>
									Create new
								</Button>
							</div>
						</div>
					{/if}
					<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
						<div class="min-w-0 flex-1">
							{#key row.key}
								<PersonAutocomplete
									bind:value={row.person_id}
									{people}
									{personBookCounts}
									initialQuery={row.prefillName ?? ''}
									seedKey={row.key}
									onCreate={(text) => openPersonDialog(row.key, parseTypedName(text))}
								/>
							{/key}
						</div>
						<Select.Root
							type="single"
							bind:value={row.role}
							items={authorRoleSelectItems}
						>
							<Select.Trigger
								id={`author-role-${row.key}`}
								size="default"
								class="h-12 min-h-11 w-full justify-between px-3 text-base sm:h-10 sm:w-40 sm:text-sm"
								aria-label="Role"
							>
								<span data-slot="select-value" class="truncate text-left">
									{AUTHOR_ROLE_LABELS[row.role]}
								</span>
							</Select.Trigger>
							<Select.Content>
								{#each AUTHOR_ROLES as r (r)}
									<Select.Item
										value={r}
										label={AUTHOR_ROLE_LABELS[r]}
										class="min-h-10 py-2"
									>
										{AUTHOR_ROLE_LABELS[r]}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<div class="flex min-h-11 items-center gap-1 self-end sm:min-h-0 sm:self-auto">
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label="Move up"
								disabled={idx === 0}
								onclick={() => moveAuthor(row.key, -1)}
								class={cn('min-h-11 min-w-11 sm:min-h-0 sm:min-w-0', authorRows.length === 1 && 'invisible')}
							>
								<ChevronUp class="size-4" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label="Move down"
								disabled={idx === authorRows.length - 1}
								onclick={() => moveAuthor(row.key, 1)}
								class={cn('min-h-11 min-w-11 sm:min-h-0 sm:min-w-0', authorRows.length === 1 && 'invisible')}
							>
								<ChevronDown class="size-4" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label="Remove author"
								onclick={() => removeAuthorRow(row.key)}
								class="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
							>
								<X class="size-4" />
							</Button>
						</div>
					</div>
					{#if dedupHints[row.key]}
						<p
							class="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-200"
						>
							{dedupHints[row.key]}
						</p>
					{/if}
				</div>
			{/each}
		</section>

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
							<Label for="bf-genre">Genre</Label>
							<Select.Root
								type="single"
								bind:value={genre}
								items={genreSelectItems}
							>
								<Select.Trigger
									id="bf-genre"
									size="default"
									class="h-11 w-full justify-between px-3"
								>
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

					<div class="space-y-2">
						<Label for="bf-primary-cat">Primary category</Label>
						<Select.Root
							type="single"
							bind:value={primary_category_id}
							items={categorySelectItems}
						>
							<Select.Trigger
								id="bf-primary-cat"
								size="default"
								class="h-11 w-full justify-between px-3"
							>
								<span data-slot="select-value" class="truncate text-left"
									>{primaryCategoryLabel}</span
								>
							</Select.Trigger>
							<Select.Content class="max-h-72">
								<Select.Item
									value=""
									label="— None —"
									class="min-h-10 py-2 text-muted-foreground"
								>
									— None —
								</Select.Item>
								{#each categories as c (c.id)}
									<Select.Item value={c.id} label={c.name} class="min-h-10 py-2">
										{c.name}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>

					<div class="space-y-2">
						<Label class="text-sm font-medium">Additional categories</Label>
						<p class="text-xs text-muted-foreground">Pick any extras beyond the primary.</p>
						<div class="flex flex-wrap gap-2">
							{#each categories as c (c.id)}
								{@const isPrimary = c.id === primary_category_id}
								{@const checked = isPrimary || extra_category_ids.includes(c.id)}
								<button
									type="button"
									onclick={() => toggleExtraCategory(c.id)}
									disabled={isPrimary}
									class={cn(
										'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
										checked
											? 'border-foreground/40 bg-foreground/10 text-foreground'
											: 'border-border bg-background text-muted-foreground hover:bg-muted',
										isPrimary && 'cursor-default opacity-70'
									)}
									aria-pressed={checked}
								>
									{c.name}{#if isPrimary} <span class="text-[10px] uppercase">primary</span>{/if}
								</button>
							{/each}
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
											class="text-muted-foreground">)</span>{/if}. Add it under Settings, then pick it here.
								</p>
								<div class="flex flex-wrap gap-2">
									<a
										href="/settings/library/series"
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted/60"
									>
										Open series settings
									</a>
									<Button type="button" variant="ghost" size="sm" onclick={() => (olSeriesHint = null)}>
										Dismiss
									</Button>
								</div>
							</div>
						{/if}
						<div class="space-y-2">
							<Label for="bf-series">Series</Label>
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
				<!-- Publication -->
				<section class="flex flex-col gap-4">
					<h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
						Publication
					</h3>
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<Label for="bf-pub">Publisher</Label>
							<Input
								id="bf-pub"
								name="publisher"
								bind:value={publisher}
								class="h-11 text-base"
							/>
						</div>
						<div class="space-y-2">
							<Label for="bf-pub-loc">Publisher location</Label>
							<Input
								id="bf-pub-loc"
								name="publisher_location"
								bind:value={publisher_location}
								class="h-11 text-base"
							/>
						</div>
						<div class="space-y-2">
							<Label for="bf-year">Year</Label>
							<Input
								id="bf-year"
								name="year"
								type="number"
								inputmode="numeric"
								bind:value={year}
								class="h-11 text-base tabular-nums"
							/>
						</div>
						<div class="space-y-2">
							<Label for="bf-edition">Edition</Label>
							<Input
								id="bf-edition"
								name="edition"
								bind:value={edition}
								class="h-11 text-base"
							/>
						</div>
						<div class="space-y-2">
							<Label for="bf-volumes">Total volumes</Label>
							<Input
								id="bf-volumes"
								name="total_volumes"
								type="number"
								inputmode="numeric"
								bind:value={total_volumes}
								class="h-11 text-base tabular-nums"
							/>
						</div>
						<div class="space-y-2">
							<Label for="bf-pages">Page count</Label>
							<Input
								id="bf-pages"
								name="page_count"
								type="number"
								inputmode="numeric"
								bind:value={page_count}
								class="h-11 text-base tabular-nums"
							/>
						</div>
					</div>
				</section>

				<!-- Reprint -->
				<section class="flex flex-col gap-4">
					<h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
						Reprint (optional)
					</h3>
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<Label for="bf-orig-year">Original year</Label>
							<Input
								id="bf-orig-year"
								name="original_year"
								type="number"
								inputmode="numeric"
								bind:value={original_year}
								class="h-11 text-base tabular-nums"
							/>
						</div>
						<div class="space-y-2">
							<Label for="bf-rep-year">Reprint year</Label>
							<Input
								id="bf-rep-year"
								name="reprint_year"
								type="number"
								inputmode="numeric"
								bind:value={reprint_year}
								class="h-11 text-base tabular-nums"
							/>
						</div>
						<div class="space-y-2">
							<Label for="bf-rep-pub">Reprint publisher</Label>
							<Input
								id="bf-rep-pub"
								name="reprint_publisher"
								bind:value={reprint_publisher}
								class="h-11 text-base"
							/>
						</div>
						<div class="space-y-2">
							<Label for="bf-rep-loc">Reprint location</Label>
							<Input
								id="bf-rep-loc"
								name="reprint_location"
								bind:value={reprint_location}
								class="h-11 text-base"
							/>
						</div>
					</div>
				</section>

				<!-- Identifiers + shelf -->
				<section class="flex flex-col gap-4">
					<h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
						Identifiers & shelf
					</h3>
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<Label for="bf-isbn">ISBN</Label>
							<Input
								id="bf-isbn"
								name="isbn"
								bind:value={isbn}
								class="h-11 text-base tabular-nums"
							/>
						</div>
						<div class="space-y-2">
							<Label for="bf-barcode">Barcode</Label>
							<Input
								id="bf-barcode"
								name="barcode"
								bind:value={barcode}
								class="h-11 text-base tabular-nums"
							/>
						</div>
						<div class="space-y-2 sm:col-span-2">
							<Label for="bf-shelving">Shelving location</Label>
							<Input
								id="bf-shelving"
								name="shelving_location"
								bind:value={shelving_location}
								placeholder="e.g. Office, top shelf"
								class="h-11 text-base"
							/>
						</div>
					</div>
				</section>
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

		<!-- Save bar (sticky; max-md bottom offset clears fixed module tab bar) -->
		<div
			class="sticky z-10 -mx-4 flex flex-col gap-2 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur max-md:bottom-20 max-md:shadow-[0_-4px_12px_-4px_rgb(0_0_0/0.06)] max-md:dark:shadow-[0_-4px_12px_-4px_rgb(0_0_0/0.25)] md:bottom-0 sm:-mx-6 sm:px-6"
		>
			<div class="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
				{#if onCancel}
					<Button
						type="button"
						variant="outline"
						class="h-12 w-full text-base sm:w-auto sm:min-w-28"
						disabled={pending}
						hotkey="Escape"
						label="Cancel"
						onclick={onCancel}
					/>
				{/if}
				{#if onBackToScanner}
					<Button
						type="button"
						variant="ghost"
						class="h-12 w-full text-base sm:w-auto sm:min-w-32"
						disabled={pending}
						onclick={onBackToScanner}
					>
						Back to scanner
					</Button>
				{/if}
				{#if scanSessionLayout && mode === 'create'}
					<Button
						type="button"
						variant="secondary"
						class="h-12 w-full text-base sm:w-auto sm:min-w-40"
						disabled={pending || !hasAnyField}
						onclick={() => {
							returnToScannerAfterSave = true;
							bookFormEl?.requestSubmit();
						}}
					>
						Save &amp; scan another
					</Button>
				{/if}
				<Button
					type="submit"
					class="h-12 w-full text-base sm:w-auto sm:min-w-40 sm:px-8"
					disabled={pending || !hasAnyField}
					hotkey={mode === 'create' ? 's' : 'u'}
					label={pending ? 'Saving…' : mode === 'create' ? 'Save book' : 'Update book'}
					onpointerdown={() => {
						returnToScannerAfterSave = false;
					}}
				/>
			</div>
			{#if !pending && !hasAnyField}
				<p class="text-center text-xs text-muted-foreground sm:text-right">
					Add at least one detail (title, ISBN, an author, anything) before saving.
				</p>
			{:else if !pending && missingImportantPreview.length > 0 && !needs_review}
				<p class="text-center text-xs text-amber-700 sm:text-right dark:text-amber-300">
					Will be auto-flagged for review (missing: {missingImportantPreview.join(', ')}).
				</p>
			{/if}
		</div>
	</form>
{/if}

<Dialog.Root bind:open={personDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add person</Dialog.Title>
			<Dialog.Description>
				Last name is required. First / middle / suffix are optional but help with citations
				later.
			</Dialog.Description>
		</Dialog.Header>

		{#if personDialogMessage}
			<p
				class={cn(
					'rounded-md border px-3 py-2 text-sm',
					personDialogMessageTone === 'warning'
						? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
						: 'border-destructive/30 bg-destructive/10 text-destructive'
				)}
				role={personDialogMessageTone === 'warning' ? 'status' : 'alert'}
			>
				{personDialogMessage}
			</p>
		{/if}

		<div class="flex flex-col gap-3">
			<div class="space-y-2">
				<Label for="np-first">First name</Label>
				<Input id="np-first" bind:value={newPersonFirst} class="h-11 text-base" />
			</div>
			<div class="space-y-2">
				<Label for="np-middle">Middle name</Label>
				<Input id="np-middle" bind:value={newPersonMiddle} class="h-11 text-base" />
			</div>
			<div class="space-y-2">
				<Label for="np-last">Last name <span class="text-destructive">*</span></Label>
				<Input id="np-last" bind:value={newPersonLast} class="h-11 text-base" required />
			</div>
			<div class="space-y-2">
				<Label for="np-suffix">Suffix</Label>
				<Input
					id="np-suffix"
					bind:value={newPersonSuffix}
					placeholder="Jr., III"
					class="h-11 text-base"
				/>
			</div>
		</div>

		<Dialog.Footer class="flex-col gap-2 sm:flex-row sm:justify-end">
			<Button
				type="button"
				variant="outline"
				class="h-11"
				onclick={() => (personDialogOpen = false)}
				disabled={personDialogPending}
				hotkey="Escape"
				label="Cancel"
			/>
			{#if personDialogMessageTone === 'warning' && personDialogMessage}
				<Button
					type="button"
					variant="default"
					class="h-11"
					onclick={() => {
						personDialogConfirmedDuplicate = true;
						submitPersonDialog();
					}}
					disabled={personDialogPending}
					hotkey="s"
					label={personDialogPending ? 'Saving…' : 'Continue anyway'}
				/>
			{:else}
				<Button
					type="button"
					class="h-11"
					onclick={submitPersonDialog}
					disabled={personDialogPending}
					hotkey="s"
					label={personDialogPending ? 'Saving…' : 'Add person'}
				/>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

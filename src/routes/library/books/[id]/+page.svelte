<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { beforeNavigate, goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Pencil from '@lucide/svelte/icons/pencil';
	import ScanBarcode from '@lucide/svelte/icons/scan-barcode';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import Plus from '@lucide/svelte/icons/plus';
	import MoreHorizontal from '@lucide/svelte/icons/more-horizontal';
	import Copy from '@lucide/svelte/icons/copy';
	import {
		copyAllFieldsLine,
		copyAuthorsLine,
		copyPublisherYearLine,
		copyTitleLine
	} from '$lib/library/book-copy-text';
	import {
		bookDetailToCitationInput,
		copyCitationToClipboard,
		formatBibliography,
		formatFootnote
	} from '$lib/library/turabian';
	import {
		LIBRARY_ANCIENT_TEXTS_JSON,
		LIBRARY_TOPIC_COUNTS_JSON
	} from '$lib/library/vocab-cache-paths';
	import {
		AUTHOR_ROLE_LABELS,
		LANGUAGE_LABELS,
		READING_STATUSES,
		READING_STATUS_LABELS,
		WORK_TYPE_LABELS
	} from '$lib/types/library';
	import type {
		AncientTextRow,
		BookListRow,
		BookTopicRow,
		EssayRow,
		ReadingStatus,
		ScriptureRefRow,
		TopicCount
	} from '$lib/types/library';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import BookEssaysEditor from '$lib/components/book-essays-editor.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import type { PageProps } from './$types';
	import { cn } from '$lib/utils.js';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Image from '@lucide/svelte/icons/image';

	let { data, form }: PageProps = $props();

	const bookInvalidateKey = $derived(`app:library:book:${data.book.id}`);
	async function invalidateBook() {
		await invalidate(bookInvalidateKey);
	}

	let bookActionsSheetOpen = $state(false);

	const bookTitleLabel = $derived(
		data.book.title?.trim() ? data.book.title : '(untitled book)'
	);
	const bookTitleIsPlaceholder = $derived(!data.book.title?.trim());

	let deletePending = $state(false);
	let confirmDeleteBookOpen = $state(false);
	let bookDeleteFormEl = $state<HTMLFormElement | null>(null);
	let statusOptimistic = $state<ReadingStatus | null>(null);

	const effectiveStatus = $derived<ReadingStatus>(
		statusOptimistic ?? data.book.reading_status
	);

	const statusSubmit: SubmitFunction = ({ formData }) => {
		const next = formData.get('reading_status');
		if (typeof next === 'string') {
			statusOptimistic = next as ReadingStatus;
		}
		return async ({ update }) => {
			await update({ reset: false });
			statusOptimistic = null;
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

	const deleteEnhance: SubmitFunction = () => {
		deletePending = true;
		return async ({ update }) => {
			await update({ reset: false });
			deletePending = false;
			confirmDeleteBookOpen = false;
		};
	};

	function confirmDeleteBook() {
		bookDeleteFormEl?.requestSubmit();
	}

	function fmtYearChunk(): string {
		const parts: string[] = [];
		if (data.book.publisher_location) parts.push(data.book.publisher_location);
		if (data.book.publisher) parts.push(data.book.publisher);
		const head = parts.join(': ');
		const yearStr = data.book.year != null ? String(data.book.year) : '';
		return [head, yearStr].filter((s) => s.length > 0).join(', ');
	}

	let copyToast = $state<string | null>(null);
	let copyToastTimer: ReturnType<typeof setTimeout> | null = null;

	function flashCopyToast(message: string) {
		copyToast = message;
		if (copyToastTimer != null) clearTimeout(copyToastTimer);
		copyToastTimer = setTimeout(() => {
			copyToast = null;
			copyToastTimer = null;
		}, 2500);
	}

	async function copyToClipboard(label: string, text: string) {
		if (!browser) return;
		const t = text.trim();
		if (!t) {
			flashCopyToast('Nothing to copy.');
			return;
		}
		try {
			await navigator.clipboard.writeText(t);
			flashCopyToast(`Copied ${label}.`);
		} catch {
			flashCopyToast('Clipboard unavailable.');
		}
	}

	const citationInput = $derived(bookDetailToCitationInput(data.book));
	const citationFootnote = $derived(formatFootnote(citationInput));
	const citationBibliography = $derived(formatBibliography(citationInput));

	const showEssaysSection = $derived(
		data.book.work_type === 'reference_work' || data.book.work_type === 'edited_volume'
	);

	let essays = $state<EssayRow[]>([]);
	$effect(() => {
		void data.essaysPromise.then((rows) => {
			essays = rows;
		});
	});

	const essayFormMessage = $derived.by(() => {
		const f = form as {
			kind?: string;
			message?: string;
			essayId?: string;
			success?: boolean;
		} | null;
		if (!f) return null;
		if (
			f.kind === 'createEssay' ||
			f.kind === 'updateEssay' ||
			f.kind === 'softDeleteEssay'
		) {
			return f;
		}
		return null;
	});

	async function onEssaySaved() {
		await invalidateBook();
	}

	function essayPreviewLabel(essay: EssayRow): string {
		const author = essay.authors[0]?.person_label?.trim();
		if (author) return `${essay.essay_title} (${author})`;
		return essay.essay_title;
	}

	const essayPreviewRows = $derived(essays.slice(0, 3));
	const essayPreviewExtra = $derived(Math.max(0, essays.length - essayPreviewRows.length));

	async function copyTurabian(kind: 'footnote' | 'bibliography') {
		if (!browser) return;
		const citation = kind === 'footnote' ? citationFootnote : citationBibliography;
		if (!citation.plain) {
			flashCopyToast('Nothing to copy.');
			return;
		}
		try {
			await copyCitationToClipboard(citation);
			flashCopyToast(`Copied ${kind}.`);
		} catch {
			flashCopyToast('Clipboard unavailable.');
		}
	}

	// -------------------------------------------------------------------------
	// Scripture references section
	// -------------------------------------------------------------------------

	// `<SourcePicker lockedBookId>` reads the label from the books prop, so
	// pass a single-entry list synthesized from the current detail.
	const sourcePickerBooks: BookListRow[] = $derived([
		{
			id: data.book.id,
			title: data.book.title,
			subtitle: data.book.subtitle,
			work_type: data.book.work_type,
			genre: data.book.genre,
			language: data.book.language,
			reading_status: data.book.reading_status,
			needs_review: data.book.needs_review,
			series_abbreviation: data.book.series_abbreviation,
			series_name: data.book.series_name,
			volume_number: data.book.volume_number,
			publisher_id: data.book.publisher_id,
			publisher_canonical: data.book.publisher_canonical,
			publisher_effective_location: data.book.publisher_effective_location,
			authors_label: (() => {
				const authorLabels = data.book.authors
					.filter((a) => a.role === 'author')
					.map((a) => a.person_label);
				if (authorLabels.length > 0) return authorLabels.join(', ');
				if (data.book.work_type === 'monograph') return null;
				const editorLabels = data.book.authors
					.filter((a) => a.role === 'editor')
					.map((a) => a.person_label);
				if (editorLabels.length === 0) return null;
				return `${editorLabels.join(', ')}${editorLabels.length === 1 ? ', ed.' : ', eds.'}`;
			})()
		}
	]);

	// Optimistic local list — start from server state, mutate on add/edit/delete
	// for snappy feedback. After invalidate(book) the canonical state takes over.
	let refs = $state<ScriptureRefRow[]>([]);
	let scriptureRefsLoading = $state(true);

	$effect(() => {
		const p = data.scriptureRefsPromise;
		scriptureRefsLoading = true;
		void p
			.then((rows) => {
				refs = rows;
			})
			.catch(() => {
				refs = [];
			})
			.finally(() => {
				scriptureRefsLoading = false;
			});
	});

	let addOpen = $state(false);
	let batchFormDirty = $state(false);
	let confirmedBatchDiscard = $state(false);
	let batchDiscardOpen = $state(false);
	let pendingBatchNav = $state<URL | null>(null);
	/** Scroll batch form into view when opening (dense scripture block is long). */
	let scriptureAddFormEl = $state<HTMLElement | null>(null);
	let editingId = $state<string | null>(null);
	let pendingDeleteId = $state<string | null>(null);
	let confirmDeleteOpen = $state(false);

	/** Closed by default when the book has refs; open when empty, adding, or deep-linked. */
	let refsOpen = $state(false);
	let recordedImagesOpen = $state(false);
	let scriptureRefsBookId: string | null = null;
	$effect(() => {
		const id = data.book.id;
		if (scriptureRefsBookId !== id) {
			scriptureRefsBookId = id;
			recordedImagesOpen = false;
		}
	});

	$effect(() => {
		if (scriptureRefsLoading || scriptureRefsBookId !== data.book.id) return;
		refsOpen = refs.length === 0 || addOpen;
	});

	$effect(() => {
		if (addOpen) refsOpen = true;
	});

	$effect(() => {
		if (!addOpen) {
			batchFormDirty = false;
			confirmedBatchDiscard = false;
		}
	});

	beforeNavigate(({ cancel, to, type }) => {
		if (!addOpen || !batchFormDirty || confirmedBatchDiscard) return;
		if (type === 'leave') return;
		if (!to) return;
		if (
			to.url.pathname === page.url.pathname &&
			to.url.search === page.url.search
		) {
			return;
		}
		cancel();
		pendingBatchNav = to.url;
		batchDiscardOpen = true;
	});

	function discardBatchAndGo() {
		confirmedBatchDiscard = true;
		batchDiscardOpen = false;
		const next = pendingBatchNav;
		pendingBatchNav = null;
		if (next) goto(next);
	}

	$effect(() => {
		if (!browser || !addOpen) return;
		queueMicrotask(() => {
			requestAnimationFrame(() => {
				scriptureAddFormEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});
		});
	});

	$effect(() => {
		if (scriptureRefsLoading) return;
		if (refs.length === 0 && !addOpen) refsOpen = true;
	});

	const uniqueImageRefs = $derived.by(() => {
		const seen = new Map<
			string,
			{ source_image_url: string; source_image_signed_url: string; refCount: number }
		>();
		for (const r of refs) {
			if (!r.source_image_url || !r.source_image_signed_url) continue;
			const existing = seen.get(r.source_image_url);
			if (existing) existing.refCount += 1;
			else
				seen.set(r.source_image_url, {
					source_image_url: r.source_image_url,
					source_image_signed_url: r.source_image_signed_url,
					refCount: 1
				});
		}
		return [...seen.values()];
	});

	// Hash-driven scroll + briefly highlight the matching ref. Triggered by
	// deep links from /library/search-passage (?#ref-<uuid>). The effect tracks
	// page.url.hash so it re-fires on hash-only navigation, not just on mount.
	const UUID_HASH_RE = /^#ref-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
	let highlightedRefId = $state<string | null>(null);
	let highlightTimer: number | null = null;
	$effect(() => {
		if (!browser) return;
		const m = page.url.hash.match(UUID_HASH_RE);
		if (!m) return;
		const id = m[1];
		// Wait for the matching <li> to be in the DOM (refs are populated by
		// the parallel $effect above — both fire on load, ordering is racy).
		const tryScroll = () => {
			refsOpen = true;
			const el = document.getElementById(`ref-${id}`);
			if (!el) {
				if (refs.find((r) => r.id === id)) {
					// Row is in state but not yet rendered; bail.
					return;
				}
				return;
			}
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			highlightedRefId = id;
			if (highlightTimer != null) clearTimeout(highlightTimer);
			highlightTimer = window.setTimeout(() => {
				highlightedRefId = null;
				highlightTimer = null;
			}, 2200);
		};
		// Defer to next frame so we run after the {#each} finishes mounting.
		queueMicrotask(() => {
			requestAnimationFrame(() => {
				requestAnimationFrame(tryScroll);
			});
		});
	});

	const formMessage = $derived.by(() => {
		const f = form as { kind?: string; message?: string; refId?: string } | null;
		if (!f) return null;
		if (
			f.kind === 'createScriptureRef' ||
			f.kind === 'createScriptureRefsBatch' ||
			f.kind === 'updateScriptureRef' ||
			f.kind === 'softDeleteScriptureRef' ||
			f.kind === 'extractScriptureRefs'
		) {
			return f;
		}
		return null;
	});

	// Group refs by bible_book in canon order (driven by data.bibleBookNames).
	type RefGroup = { bible_book: string; rows: ScriptureRefRow[] };
	const groupedRefs = $derived.by<RefGroup[]>(() => {
		const map = new Map<string, ScriptureRefRow[]>();
		for (const r of refs) {
			const arr = map.get(r.bible_book) ?? [];
			arr.push(r);
			map.set(r.bible_book, arr);
		}
		const out: RefGroup[] = [];
		for (const name of data.bibleBookNames) {
			const rows = map.get(name);
			if (rows && rows.length > 0) {
				out.push({ bible_book: name, rows });
				map.delete(name);
			}
		}
		// Any leftover (orphan bible_book strings) sort alphabetically at the end.
		for (const [name, rows] of [...map.entries()].sort(([a], [b]) => a.localeCompare(b))) {
			out.push({ bible_book: name, rows });
		}
		return out;
	});

	function fmtRef(r: ScriptureRefRow): string {
		const cs = r.chapter_start;
		const vs = r.verse_start;
		const ce = r.chapter_end;
		const ve = r.verse_end;
		if (cs == null && ce == null) return r.bible_book; // whole book
		const startPart =
			cs != null && vs != null
				? `${cs}:${vs}`
				: cs != null
					? `${cs}`
					: '';
		const endPart =
			ce != null && ve != null
				? `${ce}:${ve}`
				: ce != null
					? `${ce}`
					: '';
		// Collapse same-chapter ranges: 2:1–11 instead of 2:1–2:11.
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

	function fmtRefRangeOnly(r: ScriptureRefRow): string {
		const cs = r.chapter_start;
		const vs = r.verse_start;
		const ce = r.chapter_end;
		const ve = r.verse_end;
		if (cs == null && ce == null) return '—';
		const startPart =
			cs != null && vs != null
				? `${cs}:${vs}`
				: cs != null
					? `${cs}`
					: '';
		const endPart =
			ce != null && ve != null
				? `${ce}:${ve}`
				: ce != null
					? `${ce}`
					: '';
		let rangeText = startPart;
		if (endPart && endPart !== startPart) {
			if (cs != null && ce != null && cs === ce && ve != null && ve !== vs) {
				rangeText = `${startPart}–${ve}`;
			} else {
				rangeText = `${startPart}–${endPart}`;
			}
		}
		return rangeText.trim();
	}

	function fmtPages(r: ScriptureRefRow): string {
		if (!r.page_start) return '';
		const end = r.page_end ?? '';
		return end && end !== r.page_start
			? `pp. ${r.page_start}–${end}`
			: `p. ${r.page_start}`;
	}

	function startEdit(id: string) {
		editingId = id;
		addOpen = false;
		refsOpen = true;
	}

	function cancelEdit() {
		editingId = null;
	}

	async function onCreatedBatch(refIds: string[]) {
		addOpen = false;
		await invalidateBook();
	}

	async function onUpdated(refId: string) {
		editingId = null;
		await invalidateBook();
	}

	function requestDelete(id: string) {
		pendingDeleteId = id;
		confirmDeleteOpen = true;
	}

	let deleteRefPending = $state(false);
	let deleteFormEl = $state<HTMLFormElement | null>(null);
	let deleteIdField = $state<HTMLInputElement | null>(null);

	function confirmDelete() {
		if (!pendingDeleteId || !deleteFormEl || !deleteIdField) return;
		deleteIdField.value = pendingDeleteId;
		deleteFormEl.requestSubmit();
	}

	const deleteRefEnhance: SubmitFunction = () => {
		deleteRefPending = true;
		const removingId = pendingDeleteId;
		// Optimistic remove.
		if (removingId) refs = refs.filter((r) => r.id !== removingId);
		return async ({ result }) => {
			deleteRefPending = false;
			confirmDeleteOpen = false;
			pendingDeleteId = null;
			if (result.type === 'success') {
				await invalidateBook();
			} else {
				// Revert optimistic remove on failure by reloading.
				await invalidateBook();
			}
		};
	};

	// -------------------------------------------------------------------------
	// Topics section
	// -------------------------------------------------------------------------
	let topicAddOpen = $state(false);
	let editingTopicId = $state<string | null>(null);
	let topicPendingDeleteId = $state<string | null>(null);
	let topicConfirmDeleteOpen = $state(false);
	let topicDeletePending = $state(false);
	let topicDeleteFormEl = $state<HTMLFormElement | null>(null);
	let topicDeleteIdField = $state<HTMLInputElement | null>(null);

	let topics = $state<BookTopicRow[]>([]);
	$effect(() => {
		void data.bookTopicsPromise.then((t) => {
			topics = t;
		});
	});

	let topicCounts = $state<TopicCount[]>([]);
	let ancientTexts = $state<AncientTextRow[]>([]);

	async function ensureTopicCounts() {
		if (topicCounts.length > 0) return;
		const res = await fetch(LIBRARY_TOPIC_COUNTS_JSON);
		if (!res.ok) return;
		const body = (await res.json()) as { topicCounts?: TopicCount[] };
		topicCounts = body.topicCounts ?? [];
	}

	async function ensureAncientTexts() {
		if (ancientTexts.length > 0) return;
		const res = await fetch(LIBRARY_ANCIENT_TEXTS_JSON);
		if (!res.ok) return;
		const body = (await res.json()) as { ancientTexts?: AncientTextRow[] };
		ancientTexts = body.ancientTexts ?? [];
	}

	function startEditTopic(id: string) {
		editingTopicId = id;
		topicAddOpen = false;
	}
	function cancelEditTopic() {
		editingTopicId = null;
	}
	async function onTopicCreated() {
		topicAddOpen = false;
		await invalidateBook();
	}
	async function onTopicUpdated() {
		editingTopicId = null;
		await invalidateBook();
	}
	function requestDeleteTopic(id: string) {
		topicPendingDeleteId = id;
		topicConfirmDeleteOpen = true;
	}
	function confirmDeleteTopic() {
		if (!topicPendingDeleteId || !topicDeleteFormEl || !topicDeleteIdField) return;
		topicDeleteIdField.value = topicPendingDeleteId;
		topicDeleteFormEl.requestSubmit();
	}
	const deleteTopicEnhance: SubmitFunction = () => {
		topicDeletePending = true;
		const removingId = topicPendingDeleteId;
		if (removingId) topics = topics.filter((t) => t.id !== removingId);
		return async () => {
			topicDeletePending = false;
			topicConfirmDeleteOpen = false;
			topicPendingDeleteId = null;
			await invalidateBook();
		};
	};

	const topicFormMessage = $derived.by(() => {
		const f = form as { kind?: string; message?: string; topicId?: string } | null;
		if (!f) return null;
		if (
			f.kind === 'createBookTopicsBatch' ||
			f.kind === 'updateBookTopic' ||
			f.kind === 'softDeleteBookTopic'
		) {
			return f;
		}
		return null;
	});

	type ScriptureReferenceFormType = Awaited<
		typeof import('$lib/components/scripture-reference-form.svelte')
	>['default'];
	type BookTopicFormType = Awaited<typeof import('$lib/components/book-topic-form.svelte')>['default'];
	type BookBibleCoverageEditorType = Awaited<
		typeof import('$lib/components/book-bible-coverage-editor.svelte')
	>['default'];
	type BookAncientCoverageEditorType = Awaited<
		typeof import('$lib/components/book-ancient-coverage-editor.svelte')
	>['default'];

	let ScriptureReferenceFormCmp = $state<ScriptureReferenceFormType | null>(null);
	let BookTopicFormCmp = $state<BookTopicFormType | null>(null);
	let BookBibleCoverageEditorCmp = $state<BookBibleCoverageEditorType | null>(null);
	let BookAncientCoverageEditorCmp = $state<BookAncientCoverageEditorType | null>(null);

	$effect(() => {
		if (!browser) return;
		if ((addOpen || editingId !== null) && ScriptureReferenceFormCmp === null) {
			void import('$lib/components/scripture-reference-form.svelte').then((m) => {
				ScriptureReferenceFormCmp = m.default;
			});
		}
	});

	$effect(() => {
		if (!browser) return;
		if ((topicAddOpen || editingTopicId !== null) && BookTopicFormCmp === null) {
			void ensureTopicCounts();
			void import('$lib/components/book-topic-form.svelte').then((m) => {
				BookTopicFormCmp = m.default;
			});
		}
	});

	onMount(() => {
		void import('$lib/components/book-bible-coverage-editor.svelte').then((m) => {
			BookBibleCoverageEditorCmp = m.default;
		});
		void ensureAncientTexts();
		void import('$lib/components/book-ancient-coverage-editor.svelte').then((m) => {
			BookAncientCoverageEditorCmp = m.default;
		});
	});
</script>

{#snippet copyDraftButtons()}
	<div class="mt-2 flex flex-wrap gap-2">
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="min-h-10 gap-1.5"
			disabled={copyAuthorsLine(data.book.authors).length === 0}
			onclick={() => void copyToClipboard('authors', copyAuthorsLine(data.book.authors))}
		>
			<Copy class="size-3.5" /> Authors
		</Button>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="min-h-10 gap-1.5"
			disabled={copyTitleLine(data.book).length === 0}
			onclick={() => void copyToClipboard('title', copyTitleLine(data.book))}
		>
			<Copy class="size-3.5" /> Title
		</Button>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="min-h-10 gap-1.5"
			disabled={copyPublisherYearLine(data.book).length === 0}
			onclick={() => void copyToClipboard('publisher and year', copyPublisherYearLine(data.book))}
		>
			<Copy class="size-3.5" /> Publisher + year
		</Button>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="min-h-10 gap-1.5"
			disabled={copyAllFieldsLine(data.book).length === 0}
			onclick={() => void copyToClipboard('all fields', copyAllFieldsLine(data.book))}
		>
			<Copy class="size-3.5" /> All fields
		</Button>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="min-h-10 gap-1.5"
			disabled={!citationFootnote.plain}
			onclick={() => void copyTurabian('footnote')}
		>
			<Copy class="size-3.5" /> Footnote
		</Button>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="min-h-10 gap-1.5"
			disabled={!citationBibliography.plain}
			onclick={() => void copyTurabian('bibliography')}
		>
			<Copy class="size-3.5" /> Bibliography
		</Button>
	</div>
{/snippet}

{#snippet bookEyebrow()}
	<BookOpen class="size-5 shrink-0" />
	{#if data.book.work_type !== 'monograph'}
		<span class="text-xs uppercase tracking-wide text-muted-foreground">
			{WORK_TYPE_LABELS[data.book.work_type].split(' (')[0]}
			{#if essays.length > 0}
				· {essays.length} {essays.length === 1 ? 'article' : 'articles'}
			{/if}
		</span>
	{/if}
	{#if data.book.genre}
		<span class="text-xs uppercase tracking-wide">{data.book.genre}</span>
	{/if}
	{#if data.book.needs_review}
		<span
			class="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200"
		>
			<AlertCircle class="size-3" /> Needs review
		</span>
	{/if}
{/snippet}

{#snippet bookVolSuffix()}
	{#if data.book.volume_number}
		<span class="text-muted-foreground">, vol. {data.book.volume_number}</span>
	{/if}
{/snippet}

{#snippet bookAuthorsMeta()}
	{#if data.book.authors.length > 0}
		<p class="text-sm text-foreground">
			{#each data.book.authors as a, i (a.person_id + a.role)}
				<span>
					{a.person_label}
					{#if a.role !== 'author'}
						<span class="text-muted-foreground">({AUTHOR_ROLE_LABELS[a.role]})</span>
					{/if}
				</span>{#if i < data.book.authors.length - 1},
				{/if}
			{/each}
		</p>
	{/if}
{/snippet}

{#snippet bookDetailActions()}
	<div class="hidden md:flex md:flex-wrap md:gap-2">
		<Button variant="outline" href={`/library/books/${data.book.id}/edit`} hotkey="e">
			<Pencil class="size-4" /> <HotkeyLabel label="Edit" mnemonic="e" />
		</Button>
		<Button variant="outline" href={`/library/books/${data.book.id}/edit?ol=1`} class="gap-2">
			<ScanBarcode class="size-4" /> Refresh from ISBN
		</Button>
		<Button
			type="button"
			variant="outline"
			class="text-destructive hover:text-destructive"
			disabled={deletePending}
			onclick={() => (confirmDeleteBookOpen = true)}
		>
			<Trash2 class="size-4" />
			{deletePending ? 'Deleting…' : 'Delete'}
		</Button>
	</div>
	<div class="flex items-stretch gap-2 md:hidden">
		<Button
			variant="outline"
			href={`/library/books/${data.book.id}/edit`}
			hotkey="e"
			class="min-h-11 flex-1"
		>
			<Pencil class="size-4" /> <HotkeyLabel label="Edit" mnemonic="e" />
		</Button>
		<Button
			type="button"
			variant="outline"
			size="icon"
			class="size-11 shrink-0"
			onclick={() => (bookActionsSheetOpen = true)}
			aria-label="More book actions"
		>
			<MoreHorizontal class="size-5" />
		</Button>
	</div>
{/snippet}

{#snippet readingStatusCard()}
	<div class="rounded-xl border border-border bg-card p-4 text-card-foreground">
		<div class="text-xs uppercase tracking-wide text-muted-foreground">Reading status</div>
		<form
			method="POST"
			action="?/updateReadingStatus"
			use:enhance={statusSubmit}
			class="mt-2"
		>
			<input type="hidden" name="id" value={data.book.id} />
			<select
				name="reading_status"
				value={effectiveStatus}
				onchange={(e) => (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()}
				class={`w-full rounded-md border bg-background px-2 py-1.5 text-sm ${statusToneClasses(effectiveStatus)}`}
				aria-label="Reading status"
			>
				{#each READING_STATUSES as s (s)}
					<option value={s}>{READING_STATUS_LABELS[s]}</option>
				{/each}
			</select>
		</form>
		{#if data.book.rating}
			<p class="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Rating</p>
			<p class="text-lg font-semibold">{data.book.rating} / 5</p>
		{/if}
	</div>
{/snippet}

<svelte:head>
	<title>{data.book.title ?? '(untitled)'} — Library — ppp</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
	<PageHeader
		back={{ href: '/library', label: 'Library' }}
		title={bookTitleLabel}
		titlePlaceholder={bookTitleIsPlaceholder}
		subtitle={data.book.subtitle?.trim() ? data.book.subtitle : undefined}
		titleAfter={bookVolSuffix}
		eyebrow={bookEyebrow}
		meta={data.book.authors.length > 0 ? bookAuthorsMeta : undefined}
		actions={bookDetailActions}
	/>

	<Sheet.Root bind:open={bookActionsSheetOpen}>
		<Sheet.Content side="bottom" class="gap-0 p-0">
			<Sheet.Header class="border-b border-border px-4 pb-3 pt-2 text-left">
				<Sheet.Title class="text-base">Book actions</Sheet.Title>
			</Sheet.Header>
			<div class="flex flex-col gap-2 p-4">
				<Button
					variant="outline"
					class="h-11 w-full justify-center gap-2"
					href={`/library/books/${data.book.id}/edit?ol=1`}
					onclick={() => (bookActionsSheetOpen = false)}
				>
					<ScanBarcode class="size-4" /> Refresh from ISBN
				</Button>
				<Button
					type="button"
					variant="outline"
					class="h-11 w-full text-destructive hover:text-destructive"
					disabled={deletePending}
					onclick={() => {
						bookActionsSheetOpen = false;
						confirmDeleteBookOpen = true;
					}}
				>
					<Trash2 class="size-4" />
					{deletePending ? 'Deleting…' : 'Delete'}
				</Button>
			</div>
		</Sheet.Content>
	</Sheet.Root>

	<details
		class="mt-4 rounded-lg border border-border bg-muted/25 md:hidden"
		aria-label="Copy raw fields for citations"
	>
		<summary
			class="cursor-pointer list-none px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground [&::-webkit-details-marker]:hidden"
		>
			Copy for drafts
		</summary>
		<div class="border-t border-border px-3 pb-3 pt-1">
			{@render copyDraftButtons()}
		</div>
	</details>

	<section
		class="mt-4 hidden rounded-lg border border-border bg-muted/25 px-3 py-3 md:block"
		aria-label="Copy raw fields for citations"
	>
		<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Copy for drafts</p>
		{@render copyDraftButtons()}
	</section>

	{#if data.book.needs_review_note}
		<p class="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
			<strong class="font-semibold">Review note:</strong> {data.book.needs_review_note}
		</p>
	{/if}

	{#if showEssaysSection && essays.length > 0}
		<div
			class="mt-4 rounded-lg border border-border bg-muted/25 px-3 py-2.5 text-sm"
			aria-label="Articles in this volume"
		>
			<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
				Essays &amp; articles
				<span class="font-normal normal-case tracking-normal">({essays.length})</span>
			</p>
			<ul class="mt-1.5 flex flex-col gap-0.5">
				{#each essayPreviewRows as essay (essay.id)}
					<li>
						<a
							href={`#essay-${essay.id}`}
							class="text-foreground underline-offset-2 hover:underline"
						>
							{essayPreviewLabel(essay)}
						</a>
					</li>
				{/each}
			</ul>
			{#if essayPreviewExtra > 0}
				<a
					href="#book-essays-heading"
					class="mt-1 inline-block text-xs text-primary underline-offset-2 hover:underline"
				>
					and {essayPreviewExtra} more
				</a>
			{:else}
				<a
					href="#book-essays-heading"
					class="mt-1 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
				>
					View all
				</a>
			{/if}
		</div>
	{/if}

	<div class="mt-6 md:hidden">
		{@render readingStatusCard()}
	</div>

	<div class="mt-6 grid gap-6 md:grid-cols-3">
		<dl class="md:col-span-2 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
			<dt class="font-medium text-muted-foreground">Publication</dt>
			<dd>{fmtYearChunk() || '—'}</dd>

			{#if data.book.edition}
				<dt class="font-medium text-muted-foreground">Edition</dt>
				<dd>{data.book.edition}</dd>
			{/if}

			{#if data.book.total_volumes}
				<dt class="font-medium text-muted-foreground">Total volumes</dt>
				<dd>{data.book.total_volumes}</dd>
			{/if}

			{#if data.book.original_year || data.book.reprint_year || data.book.reprint_publisher || data.book.reprint_location}
				<dt class="font-medium text-muted-foreground">Reprint</dt>
				<dd>
					{#if data.book.original_year}orig. {data.book.original_year}; {/if}
					{[data.book.reprint_location, data.book.reprint_publisher, data.book.reprint_year]
						.filter((s): s is string | number => s != null && String(s).length > 0)
						.join(', ')}
				</dd>
			{/if}

			{#if data.book.page_count}
				<dt class="font-medium text-muted-foreground">Pages</dt>
				<dd>{data.book.page_count}</dd>
			{/if}

			{#if data.book.series_name}
				<dt class="font-medium text-muted-foreground">Series</dt>
				<dd>
					{data.book.series_abbreviation
						? `${data.book.series_abbreviation} — ${data.book.series_name}`
						: data.book.series_name}
				</dd>
			{/if}

			<dt class="font-medium text-muted-foreground">Language</dt>
			<dd>{LANGUAGE_LABELS[data.book.language]}</dd>

			{#if data.book.isbn}
				<dt class="font-medium text-muted-foreground">ISBN</dt>
				<dd class="font-mono text-xs">{data.book.isbn}</dd>
			{/if}
			{#if data.book.barcode}
				<dt class="font-medium text-muted-foreground">Barcode</dt>
				<dd class="font-mono text-xs">{data.book.barcode}</dd>
			{/if}
			{#if data.book.shelving_location}
				<dt class="font-medium text-muted-foreground">Shelf</dt>
				<dd>{data.book.shelving_location}</dd>
			{/if}
			{#if data.book.borrowed_to}
				<dt class="font-medium text-muted-foreground">On loan to</dt>
				<dd>{data.book.borrowed_to}</dd>
			{/if}
		</dl>

		<aside class="flex flex-col gap-3">
			<div class="hidden md:block">
				{@render readingStatusCard()}
			</div>

			{#if data.book.personal_notes}
				<div class="rounded-xl border border-border bg-card p-4 text-card-foreground">
					<div class="text-xs uppercase tracking-wide text-muted-foreground">Personal notes</div>
					<p class="mt-2 whitespace-pre-wrap text-sm">{data.book.personal_notes}</p>
				</div>
			{/if}
		</aside>
	</div>

	{#if showEssaysSection}
		<BookEssaysEditor
			{essays}
			volumeCitation={citationInput}
			people={data.people}
			parentBookId={data.book.id}
			isOwner={data.isOwner}
			formMessage={essayFormMessage}
			onSaved={onEssaySaved}
			onCopied={flashCopyToast}
		/>
	{/if}

	<!-- ------------------------------------------------------------------- -->
	<!-- Scripture references                                                  -->
	<!-- ------------------------------------------------------------------- -->
	<details
		class="mt-10 rounded-lg border border-border bg-card text-card-foreground shadow-sm"
		bind:open={refsOpen}
	>
		<summary
			class="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden"
		>
			<span
				id="scripture-refs-heading"
				class="text-lg font-semibold tracking-tight text-foreground"
			>
				Scripture references
				{#if refs.length > 0}
					<span class="ml-1 text-sm font-normal text-muted-foreground">({refs.length})</span>
				{/if}
			</span>
			<ChevronDown
				class={cn(
					'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
					refsOpen && 'rotate-180'
				)}
				aria-hidden="true"
			/>
		</summary>
		<div class="border-t border-border px-4 pb-4 pt-3">
			<div class="mb-3 flex justify-end">
				{#if !addOpen}
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => {
							addOpen = true;
							editingId = null;
						}}
					>
						<Plus class="size-4" /> Add references
					</Button>
				{/if}
			</div>

			{#if scriptureRefsLoading}
				<p class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
					Loading scripture references…
				</p>
			{:else if refs.length === 0 && !addOpen}
				<p
					class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
				>
					No scripture references yet. Click <strong class="font-semibold text-foreground">Add references</strong>
					to log a passage you found discussed in this book.
				</p>
			{/if}

			{#if !scriptureRefsLoading && groupedRefs.length > 0}
				<div class="space-y-5">
					{#each groupedRefs as group (group.bible_book)}
						<div>
							<h3
								id={`scripture-group-${group.bible_book}`}
								class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
							>
								{group.bible_book}
							</h3>
							<ul
								class="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-card text-sm"
							>
								{#each group.rows as ref (ref.id)}
									<li
										id={`ref-${ref.id}`}
										class={cn(
											'group/row flex min-h-12 items-center gap-2 px-3 py-1.5 transition-colors md:min-h-9',
											highlightedRefId === ref.id &&
												'bg-amber-500/10 ring-2 ring-amber-500/40 ring-inset'
										)}
									>
										{#if editingId === ref.id}
											<div class="w-full py-2">
												{#if ScriptureReferenceFormCmp}
													<ScriptureReferenceFormCmp
														books={sourcePickerBooks}
														bibleBookNames={data.bibleBookNames}
														lockedBookId={data.book.id}
														userId={data.userId}
														existingRef={ref}
														{formMessage}
														onSaved={onUpdated}
														onCancel={cancelEdit}
													/>
												{:else}
													<div
														class="h-16 w-full animate-pulse rounded-lg bg-muted/40"
														aria-hidden="true"
													></div>
												{/if}
											</div>
										{:else}
											<span class="shrink-0 font-medium tabular-nums text-foreground">
												{fmtRefRangeOnly(ref)}
											</span>
											{#if fmtPages(ref)}
												<span class="shrink-0 text-muted-foreground">— {fmtPages(ref)}</span>
											{/if}
											{#if ref.needs_review}
												<span
													class="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200"
												>
													<AlertCircle class="size-3" /> Review
												</span>
											{/if}
											{#if ref.review_note}
												<span
													class="min-w-0 flex-1 truncate text-xs italic text-muted-foreground"
													title={ref.review_note}
												>
													{ref.review_note}
												</span>
											{/if}
											<div
												class="ml-auto flex shrink-0 gap-0.5 opacity-70 group-hover/row:opacity-100"
											>
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													class="size-9 md:size-7"
													onclick={() => startEdit(ref.id)}
													aria-label={`Edit ${fmtRef(ref)}`}
												>
													<Pencil class="size-3.5" />
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													class="size-9 text-destructive hover:text-destructive md:size-7"
													onclick={() => requestDelete(ref.id)}
													aria-label={`Delete ${fmtRef(ref)}`}
												>
													<Trash2 class="size-3.5" />
												</Button>
											</div>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			{/if}

			{#if uniqueImageRefs.length > 0}
				<details
					class="mt-4 rounded-lg border border-border/60 bg-muted/20"
					bind:open={recordedImagesOpen}
				>
					<summary
						class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden"
					>
						<Image class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						See recorded images ({uniqueImageRefs.length})
						<ChevronDown
							class={cn(
								'ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200',
								recordedImagesOpen && 'rotate-180'
							)}
							aria-hidden="true"
						/>
					</summary>
					<div class="flex flex-wrap gap-2 border-t border-border/40 p-3">
						{#each uniqueImageRefs as img (img.source_image_url)}
							<a
								href={img.source_image_signed_url}
								target="_blank"
								rel="noopener noreferrer"
								class="group/img relative"
								title={`${img.refCount} ref${img.refCount === 1 ? '' : 's'}`}
							>
								<img
									src={img.source_image_signed_url}
									alt=""
									loading="lazy"
									class="size-28 rounded-md border border-border object-cover transition-transform group-hover/img:scale-105"
								/>
								{#if img.refCount > 1}
									<span
										class="absolute right-1 bottom-1 rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground"
									>
										{img.refCount}
									</span>
								{/if}
							</a>
						{/each}
					</div>
				</details>
			{/if}

			{#if addOpen}
				<div id="scripture-add-form" bind:this={scriptureAddFormEl} class="mt-4 scroll-mt-6">
					{#if ScriptureReferenceFormCmp}
						<ScriptureReferenceFormCmp
							books={sourcePickerBooks}
							bibleBookNames={data.bibleBookNames}
							lockedBookId={data.book.id}
							userId={data.userId}
							{formMessage}
							onSavedBatch={onCreatedBatch}
							onBatchDirtyChange={(d) => (batchFormDirty = d)}
							onCancel={() => (addOpen = false)}
						/>
					{:else}
						<div class="h-16 w-full animate-pulse rounded-lg bg-muted/40" aria-hidden="true"></div>
					{/if}
					<div class="mt-2 flex justify-end">
						<Button type="button" variant="ghost" size="sm" onclick={() => (addOpen = false)}>
							Close add form
						</Button>
					</div>
				</div>
			{/if}
		</div>
	</details>

	<!-- ------------------------------------------------------------------- -->
	<!-- Bible coverage                                                         -->
	<!-- ------------------------------------------------------------------- -->
	<section class="mt-10" aria-labelledby="bible-coverage-heading">
		<div class="flex items-center justify-between gap-3">
			<h2
				id="bible-coverage-heading"
				class="text-lg font-semibold tracking-tight text-foreground"
			>
				Bible coverage
			</h2>
		</div>
		<p class="mt-1 text-xs text-muted-foreground">
			Which biblical books does this work cover? Tagged books surface on passage search.
		</p>
		<div class="mt-3">
			{#await data.bibleCoveragePromise}
				<div
					class="h-24 animate-pulse rounded-lg border border-border bg-muted/20"
					aria-hidden="true"
				></div>
			{:then bibleCoverage}
				{#if bibleCoverage.length > 0}
					<p class="mb-2 text-sm text-muted-foreground">
						{bibleCoverage.length} book{bibleCoverage.length === 1 ? '' : 's'} tagged
					</p>
				{/if}
				{#if BookBibleCoverageEditorCmp}
					<BookBibleCoverageEditorCmp
						bookId={data.book.id}
						bibleBookNames={data.bibleBookNames}
						covered={bibleCoverage}
					/>
				{:else}
					<div
					class="h-24 animate-pulse rounded-lg border border-border bg-muted/20"
					aria-hidden="true"
					></div>
				{/if}
			{/await}
		</div>
	</section>

	<!-- ------------------------------------------------------------------- -->
	<!-- Ancient-text coverage                                                 -->
	<!-- ------------------------------------------------------------------- -->
	<section class="mt-10" aria-labelledby="ancient-coverage-heading">
		<div class="flex items-center justify-between gap-3">
			<h2
				id="ancient-coverage-heading"
				class="text-lg font-semibold tracking-tight text-foreground"
			>
				Ancient-text coverage
			</h2>
		</div>
		<div class="mt-3">
			{#await data.ancientCoveragePromise}
				<div
					class="h-24 animate-pulse rounded-lg border border-border bg-muted/20"
					aria-hidden="true"
				></div>
			{:then ancientCoverage}
				{#if ancientCoverage.length > 0}
					<p class="mb-2 text-sm text-muted-foreground">
						{ancientCoverage.length} text{ancientCoverage.length === 1 ? '' : 's'} tagged
					</p>
				{/if}
				{#if BookAncientCoverageEditorCmp}
					<BookAncientCoverageEditorCmp
						bookId={data.book.id}
						{ancientTexts}
						coverage={ancientCoverage}
						isOwner={data.isOwner}
					/>
				{:else}
					<div
						class="h-24 animate-pulse rounded-lg border border-border bg-muted/20"
						aria-hidden="true"
					></div>
				{/if}
			{/await}
		</div>
	</section>

	<!-- ------------------------------------------------------------------- -->
	<!-- Topics                                                                -->
	<!-- ------------------------------------------------------------------- -->
	<section class="mt-10" aria-labelledby="book-topics-heading">
		<div class="flex items-center justify-between gap-3">
			<h2 id="book-topics-heading" class="text-lg font-semibold tracking-tight text-foreground">
				Topics
				{#if topics.length > 0}
					<span class="ml-1 text-sm font-normal text-muted-foreground">({topics.length})</span>
				{/if}
			</h2>
			{#if !topicAddOpen}
				<Button
					type="button"
					variant="outline"
					size="sm"
					onclick={() => {
						topicAddOpen = true;
						editingTopicId = null;
					}}
				>
					<Plus class="size-4" /> Add topics
				</Button>
			{/if}
		</div>

		{#if topics.length === 0 && !topicAddOpen}
			<p class="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
				No topics yet. Click <strong class="font-semibold text-foreground">Add</strong> to tag what this book says about a particular topic.
			</p>
		{/if}

		{#if topics.length > 0}
			<ul class="mt-4 flex flex-col gap-3">
				{#each topics as topic (topic.id)}
					<li>
						{#if editingTopicId === topic.id}
							{#if BookTopicFormCmp}
								<BookTopicFormCmp
									books={sourcePickerBooks}
									{topicCounts}
									lockedBookId={data.book.id}
									userId={data.userId}
									existingTopic={topic}
									formMessage={topicFormMessage}
									onSaved={onTopicUpdated}
									onCancel={cancelEditTopic}
								/>
							{:else}
								<div class="h-16 w-full animate-pulse rounded-lg bg-muted/40" aria-hidden="true"></div>
							{/if}
						{:else}
							<article class="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground">
								<div class="flex min-w-0 flex-1 items-start gap-3">
									{#if topic.source_image_signed_url}
										<a
											href={topic.source_image_signed_url}
											target="_blank"
											rel="noopener noreferrer"
											class="shrink-0"
											aria-label="Open page image in a new tab"
										>
											<img
												src={topic.source_image_signed_url}
												alt="Source page"
												class="size-16 rounded-md border border-border object-cover"
												loading="lazy"
											/>
										</a>
									{/if}
									<div class="min-w-0 flex-1">
										<div class="flex flex-wrap items-center gap-2">
											<span class="font-medium text-foreground">{topic.topic}</span>
											<span class="text-sm text-muted-foreground">
												{#if topic.page_end && topic.page_end !== topic.page_start}
													pp. {topic.page_start}&ndash;{topic.page_end}
												{:else}
													p. {topic.page_start}
												{/if}
											</span>
											{#if topic.needs_review}
												<span
													class="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200"
												>
													<AlertCircle class="size-3" /> Needs review
												</span>
											{/if}
										</div>
										{#if topic.review_note}
											<p class="mt-1 text-xs text-muted-foreground">{topic.review_note}</p>
										{/if}
									</div>
								</div>
								<div class="flex shrink-0 gap-1">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onclick={() => startEditTopic(topic.id)}
										aria-label={`Edit topic ${topic.topic}`}
									>
										<Pencil class="size-4" /> Edit
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onclick={() => requestDeleteTopic(topic.id)}
										aria-label={`Delete topic ${topic.topic}`}
										class="text-destructive hover:text-destructive"
									>
										<Trash2 class="size-4" />
									</Button>
								</div>
							</article>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		{#if topicAddOpen}
			<div class="mt-4">
				{#if BookTopicFormCmp}
					<BookTopicFormCmp
						books={sourcePickerBooks}
						{topicCounts}
						lockedBookId={data.book.id}
						userId={data.userId}
						formMessage={topicFormMessage}
						onSavedBatch={onTopicCreated}
						onCancel={() => (topicAddOpen = false)}
					/>
				{:else}
					<div class="h-16 w-full animate-pulse rounded-lg bg-muted/40" aria-hidden="true"></div>
				{/if}
			</div>
		{/if}
	</section>
</div>

<!-- Hidden delete form: confirm dialog drives requestSubmit() against this. -->
<form
	method="POST"
	action="?/softDeleteBook"
	use:enhance={deleteEnhance}
	bind:this={bookDeleteFormEl}
	class="hidden"
>
	<input type="hidden" name="id" value={data.book.id} />
</form>

<ConfirmDialog
	bind:open={confirmDeleteBookOpen}
	title="Delete this book?"
	description="This soft-deletes the book. You can restore it from the audit log if needed."
	confirmLabel="Delete"
	cancelLabel="Keep"
	destructive
	pending={deletePending}
	onConfirm={confirmDeleteBook}
/>

<ConfirmDialog
	bind:open={batchDiscardOpen}
	title="Discard unsaved scripture references?"
	description="You have unsaved scripture references in the batch form. Leaving will lose them."
	confirmLabel="Discard"
	cancelLabel="Keep editing"
	destructive
	onConfirm={discardBatchAndGo}
/>

<form
	method="POST"
	action="?/softDeleteBookTopic"
	use:enhance={deleteTopicEnhance}
	bind:this={topicDeleteFormEl}
	class="hidden"
>
	<input type="hidden" name="id" value="" bind:this={topicDeleteIdField} />
</form>

<ConfirmDialog
	bind:open={topicConfirmDeleteOpen}
	title="Delete topic?"
	description="This soft-deletes the row. You can restore it from the audit log if needed."
	confirmLabel="Delete"
	cancelLabel="Keep"
	destructive
	pending={topicDeletePending}
	onConfirm={confirmDeleteTopic}
	onCancel={() => {
		topicPendingDeleteId = null;
	}}
/>

<!-- Hidden delete form: confirm dialog drives requestSubmit() against this. -->
<form
	method="POST"
	action="?/softDeleteScriptureRef"
	use:enhance={deleteRefEnhance}
	bind:this={deleteFormEl}
	class="hidden"
>
	<input type="hidden" name="id" value="" bind:this={deleteIdField} />
</form>

<ConfirmDialog
	bind:open={confirmDeleteOpen}
	title="Delete scripture reference?"
	description="This soft-deletes the row. You can restore it from the audit log if needed."
	confirmLabel="Delete"
	cancelLabel="Keep"
	destructive
	pending={deleteRefPending}
	onConfirm={confirmDelete}
	onCancel={() => {
		pendingDeleteId = null;
	}}
/>

{#if copyToast}
	<div
		class="fixed inset-x-0 bottom-tabbar z-50 mx-auto w-full max-w-sm rounded-lg border border-border bg-card px-4 py-3 text-center text-sm text-card-foreground shadow-lg md:bottom-6"
		role="status"
		aria-live="polite"
	>
		{copyToast}
	</div>
{/if}

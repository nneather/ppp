<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { cn } from '$lib/utils.js';
	import Plus from '@lucide/svelte/icons/plus';
	import Copy from '@lucide/svelte/icons/copy';
	import Mail from '@lucide/svelte/icons/mail';
	import X from '@lucide/svelte/icons/x';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import FileText from '@lucide/svelte/icons/file-text';
	import SourcePicker from '$lib/components/source-picker.svelte';
	import {
		formatScriptureRefPageSummary,
		formatScriptureRefRangeDisplay
	} from '$lib/library/scripture-ref-format';
	import type { PolymorphicParent } from '$lib/library/polymorphic';
	import type { BookListRow, ScriptureRefRow } from '$lib/types/library';
	import { createClient } from '$lib/supabase/client';
	import {
		SCRIPTURE_IMAGES_BUCKET,
		scriptureImagePath
	} from '$lib/library/storage';
	import type { OcrScriptureCandidate } from '$lib/library/ocr-scripture-refs';
	import {
		formatOcrPipelineError,
		getPdfPageCount,
		invokeOcrScriptureRefs
	} from '$lib/library/ocr-invoke-client';

	/**
	 * <ScriptureReferenceForm>
	 *
	 * Two modes share one component (Session 2 follow-up):
	 *
	 * - **Edit mode** (`existingRef` is set): renders one row pre-filled from the
	 *   existing ref. Add/Duplicate/Remove controls are hidden. Posts to
	 *   `?/updateScriptureRef`. Cancel button calls `onCancel`.
	 *
	 * - **Batch create mode** (default): renders N draft rows, starting with one.
	 *   Optional **multi-image** OCR (up to 10 photos): queue photos from the gallery and/or
	 *   repeated **camera** captures, then **Run OCR** — parallel downscale → upload →
	 *   `ocr_scripture_refs` Edge invoke per file (browser-direct; avoids Vercel timeout on PDFs);
	 *   results merge in file `lastModified` order
	 *   with continuation `bible_book` carry from the prior page. Each row carries
	 *   its own `source_image_url` (storage path) in `rows_json`. Posts to
	 *   `?/createScriptureRefsBatch`. Empty draft rows (no bible_book AND no page_start)
	 *   are silently skipped server-side.
	 *
	 * Image upload: file input → client-side downscale (~2048px JPEG) →
	 * supabase.storage.upload to `library-scripture-images/${userId}/${bookId}/…`.
	 * Object path stored per row (batch) or top-level (edit); loaders sign on read.
	 *
	 * Page numbers are TEXT — schema handles `IV.317`, `xiv`, `106n21`. We intentionally
	 * do NOT coerce.
	 */

	type FormMessage = { message?: string } | null | undefined;

	let {
		books,
		bibleBookNames,
		lockedBookId = null,
		userId,
		actionPath = '',
		existingRef = null,
		formMessage = null,
		onSaved,
		onSavedBatch,
		onCancel
	}: {
		books: BookListRow[];
		bibleBookNames: string[];
		lockedBookId?: string | null;
		userId: string;
		actionPath?: string;
		existingRef?: ScriptureRefRow | null;
		formMessage?: FormMessage;
		/** Edit-mode callback (single ref id). */
		onSaved?: (refId: string) => void;
		/** Batch-mode callback (list of created ref ids). */
		onSavedBatch?: (refIds: string[]) => void;
		onCancel?: () => void;
	} = $props();

	const isEdit = $derived(!!existingRef);

	type PositionInPage = 'first' | 'middle' | 'last' | 'only';

	type DraftRow = {
		key: string;
		bible_book: string;
		chapter_start: string;
		verse_start: string;
		chapter_end: string;
		verse_end: string;
		page_start: string;
		page_end: string;
		needs_review: boolean;
		review_note: string;
		/** Set when row came from OCR extract; optional on manual rows. */
		confidence_score: number | null;
		/** Storage object path for this row's source image (batch OCR). */
		source_image_url: string;
		/** True when OCR marked a run-on from the prior printed page; cleared after book carry or user pick. */
		continuation_from_previous_page: boolean;
		/** Collapsed compact strip vs full field editor (batch OCR review). */
		expanded: boolean;
		/** Include this row in the batch save payload. */
		included: boolean;
		/** 1-based index of the source page image in this OCR batch. */
		pageJobOrder: number;
		pageJobTotal: number;
		positionInPage: PositionInPage;
		/** Links row to `PageJob.id` for page-boundary thumbnail. */
		pageJobId: string;
		/** PDF page label within one uploaded file (1-based). */
		pdfPageOrder: number;
		pdfPageTotal: number;
		/** How to render the page-boundary separator. */
		pageLabelKind: 'file' | 'pdf-page';
	};

	type PageJob = {
		id: string;
		order: number;
		sourcePath: string;
		previewUrl: string | null;
		status: 'uploading' | 'extracting' | 'done' | 'error';
		error?: string;
		candidates?: OcrScriptureCandidate[];
		isPdf?: boolean;
		/** e.g. "Page 2/5" while per-page PDF OCR runs */
		extractLabel?: string;
	};

	type QueuedOcrFile = {
		id: string;
		file: File;
		previewUrl: string;
		isPdf: boolean;
	};

	const MAX_BATCH_IMAGES = 10;
	const CONFIDENCE_REVIEW_THRESHOLD = 0.8;

	function isRowSaveable(r: DraftRow): boolean {
		return r.bible_book.trim().length > 0 && r.page_start.trim().length > 0;
	}

	function formatRowStripLabel(row: DraftRow): string {
		const range = formatScriptureRefRangeDisplay({
			bible_book: row.bible_book,
			chapter_start: row.chapter_start.trim() ? Number(row.chapter_start) : null,
			verse_start: row.verse_start.trim() ? Number(row.verse_start) : null,
			chapter_end: row.chapter_end.trim() ? Number(row.chapter_end) : null,
			verse_end: row.verse_end.trim() ? Number(row.verse_end) : null
		});
		const page = formatScriptureRefPageSummary(row.page_start, row.page_end);
		if (!range && !page) return 'Incomplete reference';
		if (range && page) return `${range} · ${page}`;
		return range || page || '—';
	}

	function confidenceStripClass(conf: number | null): string {
		if (conf == null) return 'text-muted-foreground';
		if (conf >= 0.95) return 'text-muted-foreground/70';
		if (conf >= CONFIDENCE_REVIEW_THRESHOLD) return 'text-muted-foreground';
		return 'font-medium text-amber-700 dark:text-amber-300';
	}

	function rowShowsPageEdge(row: DraftRow): boolean {
		return (
			row.positionInPage === 'first' ||
			row.positionInPage === 'last' ||
			row.positionInPage === 'only'
		);
	}

	function numStr(n: number | null | undefined): string {
		if (n == null || !Number.isFinite(Number(n))) return '';
		return String(n);
	}

	function mapCandidateToRow(c: OcrScriptureCandidate): DraftRow {
		const conf =
			typeof c.confidence_score === 'number' && Number.isFinite(c.confidence_score)
				? c.confidence_score
				: 1;
		const cont = c.continuation_from_previous_page === true;
		const bookRaw = (c.bible_book ?? '').trim();
		const needsContinuationPick = cont && bookRaw.length === 0;
		const needs = needsContinuationPick || conf < CONFIDENCE_REVIEW_THRESHOLD;
		const pageStartRaw =
			c.page_start != null && String(c.page_start).trim() !== ''
				? String(c.page_start).trim()
				: '';
		const saveable = bookRaw.length > 0 && pageStartRaw.length > 0;
		return {
			key: freshKey(),
			bible_book: bookRaw,
			chapter_start: numStr(c.chapter_start ?? undefined),
			verse_start: numStr(c.verse_start ?? undefined),
			chapter_end: numStr(c.chapter_end ?? undefined),
			verse_end: numStr(c.verse_end ?? undefined),
			page_start: pageStartRaw,
			page_end: c.page_end != null ? String(c.page_end) : '',
			needs_review: needs,
			review_note: '',
			confidence_score: conf,
			source_image_url: '',
			continuation_from_previous_page: cont,
			expanded: needs,
			included: saveable,
			pageJobOrder: 0,
			pageJobTotal: 0,
			positionInPage: 'only',
			pageJobId: '',
			pdfPageOrder: 0,
			pdfPageTotal: 0,
			pageLabelKind: 'file'
		};
	}

	function sourcePageIndexForCandidate(c: OcrScriptureCandidate): number {
		const n = c.source_page_index;
		if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
		return Math.max(0, Math.trunc(n));
	}

	function freshKey(): string {
		return typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	}

	function blankRow(): DraftRow {
		return {
			key: freshKey(),
			bible_book: '',
			chapter_start: '',
			verse_start: '',
			chapter_end: '',
			verse_end: '',
			page_start: '',
			page_end: '',
			needs_review: false,
			review_note: '',
			confidence_score: null,
			source_image_url: '',
			continuation_from_previous_page: false,
			expanded: true,
			included: false,
			pageJobOrder: 0,
			pageJobTotal: 0,
			positionInPage: 'only',
			pageJobId: '',
			pdfPageOrder: 0,
			pdfPageTotal: 0,
			pageLabelKind: 'file'
		};
	}

	function rowFromExisting(r: ScriptureRefRow): DraftRow {
		return {
			key: r.id,
			bible_book: r.bible_book,
			chapter_start: r.chapter_start?.toString() ?? '',
			verse_start: r.verse_start?.toString() ?? '',
			chapter_end: r.chapter_end?.toString() ?? '',
			verse_end: r.verse_end?.toString() ?? '',
			page_start: r.page_start ?? '',
			page_end: r.page_end ?? '',
			needs_review: r.needs_review,
			review_note: r.review_note ?? '',
			confidence_score: r.confidence_score,
			source_image_url: r.source_image_url ?? '',
			continuation_from_previous_page: false,
			expanded: r.needs_review,
			included: true,
			pageJobOrder: 0,
			pageJobTotal: 0,
			positionInPage: 'only',
			pageJobId: '',
			pdfPageOrder: 0,
			pdfPageTotal: 0,
			pageLabelKind: 'file'
		};
	}

	let parent = $state<PolymorphicParent | null>(null);
	let rows = $state<DraftRow[]>([blankRow()]);
	let source_image_url = $state(''); // bucket object path (edit mode + legacy hidden fallback)
	let source_image_mime = $state('image/jpeg');
	let preview_url = $state<string | null>(null);
	let pending = $state(false);
	let uploading = $state(false);
	let uploadError = $state<string | null>(null);
	let extractMessage = $state<string | null>(null);
	let extractInfo = $state<string | null>(null);
	let batchUploadNotice = $state<string | null>(null);

	let pages = $state<PageJob[]>([]);
	/** Photos queued before "Run OCR" (gallery multi-pick + repeated camera shots). */
	let ocrQueue = $state<QueuedOcrFile[]>([]);
	let reviewNoteOpen = $state<Record<string, boolean>>({});
	let pulseRowKeys = $state<Record<string, true>>({});

	const ocrPipelineBusy = $derived(
		pages.some((p) => p.status === 'uploading' || p.status === 'extracting')
	);

	/** Mobile-only: bottom sheet bible picker (`max-sm:` trigger replaces Select). */
	let biblePickerOpen = $state(false);
	let biblePickerRowKey = $state<string | null>(null);
	let bibleFilter = $state('');

	const filteredBibleNames = $derived(
		bibleFilter.trim().length === 0
			? bibleBookNames
			: bibleBookNames.filter((n) => n.toLowerCase().includes(bibleFilter.trim().toLowerCase()))
	);

	const biblePickerSuggestions = $derived.by(() => {
		const key = biblePickerRowKey;
		if (!key) return [] as string[];
		const row = rows.find((r) => r.key === key);
		const idx = rows.findIndex((r) => r.key === key);
		const seen = new Set<string>();
		const out: string[] = [];
		const add = (name: string) => {
			const t = name.trim();
			if (!t || seen.has(t)) return;
			seen.add(t);
			out.push(t);
		};
		if (row?.bible_book.trim()) add(row.bible_book);
		for (const r of rows) {
			if (r.key !== key) add(r.bible_book);
		}
		if (idx > 0) add(rows[idx - 1]?.bible_book ?? '');
		return out.slice(0, 8);
	});

	const batchReviewStats = $derived.by(() => {
		if (isEdit) return null;
		const total = rows.length;
		const flagged = rows.filter((r) => r.needs_review).length;
		const confident = rows.filter((r) => !r.needs_review && isRowSaveable(r)).length;
		const includedCount = rows.filter((r) => r.included && isRowSaveable(r)).length;
		return { total, flagged, confident, includedCount };
	});

	function openBiblePicker(rowKey: string) {
		biblePickerRowKey = rowKey;
		bibleFilter = '';
		biblePickerOpen = true;
	}

	function closeBiblePicker() {
		biblePickerOpen = false;
	}

	$effect(() => {
		if (!biblePickerOpen) biblePickerRowKey = null;
	});

	function pickBibleForRow(name: string) {
		const key = biblePickerRowKey;
		if (!key) return;
		rows = rows.map((r) =>
			r.key === key ? { ...r, bible_book: name, continuation_from_previous_page: false } : r
		);
		closeBiblePicker();
	}

	function setRowBibleBook(rowKey: string, value: string) {
		rows = rows.map((r) =>
			r.key === rowKey
				? {
						...r,
						bible_book: value,
						continuation_from_previous_page:
							value.trim().length > 0 ? false : r.continuation_from_previous_page
					}
				: r
		);
	}

	// Seed when mode/parent changes — keyed so a re-mount or existingRef swap
	// re-applies, but typing inside a row never re-fires it.
	let seededFor = $state<string | null>(null);
	$effect(() => {
		const key = existingRef?.id ?? `__create__:${lockedBookId ?? ''}`;
		if (seededFor === key) return;
		seededFor = key;

		if (existingRef) {
			parent = existingRef.book_id
				? { kind: 'book', book_id: existingRef.book_id }
				: existingRef.essay_id
					? { kind: 'essay', essay_id: existingRef.essay_id }
					: null;
			rows = [rowFromExisting(existingRef)];
			source_image_url = existingRef.source_image_url ?? '';
			preview_url = existingRef.source_image_signed_url ?? null;
		} else {
			parent = lockedBookId ? { kind: 'book', book_id: lockedBookId } : null;
			rows = [blankRow()];
			source_image_url = '';
			preview_url = null;
		}
		uploadError = null;
		extractMessage = null;
		extractInfo = null;
		batchUploadNotice = null;
		revokeAllPagePreviewBlobs(pages);
		pages = [];
		clearOcrQueue();
		reviewNoteOpen = {};
	});

	const bibleBookItems = $derived([
		{ value: '', label: '— Pick a book —' },
		...bibleBookNames.map((n) => ({ value: n, label: n }))
	]);

	const sourceKind = $derived<'book' | 'essay'>(parent?.kind ?? 'book');
	const sourceBookId = $derived(parent?.kind === 'book' ? parent.book_id : '');
	const sourceEssayId = $derived(parent?.kind === 'essay' ? parent.essay_id : '');

	const action = $derived(
		isEdit
			? `${actionPath}?/updateScriptureRef`
			: `${actionPath}?/createScriptureRefsBatch`
	);

	// Save bar: enabled when at least one included row is saveable.
	const hasAnyValidRow = $derived(rows.some((r) => r.included && isRowSaveable(r)));

	function toggleRowExpanded(key: string) {
		rows = rows.map((r) => (r.key === key ? { ...r, expanded: !r.expanded } : r));
	}

	function setRowIncluded(key: string, included: boolean) {
		rows = rows.map((r) => (r.key === key ? { ...r, included } : r));
	}

	function expandAllRows() {
		rows = rows.map((r) => ({ ...r, expanded: true }));
	}

	function confirmConfidentRows() {
		const keys: string[] = [];
		rows = rows.map((r) => {
			if (!r.needs_review && isRowSaveable(r)) {
				keys.push(r.key);
				return { ...r, included: true, expanded: false };
			}
			return r;
		});
		if (keys.length > 0) {
			const next: Record<string, true> = {};
			for (const k of keys) next[k] = true;
			pulseRowKeys = next;
			setTimeout(() => {
				pulseRowKeys = {};
			}, 600);
		}
	}

	function pageJobPreviewUrl(jobId: string): string | null {
		if (!jobId) return null;
		return pages.find((p) => p.id === jobId)?.previewUrl ?? null;
	}

	function handleStripKeydown(e: KeyboardEvent, key: string) {
		if (e.key === 'Enter') {
			e.preventDefault();
			toggleRowExpanded(key);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			rows = rows.map((r) => (r.key === key ? { ...r, expanded: false } : r));
		}
	}

	function addRow() {
		rows = [...rows, blankRow()];
	}

	function duplicateRow(idx: number) {
		const src = rows[idx];
		const copy: DraftRow = { ...src, key: freshKey(), expanded: true };
		rows = [...rows.slice(0, idx + 1), copy, ...rows.slice(idx + 1)];
	}

	function removeRow(idx: number) {
		if (rows.length === 1) {
			// keep at least one row visible — clear it instead of removing
			rows = [blankRow()];
			return;
		}
		rows = rows.filter((_, i) => i !== idx);
	}

	function toggleReviewNote(key: string) {
		reviewNoteOpen = { ...reviewNoteOpen, [key]: !reviewNoteOpen[key] };
	}

	// ---------------------------------------------------------------------------
	// Image upload + multi-page OCR (batch create)
	// ---------------------------------------------------------------------------

	const MAX_LONG_EDGE = 2048;
	const TARGET_QUALITY = 0.85;

	function revokeAllPagePreviewBlobs(jobs: PageJob[]) {
		for (const j of jobs) {
			if (j.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(j.previewUrl);
		}
	}

	function isPdfFile(file: File): boolean {
		return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
	}

	function clearOcrQueue() {
		for (const q of ocrQueue) {
			if (q.previewUrl.startsWith('blob:')) URL.revokeObjectURL(q.previewUrl);
		}
		ocrQueue = [];
	}

	function appendToOcrQueue(files: File[]) {
		batchUploadNotice = null;
		const sorted = [...files].sort((a, b) => {
			const t = a.lastModified - b.lastModified;
			if (t !== 0) return t;
			return a.name.localeCompare(b.name);
		});
		const startLen = ocrQueue.length;
		const next = [...ocrQueue];
		for (const f of sorted) {
			if (next.length >= MAX_BATCH_IMAGES) break;
			const isPdf = isPdfFile(f);
			next.push({
				id:
					typeof crypto !== 'undefined' && 'randomUUID' in crypto
						? crypto.randomUUID()
						: `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
				file: f,
				previewUrl: isPdf ? '' : URL.createObjectURL(f),
				isPdf
			});
		}
		const added = next.length - startLen;
		if (added < sorted.length) {
			batchUploadNotice = `${sorted.length - added} file(s) did not fit (queue max ${MAX_BATCH_IMAGES}).`;
		}
		ocrQueue = next;
	}

	function removeQueued(id: string) {
		ocrQueue = ocrQueue.filter((q) => {
			if (q.id === id && q.previewUrl.startsWith('blob:')) URL.revokeObjectURL(q.previewUrl);
			return q.id !== id;
		});
	}

	async function copyJobError(job: PageJob) {
		if (!browser || !job.error) return;
		try {
			await navigator.clipboard.writeText(job.error);
			extractMessage = null;
			extractInfo = 'Error text copied to clipboard.';
			window.setTimeout(() => {
				if (extractInfo === 'Error text copied to clipboard.') extractInfo = null;
			}, 2500);
		} catch {
			extractInfo = null;
			extractMessage = 'Could not copy — select the error text manually.';
		}
	}

	function ocrErrorMailtoHref(job: PageJob): string {
		const bookIdForPath = lockedBookId ?? sourceBookId;
		const report = [
			`ppp / library / scripture OCR`,
			`time (local): ${new Date().toISOString()}`,
			`book_id: ${bookIdForPath ?? '(none)'}`,
			`job_id: ${job.id}`,
			`storage_path: ${job.sourcePath || '(none)'}`,
			'',
			'--- error ---',
			job.error ?? '(no message)'
		].join('\n');
		const cap = 1800;
		const body = report.length > cap ? `${report.slice(0, cap)}\n\n[truncated for mailto length]` : report;
		return `mailto:parker.neathery@gmail.com?subject=${encodeURIComponent('ppp library OCR error')}&body=${encodeURIComponent(body)}`;
	}

	async function downscaleImage(file: File): Promise<Blob> {
		try {
			const bitmap = await createImageBitmap(file);
			const ratio = Math.min(MAX_LONG_EDGE / bitmap.width, MAX_LONG_EDGE / bitmap.height, 1);
			const w = Math.max(1, Math.round(bitmap.width * ratio));
			const h = Math.max(1, Math.round(bitmap.height * ratio));
			const canvas = document.createElement('canvas');
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext('2d');
			if (!ctx) return file;
			ctx.drawImage(bitmap, 0, 0, w, h);
			const blob: Blob | null = await new Promise((res) =>
				canvas.toBlob(res, 'image/jpeg', TARGET_QUALITY)
			);
			return blob ?? file;
		} catch {
			return file;
		}
	}

	async function handleFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploadError = null;
		uploading = true;
		try {
			const bookIdForPath = lockedBookId ?? sourceBookId;
			if (!bookIdForPath) {
				uploadError = 'Pick a source book before uploading an image.';
				return;
			}
			const blob = await downscaleImage(file);
			const mime = blob.type || 'image/jpeg';
			const ext = mime.split('/')[1] ?? 'jpg';
			const path = scriptureImagePath({ userId, bookId: bookIdForPath, ext });
			const supa = createClient();
			const { error: upErr } = await supa.storage
				.from(SCRIPTURE_IMAGES_BUCKET)
				.upload(path, blob, { contentType: mime, upsert: false });
			if (upErr) {
				uploadError = upErr.message ?? 'Upload failed.';
				return;
			}
			source_image_url = path;
			source_image_mime = mime;
			if (preview_url && preview_url.startsWith('blob:')) URL.revokeObjectURL(preview_url);
			preview_url = URL.createObjectURL(blob);
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Upload failed.';
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	function removeImage() {
		if (preview_url && preview_url.startsWith('blob:')) URL.revokeObjectURL(preview_url);
		source_image_url = '';
		source_image_mime = 'image/jpeg';
		preview_url = null;
		extractMessage = null;
		extractInfo = null;
	}

	function countOcrBoundaryGroups(jobs: PageJob[]): number {
		let n = 0;
		for (const job of jobs) {
			if (job.status !== 'done' || !job.candidates?.length) continue;
			if (job.isPdf) {
				const indices = new Set<number>();
				for (const c of job.candidates) indices.add(sourcePageIndexForCandidate(c));
				n += indices.size > 0 ? indices.size : 1;
			} else {
				n += 1;
			}
		}
		return n;
	}

	function applyContinuationCarry(row: DraftRow, lastBook: string): string {
		if (row.continuation_from_previous_page && !row.bible_book.trim() && lastBook.length > 0) {
			row.bible_book = lastBook;
			row.continuation_from_previous_page = false;
			const conf = row.confidence_score ?? 1;
			row.needs_review = conf < CONFIDENCE_REVIEW_THRESHOLD;
			row.expanded = row.needs_review;
			row.included = isRowSaveable(row);
		}
		if (row.bible_book.trim().length > 0) return row.bible_book.trim();
		return lastBook;
	}

	function setPositionInPageSlice(out: DraftRow[], pageStartIdx: number, pageEndIdx: number) {
		if (pageEndIdx < pageStartIdx) return;
		const count = pageEndIdx - pageStartIdx + 1;
		for (let i = pageStartIdx; i <= pageEndIdx; i++) {
			if (count === 1) out[i]!.positionInPage = 'only';
			else if (i === pageStartIdx) out[i]!.positionInPage = 'first';
			else if (i === pageEndIdx) out[i]!.positionInPage = 'last';
			else out[i]!.positionInPage = 'middle';
		}
	}

	function mergeJobsIntoRows(jobs: PageJob[]): DraftRow[] {
		const ordered = [...jobs].sort((a, b) => a.order - b.order);
		const doneJobs = ordered.filter((j) => j.status === 'done' && j.candidates?.length);
		const boundaryTotal = countOcrBoundaryGroups(doneJobs);
		let lastBook = '';
		const out: DraftRow[] = [];
		let globalGroupIndex = 0;

		for (const job of ordered) {
			if (job.status !== 'done' || !job.candidates?.length) continue;

			if (job.isPdf) {
				const byPage = new Map<number, OcrScriptureCandidate[]>();
				for (const c of job.candidates) {
					const idx = sourcePageIndexForCandidate(c);
					const list = byPage.get(idx) ?? [];
					list.push(c);
					byPage.set(idx, list);
				}
				const pageIndices = [...byPage.keys()].sort((a, b) => a - b);
				const pdfPageTotal = pageIndices.length > 0 ? Math.max(...pageIndices) + 1 : 1;

				for (const pageIdx of pageIndices) {
					globalGroupIndex++;
					const pageStartIdx = out.length;
					for (const c of byPage.get(pageIdx) ?? []) {
						const row = mapCandidateToRow(c);
						row.source_image_url = job.sourcePath;
						row.pageJobOrder = globalGroupIndex;
						row.pageJobTotal = boundaryTotal;
						row.pageJobId = job.id;
						row.pageLabelKind = 'pdf-page';
						row.pdfPageOrder = pageIdx + 1;
						row.pdfPageTotal = pdfPageTotal;
						lastBook = applyContinuationCarry(row, lastBook);
						out.push(row);
					}
					setPositionInPageSlice(out, pageStartIdx, out.length - 1);
				}
			} else {
				globalGroupIndex++;
				const pageStartIdx = out.length;
				for (const c of job.candidates) {
					const row = mapCandidateToRow(c);
					row.source_image_url = job.sourcePath;
					row.pageJobOrder = globalGroupIndex;
					row.pageJobTotal = boundaryTotal;
					row.pageJobId = job.id;
					row.pageLabelKind = 'file';
					lastBook = applyContinuationCarry(row, lastBook);
					out.push(row);
				}
				setPositionInPageSlice(out, pageStartIdx, out.length - 1);
			}
		}
		return out;
	}

	function tryFinalizeBatchMerge() {
		if (pages.length === 0) return;
		if (!pages.every((p) => p.status === 'done' || p.status === 'error')) return;

		const merged = mergeJobsIntoRows(pages);
		if (merged.length > 0) {
			rows = merged;
			extractInfo = null;
			extractMessage = null;
		} else {
			const anyDone = pages.some((p) => p.status === 'done');
			extractInfo = anyDone
				? 'No references detected — add manually below.'
				: 'Could not read any page — check errors on the chips above.';
		}
	}

	function patchPage(id: string, patch: Partial<PageJob>) {
		pages = pages.map((p) => (p.id === id ? { ...p, ...patch } : p));
	}

	async function runPagePipeline(jobId: string, file: File) {
		const bookIdForPath = lockedBookId ?? sourceBookId;
		if (!bookIdForPath) {
			patchPage(jobId, {
				status: 'error',
				error: 'Pick a source book before uploading images.'
			});
			tryFinalizeBatchMerge();
			return;
		}

		const isPdf = isPdfFile(file);
		patchPage(jobId, { isPdf });

		let mime = 'image/jpeg';
		let objectPath = '';
		let previewUrl: string | null = null;

		try {
			const supa = createClient();
			if (isPdf) {
				mime = 'application/pdf';
				objectPath = scriptureImagePath({ userId, bookId: bookIdForPath, ext: 'pdf' });
				patchPage(jobId, { previewUrl: null, status: 'uploading' });
				const { error: upErr } = await supa.storage
					.from(SCRIPTURE_IMAGES_BUCKET)
					.upload(objectPath, file, { contentType: mime, upsert: false });
				if (upErr) {
					patchPage(jobId, {
						status: 'error',
						error: upErr.message ?? 'Upload failed.',
						sourcePath: ''
					});
					tryFinalizeBatchMerge();
					return;
				}
			} else {
				const blob = await downscaleImage(file);
				mime = blob.type || 'image/jpeg';
				const ext = mime.split('/')[1] ?? 'jpg';
				objectPath = scriptureImagePath({ userId, bookId: bookIdForPath, ext });
				previewUrl = URL.createObjectURL(blob);
				patchPage(jobId, { previewUrl, status: 'uploading' });

				const { error: upErr } = await supa.storage
					.from(SCRIPTURE_IMAGES_BUCKET)
					.upload(objectPath, blob, { contentType: mime, upsert: false });
				if (upErr) {
					patchPage(jobId, {
						status: 'error',
						error: upErr.message ?? 'Upload failed.',
						sourcePath: '',
						previewUrl
					});
					tryFinalizeBatchMerge();
					return;
				}
			}

			patchPage(jobId, { sourcePath: objectPath, status: 'extracting', previewUrl, extractLabel: undefined });

			const invokeBase = {
				object_path: objectPath,
				mime_type: mime,
				book_id: bookIdForPath
			};

			if (isPdf) {
				const countResult = await getPdfPageCount(supa, invokeBase);
				if (!countResult.ok) {
					patchPage(jobId, {
						status: 'error',
						error: countResult.message,
						sourcePath: objectPath,
						previewUrl
					});
					tryFinalizeBatchMerge();
					return;
				}
				const pageTotal = countResult.page_count;
				const mergedCandidates: OcrScriptureCandidate[] = [];

				for (let i = 0; i < pageTotal; i++) {
					patchPage(jobId, {
						status: 'extracting',
						extractLabel: pageTotal > 1 ? `Page ${i + 1}/${pageTotal}` : undefined
					});
					const pageArgs =
						pageTotal > 1
							? { ...invokeBase, pdf_page_index: i }
							: invokeBase;
					const pageResult = await invokeOcrScriptureRefs(supa, pageArgs);
					if (!pageResult.ok) {
						patchPage(jobId, {
							status: 'error',
							error: pageTotal > 1 ? `${pageResult.message} (page ${i + 1}/${pageTotal})` : pageResult.message,
							sourcePath: objectPath,
							previewUrl,
							extractLabel: undefined
						});
						tryFinalizeBatchMerge();
						return;
					}
					mergedCandidates.push(...pageResult.data.candidates);
				}

				patchPage(jobId, {
					status: 'done',
					candidates: mergedCandidates,
					sourcePath: objectPath,
					previewUrl,
					extractLabel: undefined
				});
			} else {
				const ocrResult = await invokeOcrScriptureRefs(supa, invokeBase);
				if (!ocrResult.ok) {
					patchPage(jobId, {
						status: 'error',
						error: ocrResult.message,
						sourcePath: objectPath,
						previewUrl
					});
					tryFinalizeBatchMerge();
					return;
				}
				patchPage(jobId, {
					status: 'done',
					candidates: ocrResult.data.candidates,
					sourcePath: objectPath,
					previewUrl
				});
			}
		} catch (e) {
			patchPage(jobId, {
				status: 'error',
				error: formatOcrPipelineError(e),
				sourcePath: objectPath
			});
		}
		tryFinalizeBatchMerge();
	}

	async function startBatchFromFiles(fileArr: File[]) {
		if (fileArr.length === 0) return;

		uploadError = null;
		extractMessage = null;
		extractInfo = null;
		batchUploadNotice = null;

		const sorted = [...fileArr].sort((a, b) => {
			const t = a.lastModified - b.lastModified;
			if (t !== 0) return t;
			return a.name.localeCompare(b.name);
		});

		revokeAllPagePreviewBlobs(pages);

		const newJobs: PageJob[] = sorted.map((f, i) => ({
			id:
				typeof crypto !== 'undefined' && 'randomUUID' in crypto
					? crypto.randomUUID()
					: `p-${Date.now()}-${i}`,
			order: i,
			sourcePath: '',
			previewUrl: null,
			status: 'uploading' as const,
			isPdf: isPdfFile(f)
		}));
		pages = newJobs;

		await Promise.all(
			newJobs.map((job, i) => {
				const file = sorted[i];
				return runPagePipeline(job.id, file);
			})
		);
	}

	function enqueueGalleryFiles(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const list = input.files;
		if (!list?.length) return;
		appendToOcrQueue(Array.from(list));
		input.value = '';
	}

	function enqueueCameraFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		appendToOcrQueue([file]);
		input.value = '';
	}

	function runQueuedExtract() {
		if (ocrQueue.length === 0 || ocrPipelineBusy) return;
		const files = ocrQueue.map((q) => q.file);
		clearOcrQueue();
		void startBatchFromFiles(files);
	}

	async function handleBatchFilesChange(e: Event) {
		enqueueGalleryFiles(e);
	}

	function clearBatchPages() {
		revokeAllPagePreviewBlobs(pages);
		pages = [];
		clearOcrQueue();
		batchUploadNotice = null;
		extractMessage = null;
		extractInfo = null;
	}

	// ---------------------------------------------------------------------------
	// Submit payloads
	// ---------------------------------------------------------------------------

	const rowsJson = $derived(
		JSON.stringify(
			rows
				.filter((r) => r.included && isRowSaveable(r))
				.map((r) => ({
					bible_book: r.bible_book,
					chapter_start: r.chapter_start,
					verse_start: r.verse_start,
					chapter_end: r.chapter_end,
					verse_end: r.verse_end,
					page_start: r.page_start,
					page_end: r.page_end,
					needs_review: r.needs_review,
					review_note: r.review_note,
					...(r.confidence_score != null ? { confidence_score: r.confidence_score } : {}),
					...(r.source_image_url.trim() !== '' ? { source_image_url: r.source_image_url } : {})
				}))
		)
	);

	// Edit mode submits one row's worth of fields in the legacy single-row
	// contract; batch mode submits rows_json. We render hidden inputs for the
	// edit contract from rows[0] when isEdit is true.
	const editRow = $derived(rows[0] ?? blankRow());

	const submitEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				const r = (result.data ?? {}) as {
					kind?: string;
					refId?: string;
					refIds?: string[];
				};
				if (isEdit && r.refId) {
					onSaved?.(r.refId);
				} else if (!isEdit && Array.isArray(r.refIds)) {
					if (browser) {
						rows = [blankRow()];
						source_image_url = '';
						revokeAllPagePreviewBlobs(pages);
						pages = [];
						clearOcrQueue();
						if (preview_url && preview_url.startsWith('blob:'))
							URL.revokeObjectURL(preview_url);
						preview_url = null;
					}
					onSavedBatch?.(r.refIds);
				}
			}
		};
	};

	const continuationNeedsBook = (r: DraftRow) =>
		r.continuation_from_previous_page && r.bible_book.trim().length === 0;
</script>

<form
	method="POST"
	{action}
	use:enhance={submitEnhance}
	class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground"
>
	<input type="hidden" name="source_kind" value={sourceKind} />
	<input type="hidden" name="book_id" value={sourceBookId} />
	<input type="hidden" name="essay_id" value={sourceEssayId} />
	<input type="hidden" name="source_image_url" value={source_image_url} />

	{#if isEdit && existingRef}
		<input type="hidden" name="id" value={existingRef.id} />
		<!-- Edit mode posts to ?/updateScriptureRef which expects single-row fields. -->
		<input type="hidden" name="bible_book" value={editRow.bible_book} />
		<input type="hidden" name="chapter_start" value={editRow.chapter_start} />
		<input type="hidden" name="verse_start" value={editRow.verse_start} />
		<input type="hidden" name="chapter_end" value={editRow.chapter_end} />
		<input type="hidden" name="verse_end" value={editRow.verse_end} />
		<input type="hidden" name="page_start" value={editRow.page_start} />
		<input type="hidden" name="page_end" value={editRow.page_end} />
		<input type="hidden" name="needs_review" value={editRow.needs_review ? 'true' : 'false'} />
		<input type="hidden" name="review_note" value={editRow.review_note} />
		{#if editRow.confidence_score != null}
			<input type="hidden" name="confidence_score" value={String(editRow.confidence_score)} />
		{/if}
	{:else}
		<!-- Batch mode posts a JSON array of rows. -->
		<input type="hidden" name="rows_json" value={rowsJson} />
	{/if}

	<header>
		<h3 class="text-sm font-semibold tracking-tight">
			{isEdit ? 'Edit scripture reference' : 'Add scripture references'}
		</h3>
		<p class="text-xs text-muted-foreground">
			{#if isEdit}
				Pages are free text — `IV.317`, `xiv`, `106n21`, etc. all welcome.
			{:else}
				Add as many references as you like — one save commits the whole batch. Pages are free
				text. OCR: queue up to 10 page photos or PDFs (e.g. Genius Scan) from the gallery and/or
				repeated camera shots, then run OCR; each row keeps the source file path.
			{/if}
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

	{#if !isEdit}
		<div class="space-y-2">
			<Label for="sr-img-multi">Source images / PDF <span class="text-xs text-muted-foreground">(optional, OCR — up to 10)</span></Label>
			<div class="flex flex-wrap items-center gap-2">
				<label class="inline-flex">
					<span
						class="inline-flex h-11 cursor-pointer items-center rounded-md border border-dashed border-input bg-background px-3 text-sm hover:bg-muted"
					>
						Choose photos or PDF
					</span>
					<input
						id="sr-img-multi"
						type="file"
						multiple
						accept="image/*,application/pdf"
						onchange={handleBatchFilesChange}
						class="hidden"
					/>
				</label>
				<label class="inline-flex">
					<span
						class="inline-flex h-11 cursor-pointer items-center rounded-md border border-dashed border-input bg-background px-3 text-sm hover:bg-muted"
					>
						Take photo
					</span>
					<input
						id="sr-img-camera"
						type="file"
						accept="image/*"
						capture="environment"
						onchange={enqueueCameraFile}
						class="hidden"
					/>
				</label>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					class="h-11"
					disabled={ocrQueue.length === 0 || ocrPipelineBusy}
					onclick={runQueuedExtract}
					hotkey="g"
				>
					Run OCR{ocrQueue.length > 0 ? ` (${ocrQueue.length})` : ''}
				</Button>
				{#if pages.length > 0 || ocrQueue.length > 0}
					<Button type="button" variant="ghost" size="sm" onclick={clearBatchPages}>
						Clear queue & pages
					</Button>
				{/if}
			</div>
			{#if ocrQueue.length > 0}
				<div class="flex flex-wrap gap-2" aria-label="Queued photos before OCR">
					{#each ocrQueue as q (q.id)}
						<div class="relative w-16 shrink-0">
							{#if q.isPdf}
								<div
									class="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-md border border-border bg-muted/40 px-1"
									aria-label="PDF queued"
								>
									<FileText class="size-6 text-muted-foreground" aria-hidden="true" />
									<span class="text-[9px] font-medium uppercase tracking-wide text-muted-foreground"
										>PDF</span
									>
								</div>
							{:else}
								<img
									src={q.previewUrl}
									alt=""
									class="aspect-[3/4] w-full rounded-md border border-border object-cover"
								/>
							{/if}
							<Button
								type="button"
								variant="secondary"
								size="icon"
								class="absolute -right-1 -top-1 h-7 w-7 rounded-full shadow-sm"
								onclick={() => removeQueued(q.id)}
								aria-label="Remove from queue"
							>
								<X class="h-3.5 w-3.5" />
							</Button>
						</div>
					{/each}
				</div>
			{/if}
			{#if batchUploadNotice}
				<p class="text-xs text-amber-700 dark:text-amber-400" role="status">{batchUploadNotice}</p>
			{/if}
			{#if pages.length > 0}
				<div class="flex flex-wrap gap-3" aria-label="OCR page status">
					{#each pages as job (job.id)}
						<div
							class={cn(
								'flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-2 text-[10px]',
								job.error ? 'min-w-[min(100%,20rem)] max-w-full sm:max-w-md' : 'w-[4.5rem]'
							)}
						>
							{#if job.previewUrl}
								<img
									src={job.previewUrl}
									alt=""
									class={cn(
										'rounded object-cover',
										job.error ? 'mx-auto aspect-[3/4] max-h-40 w-auto' : 'aspect-[3/4] w-full'
									)}
								/>
							{:else if job.isPdf}
								<div
									class={cn(
										'flex flex-col items-center justify-center gap-1 rounded border border-border bg-muted/40',
										job.error ? 'aspect-[3/4] max-h-40 min-h-[6rem] w-full' : 'aspect-[3/4] w-full'
									)}
								>
									<FileText class="size-6 text-muted-foreground" aria-hidden="true" />
									<span class="text-[9px] font-medium uppercase tracking-wide text-muted-foreground"
										>PDF</span
									>
								</div>
							{:else}
								<div
									class={cn(
										'flex items-center justify-center rounded bg-muted text-muted-foreground',
										job.error ? 'aspect-[3/4] max-h-40 min-h-[6rem] w-full' : 'aspect-[3/4] w-full'
									)}
								>
									…
								</div>
							{/if}
							<span
								class={cn(
									'rounded px-1 py-0.5 text-center font-medium uppercase tracking-wide',
									job.status === 'done' && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
									job.status === 'error' && 'bg-destructive/15 text-destructive',
									(job.status === 'uploading' || job.status === 'extracting') &&
										'bg-amber-500/15 text-amber-900 dark:text-amber-200'
								)}
							>
								{#if job.status === 'extracting' && job.extractLabel}
									{job.extractLabel}
								{:else}
									{job.status}
								{/if}
							</span>
							{#if job.error}
								<pre
									class="max-h-40 select-all overflow-auto whitespace-pre-wrap break-words rounded border border-destructive/20 bg-destructive/5 p-2 text-[10px] leading-snug text-destructive"
									role="alert"
								>{job.error}</pre>
								<div class="flex flex-wrap items-center gap-2">
									<Button type="button" variant="outline" size="sm" onclick={() => void copyJobError(job)}>
										<Copy class="mr-1 h-3 w-3" />
										Copy error
									</Button>
									<a
										href={ocrErrorMailtoHref(job)}
										class="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-muted"
									>
										<Mail class="h-3 w-3" />
										Email report
									</a>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
			{#if extractMessage}
				<p class="text-xs text-destructive" role="alert">{extractMessage}</p>
			{/if}
			{#if extractInfo}
				<p class="text-xs text-muted-foreground" role="status">{extractInfo}</p>
			{/if}
		</div>
	{:else}
		<!-- Edit mode: single shared image -->
		<div class="space-y-2">
			<Label for="sr-img">
				Source image <span class="text-xs text-muted-foreground">(optional)</span>
			</Label>
			{#if preview_url}
				<div class="flex flex-wrap items-start gap-3">
					<img
						src={preview_url}
						alt="Scripture page"
						class="h-32 w-auto rounded-md border border-border object-cover"
					/>
					<div class="flex flex-col gap-2">
						<label class="inline-flex">
							<span
								class="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
							>
								{uploading ? 'Uploading…' : 'Replace'}
							</span>
							<input
								id="sr-img"
								type="file"
								accept="image/*"
								capture="environment"
								onchange={handleFileChange}
								disabled={uploading}
								class="hidden"
							/>
						</label>
						<Button type="button" variant="ghost" size="sm" onclick={removeImage}>
							Remove
						</Button>
					</div>
				</div>
			{:else}
				<label class="inline-flex">
					<span
						class="inline-flex h-11 cursor-pointer items-center rounded-md border border-dashed border-input bg-background px-3 text-sm hover:bg-muted"
					>
						{uploading ? 'Uploading…' : 'Choose / take photo'}
					</span>
					<input
						id="sr-img"
						type="file"
						accept="image/*"
						capture="environment"
						onchange={handleFileChange}
						disabled={uploading}
						class="hidden"
					/>
				</label>
			{/if}
			{#if uploadError}
				<p class="text-xs text-destructive" role="alert">{uploadError}</p>
			{/if}
		</div>
	{/if}

	<!-- Rows -->
	<div class="flex flex-col gap-3">
		{#if !isEdit}
			<div
				class="mb-1 hidden min-w-[48rem] grid-cols-[minmax(8rem,10rem)_3.5rem_3.5rem_1.25rem_3.5rem_3.5rem_7rem_7rem_auto_minmax(6rem,1fr)] gap-1 px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:grid"
				aria-hidden="true"
			>
				<span>Book</span>
				<span class="text-center">Ch</span>
				<span class="text-center">Vs</span>
				<span class="text-center">–</span>
				<span class="text-center">Ch</span>
				<span class="text-center">Vs</span>
				<span>Page</span>
				<span>End</span>
				<span class="text-center">Rev</span>
				<span class="text-center">Actions</span>
			</div>
		{/if}

		{#if !isEdit && batchReviewStats && batchReviewStats.total > 1}
			<div
				class="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center"
				role="region"
				aria-label="Batch review tools"
			>
				<p class="min-w-0 flex-1 leading-snug text-foreground">
					{batchReviewStats.total} references parsed.
					{#if batchReviewStats.flagged > 0}
						<span class="text-amber-800 dark:text-amber-200">
							{batchReviewStats.flagged} flagged for review.
						</span>
					{/if}
				</p>
				<div class="flex flex-wrap gap-2">
					{#if batchReviewStats.confident > 0}
						<Button type="button" variant="secondary" size="sm" onclick={confirmConfidentRows}>
							Confirm {batchReviewStats.confident} confident
						</Button>
					{/if}
					<Button type="button" variant="outline" size="sm" onclick={expandAllRows}>
						Expand all
					</Button>
				</div>
			</div>
		{/if}

		{#each rows as row, idx (row.key)}
			{#if !isEdit && idx > 0 && row.pageJobOrder > 0 && rows[idx - 1]!.pageJobOrder !== row.pageJobOrder}
				<div
					class="flex items-center gap-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
					role="separator"
				>
					<span class="h-px min-w-4 flex-1 bg-border"></span>
					<span class="inline-flex shrink-0 items-center gap-1.5">
						<MapPin class="size-3 text-amber-600/80 dark:text-amber-400/80" aria-hidden="true" />
						{#if row.pageLabelKind === 'pdf-page'}
							Page {row.pdfPageOrder} / {row.pdfPageTotal}
						{:else}
							from page {row.pageJobOrder} of {row.pageJobTotal}
						{/if}
						{#if pageJobPreviewUrl(row.pageJobId)}
							<img
								src={pageJobPreviewUrl(row.pageJobId)!}
								alt=""
								class="ml-1 inline-block h-7 w-5 rounded border border-border object-cover"
							/>
						{/if}
					</span>
					<span class="h-px min-w-4 flex-1 bg-border"></span>
				</div>
			{/if}
			{#if isEdit}
				<div
					class="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3"
					aria-label={`Reference row ${idx + 1}`}
				>
					<div class="flex items-center justify-between">
						<span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
							Reference
						</span>
					</div>

					<div class="grid gap-3 sm:grid-cols-[1fr_2fr]">
						<div class="space-y-2">
							<Label for={`sr-bible-${row.key}`}>
								Bible book <span class="text-destructive">*</span>
							</Label>
							<div class="sm:hidden">
								<Button
									type="button"
									id={`sr-bible-${row.key}`}
									variant="outline"
									class="h-12 min-h-11 w-full justify-between px-3 text-base font-normal"
									onclick={() => openBiblePicker(row.key)}
								>
									<span class="truncate text-left">
										{row.bible_book.length > 0 ? row.bible_book : '— Pick a book —'}
									</span>
								</Button>
							</div>
							<div class="hidden sm:block">
								<Select.Root
									type="single"
									value={row.bible_book}
									onValueChange={(v) => setRowBibleBook(row.key, v ?? '')}
									items={bibleBookItems}
								>
									<Select.Trigger
										id={`sr-bible-dsk-${row.key}`}
										size="default"
										class="h-11 w-full justify-between px-3"
									>
										<span data-slot="select-value" class="truncate text-left">
											{row.bible_book.length > 0 ? row.bible_book : '— Pick a book —'}
										</span>
									</Select.Trigger>
									<Select.Content class="max-h-72">
										{#each bibleBookItems as b (b.value)}
											<Select.Item value={b.value} label={b.label} class="min-h-10 py-2">
												{b.label}
											</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-2">
							<div class="space-y-1">
								<Label for={`sr-cs-${row.key}`} class="text-xs">Chapter</Label>
								<Input
									id={`sr-cs-${row.key}`}
									type="number"
									inputmode="numeric"
									min="0"
									max="199"
									bind:value={row.chapter_start}
									class="h-12 min-h-11 text-base tabular-nums sm:h-11"
								/>
							</div>
							<div class="space-y-1">
								<Label for={`sr-vs-${row.key}`} class="text-xs">Verse</Label>
								<Input
									id={`sr-vs-${row.key}`}
									type="number"
									inputmode="numeric"
									min="0"
									max="999"
									bind:value={row.verse_start}
									class="h-12 min-h-11 text-base tabular-nums sm:h-11"
								/>
							</div>
							<div class="space-y-1">
								<Label for={`sr-ce-${row.key}`} class="text-xs">to Ch.</Label>
								<Input
									id={`sr-ce-${row.key}`}
									type="number"
									inputmode="numeric"
									min="0"
									max="199"
									bind:value={row.chapter_end}
									class="h-12 min-h-11 text-base tabular-nums sm:h-11"
								/>
							</div>
							<div class="space-y-1">
								<Label for={`sr-ve-${row.key}`} class="text-xs">to Vs.</Label>
								<Input
									id={`sr-ve-${row.key}`}
									type="number"
									inputmode="numeric"
									min="0"
									max="999"
									bind:value={row.verse_end}
									class="h-12 min-h-11 text-base tabular-nums sm:h-11"
								/>
							</div>
						</div>
					</div>

					<div class="grid gap-3 sm:grid-cols-2">
						<div class="space-y-1">
							<Label for={`sr-ps-${row.key}`} class="text-xs">
								Page start <span class="text-destructive">*</span>
							</Label>
							<Input
								id={`sr-ps-${row.key}`}
								bind:value={row.page_start}
								placeholder="e.g. 317, IV.317, xiv"
								class="h-12 min-h-11 text-base sm:h-11"
							/>
						</div>
						<div class="space-y-1">
							<Label for={`sr-pe-${row.key}`} class="text-xs">Page end</Label>
							<Input
								id={`sr-pe-${row.key}`}
								bind:value={row.page_end}
								placeholder="(blank for single page)"
								class="h-12 min-h-11 text-base sm:h-11"
							/>
						</div>
					</div>

					<div class="space-y-2">
						<label class="flex items-center gap-2 text-xs">
							<input type="checkbox" bind:checked={row.needs_review} class="size-4" />
							<span>Needs review</span>
						</label>
						{#if row.needs_review}
							<textarea
								bind:value={row.review_note}
								rows={2}
								class="flex min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
								placeholder="Why does this need review?"
							></textarea>
						{/if}
					</div>
				</div>
			{:else}
				{#if !row.expanded}
					<div
						class={cn(
							'flex min-h-11 items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-2 py-1 sm:hidden',
							rowShowsPageEdge(row) && 'border-l-2 border-l-amber-400/60',
							pulseRowKeys[row.key] && 'bg-emerald-500/15 ring-1 ring-emerald-500/40',
							continuationNeedsBook(row) && 'border-amber-500/50 bg-amber-500/10'
						)}
						aria-label={`Reference row ${idx + 1} (compact)`}
					>
						<input
							type="checkbox"
							class="size-4 shrink-0"
							checked={row.included}
							disabled={!isRowSaveable(row)}
							aria-label="Include in save"
							onchange={(e) =>
								setRowIncluded(row.key, (e.currentTarget as HTMLInputElement).checked)}
						/>
						<button
							type="button"
							class="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
							onclick={() => toggleRowExpanded(row.key)}
							onkeydown={(e) => handleStripKeydown(e, row.key)}
						>
							<span class="min-w-0 flex-1 truncate font-medium text-foreground">
								{formatRowStripLabel(row)}
							</span>
							{#if row.confidence_score != null}
								<span class={cn('shrink-0 text-xs tabular-nums', confidenceStripClass(row.confidence_score))}>
									{Math.round(row.confidence_score * 100)}%
								</span>
							{/if}
						</button>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							class="size-9 shrink-0"
							aria-label="Expand row"
							onclick={() => toggleRowExpanded(row.key)}
						>
							<ChevronDown class="size-4" />
						</Button>
					</div>
					<div
						class={cn(
							'hidden min-h-9 items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-2 py-1 sm:flex',
							rowShowsPageEdge(row) && 'border-l-2 border-l-amber-400/60',
							pulseRowKeys[row.key] && 'bg-emerald-500/15 ring-1 ring-emerald-500/40',
							continuationNeedsBook(row) && 'border-amber-500/50 bg-amber-500/10'
						)}
						aria-label={`Reference row ${idx + 1} (compact)`}
					>
						<input
							type="checkbox"
							class="size-3.5 shrink-0"
							checked={row.included}
							disabled={!isRowSaveable(row)}
							aria-label="Include in save"
							onchange={(e) =>
								setRowIncluded(row.key, (e.currentTarget as HTMLInputElement).checked)}
						/>
						<button
							type="button"
							class="flex min-w-0 flex-1 items-center gap-2 text-left text-xs"
							onclick={() => toggleRowExpanded(row.key)}
							onkeydown={(e) => handleStripKeydown(e, row.key)}
						>
							<span class="min-w-0 flex-1 truncate">{formatRowStripLabel(row)}</span>
							{#if row.confidence_score != null}
								<span class={cn('shrink-0 tabular-nums', confidenceStripClass(row.confidence_score))}>
									{Math.round(row.confidence_score * 100)}%
								</span>
							{/if}
						</button>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							class="size-8 shrink-0"
							aria-label="Expand row"
							onclick={() => toggleRowExpanded(row.key)}
						>
							<ChevronDown class="size-3.5" />
						</Button>
					</div>
				{/if}
				{#if row.expanded}
				<!-- Mobile: card -->
				<div
					class={cn(
						'flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 sm:hidden',
						rowShowsPageEdge(row) && 'border-l-2 border-l-amber-400/60',
						continuationNeedsBook(row) && 'border-amber-500/50 bg-amber-500/10'
					)}
					aria-label={`Reference row ${idx + 1}`}
				>
					<div class="flex items-center justify-between">
						<span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
							Row {idx + 1}
						</span>
						<div class="flex gap-1">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onclick={() => toggleRowExpanded(row.key)}
								aria-label="Collapse row"
							>
								<ChevronUp class="size-3.5" /> Collapse
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onclick={() => duplicateRow(idx)}
								aria-label="Duplicate row"
							>
								<Copy class="size-3.5" /> Duplicate
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onclick={() => removeRow(idx)}
								aria-label="Remove row"
								class="text-destructive hover:text-destructive"
							>
								<X class="size-3.5" />
							</Button>
						</div>
					</div>
					{#if continuationNeedsBook(row)}
						<p class="text-xs font-medium text-amber-900 dark:text-amber-200">
							Choose the Bible book — this line continues from the previous page.
						</p>
					{/if}

					<div class="grid gap-3 sm:grid-cols-[1fr_2fr]">
						<div class="space-y-2">
							<Label for={`sr-bible-m-${row.key}`}>
								Bible book <span class="text-destructive">*</span>
							</Label>
							<Button
								type="button"
								id={`sr-bible-m-${row.key}`}
								variant="outline"
								class={cn(
									'h-12 min-h-11 w-full justify-between px-3 text-base font-normal',
									continuationNeedsBook(row) &&
										'border-destructive/40 bg-destructive/5 text-destructive'
								)}
								onclick={() => openBiblePicker(row.key)}
							>
								<span class="truncate text-left">
									{continuationNeedsBook(row)
										? 'Choose book — continues from previous page'
										: row.bible_book.length > 0
											? row.bible_book
											: '— Pick a book —'}
								</span>
							</Button>
						</div>

						<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-2">
							<div class="space-y-1">
								<Label for={`sr-cs-m-${row.key}`} class="text-xs">Chapter</Label>
								<Input
									id={`sr-cs-m-${row.key}`}
									type="number"
									inputmode="numeric"
									min="0"
									max="199"
									bind:value={row.chapter_start}
									class="h-12 min-h-11 text-base tabular-nums sm:h-11"
								/>
							</div>
							<div class="space-y-1">
								<Label for={`sr-vs-m-${row.key}`} class="text-xs">Verse</Label>
								<Input
									id={`sr-vs-m-${row.key}`}
									type="number"
									inputmode="numeric"
									min="0"
									max="999"
									bind:value={row.verse_start}
									class="h-12 min-h-11 text-base tabular-nums sm:h-11"
								/>
							</div>
							<div class="space-y-1">
								<Label for={`sr-ce-m-${row.key}`} class="text-xs">to Ch.</Label>
								<Input
									id={`sr-ce-m-${row.key}`}
									type="number"
									inputmode="numeric"
									min="0"
									max="199"
									bind:value={row.chapter_end}
									class="h-12 min-h-11 text-base tabular-nums sm:h-11"
								/>
							</div>
							<div class="space-y-1">
								<Label for={`sr-ve-m-${row.key}`} class="text-xs">to Vs.</Label>
								<Input
									id={`sr-ve-m-${row.key}`}
									type="number"
									inputmode="numeric"
									min="0"
									max="999"
									bind:value={row.verse_end}
									class="h-12 min-h-11 text-base tabular-nums sm:h-11"
								/>
							</div>
						</div>
					</div>

					<div class="grid gap-3 sm:grid-cols-2">
						<div class="space-y-1">
							<Label for={`sr-ps-m-${row.key}`} class="text-xs">
								Page start <span class="text-destructive">*</span>
							</Label>
							<Input
								id={`sr-ps-m-${row.key}`}
								bind:value={row.page_start}
								placeholder="e.g. 317, IV.317, xiv"
								class="h-12 min-h-11 text-base sm:h-11"
							/>
						</div>
						<div class="space-y-1">
							<Label for={`sr-pe-m-${row.key}`} class="text-xs">Page end</Label>
							<Input
								id={`sr-pe-m-${row.key}`}
								bind:value={row.page_end}
								placeholder="(blank for single page)"
								class="h-12 min-h-11 text-base sm:h-11"
							/>
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-2 text-xs">
						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								class="size-4"
								checked={row.included}
								disabled={!isRowSaveable(row)}
								aria-label="Include in save"
								onchange={(e) =>
									setRowIncluded(row.key, (e.currentTarget as HTMLInputElement).checked)}
							/>
							<span>Include in save</span>
						</label>
						<label class="flex items-center gap-2">
							<input type="checkbox" bind:checked={row.needs_review} class="size-4" />
							<span>Needs review</span>
						</label>
						{#if row.needs_review}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								class="h-8 px-2"
								onclick={() => toggleReviewNote(row.key)}
								aria-expanded={reviewNoteOpen[row.key] === true}
								aria-label="Edit review note"
							>
								<MessageSquare class="size-3.5" />
								Note
							</Button>
						{/if}
					</div>
					{#if row.needs_review && reviewNoteOpen[row.key]}
						<textarea
							bind:value={row.review_note}
							rows={2}
							class="flex min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
							placeholder="Why does this need review?"
						></textarea>
					{/if}
				</div>

				<!-- Desktop: compact grid -->
				<div class="hidden sm:block">
					<div
						class={cn(
							'min-w-[48rem] rounded-lg border border-border/70 bg-muted/20 px-2 py-1.5',
							rowShowsPageEdge(row) && 'border-l-2 border-l-amber-400/60',
							continuationNeedsBook(row) && 'border-amber-500/50 bg-amber-500/10'
						)}
					>
						<div
							class="grid grid-cols-[minmax(8rem,10rem)_3.5rem_3.5rem_1.25rem_3.5rem_3.5rem_7rem_7rem_auto_minmax(6rem,1fr)] items-center gap-1"
						>
							<div class="min-w-0">
								{#if continuationNeedsBook(row)}
									<Button
										type="button"
										variant="outline"
										size="sm"
										class="h-8 w-full border-destructive/40 bg-destructive/5 px-2 text-xs text-destructive"
										onclick={() => openBiblePicker(row.key)}
									>
										<span class="line-clamp-2 text-left leading-tight">
											Choose book — continues from previous page
										</span>
									</Button>
								{:else}
									<Select.Root
										type="single"
										value={row.bible_book}
										onValueChange={(v) => setRowBibleBook(row.key, v ?? '')}
										items={bibleBookItems}
									>
										<Select.Trigger
											size="sm"
											class="h-8 w-full min-w-0 justify-between px-2 text-xs"
											aria-label="Bible book"
										>
											<span data-slot="select-value" class="truncate text-left">
												{row.bible_book.length > 0 ? row.bible_book : 'Book'}
											</span>
										</Select.Trigger>
										<Select.Content class="max-h-72">
											{#each bibleBookItems as b (b.value)}
												<Select.Item value={b.value} label={b.label} class="min-h-8 py-1 text-sm">
													{b.label}
												</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								{/if}
							</div>
							<Input
								id={`sr-cs-d-${row.key}`}
								type="number"
								inputmode="numeric"
								min="0"
								max="199"
								bind:value={row.chapter_start}
								class="h-8 min-w-0 px-2 text-xs tabular-nums"
								aria-label="Chapter start"
							/>
							<Input
								id={`sr-vs-d-${row.key}`}
								type="number"
								inputmode="numeric"
								min="0"
								max="999"
								bind:value={row.verse_start}
								class="h-8 min-w-0 px-2 text-xs tabular-nums"
								aria-label="Verse start"
							/>
							<span class="text-center text-xs text-muted-foreground">–</span>
							<Input
								id={`sr-ce-d-${row.key}`}
								type="number"
								inputmode="numeric"
								min="0"
								max="199"
								bind:value={row.chapter_end}
								class="h-8 min-w-0 px-2 text-xs tabular-nums"
								aria-label="Chapter end"
							/>
							<Input
								id={`sr-ve-d-${row.key}`}
								type="number"
								inputmode="numeric"
								min="0"
								max="999"
								bind:value={row.verse_end}
								class="h-8 min-w-0 px-2 text-xs tabular-nums"
								aria-label="Verse end"
							/>
							<Input
								id={`sr-ps-d-${row.key}`}
								bind:value={row.page_start}
								placeholder="Page"
								class="h-8 min-w-0 px-2 text-xs"
								aria-label="Page start"
							/>
							<Input
								id={`sr-pe-d-${row.key}`}
								bind:value={row.page_end}
								placeholder="End"
								class="h-8 min-w-0 px-2 text-xs"
								aria-label="Page end"
							/>
							<label class="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
								<input type="checkbox" bind:checked={row.needs_review} class="size-3.5" aria-label="Needs review" />
								<span class="hidden xl:inline">Review</span>
							</label>
							<div class="flex justify-center gap-0.5">
								{#if row.needs_review}
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										class="size-8"
										onclick={() => toggleReviewNote(row.key)}
										aria-label="Review note"
									>
										<MessageSquare class="size-3.5" />
									</Button>
								{:else}
									<span class="size-8"></span>
								{/if}
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									class="size-8"
									onclick={() => duplicateRow(idx)}
									aria-label="Duplicate row"
								>
									<Copy class="size-3.5" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									class="size-8 text-destructive hover:text-destructive"
									onclick={() => removeRow(idx)}
									aria-label="Remove row"
								>
									<X class="size-3.5" />
								</Button>
							</div>
						</div>
						{#if row.needs_review && reviewNoteOpen[row.key]}
							<textarea
								bind:value={row.review_note}
								rows={2}
								class="mt-2 min-h-14 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
								placeholder="Why does this need review?"
							></textarea>
						{/if}
					</div>
				</div>
				{/if}
			{/if}
		{/each}

		{#if !isEdit}
			<Button type="button" variant="outline" size="sm" onclick={addRow} class="self-start">
				<Plus class="size-4" /> Add another reference
			</Button>
		{/if}
	</div>

	<div class="flex items-center justify-end gap-2">
		{#if onCancel}
			<Button
				type="button"
				variant="ghost"
				hotkey="Escape"
				label="Cancel"
				onclick={() => onCancel?.()}
				disabled={pending}
			/>
		{/if}
		<Button
			type="submit"
			hotkey="s"
			disabled={pending || uploading || !parent || !hasAnyValidRow}
			label={pending
				? 'Saving…'
				: isEdit
					? 'Save changes'
					: (() => {
							const stats = batchReviewStats;
							if (!stats) return 'Save references';
							const { includedCount, total } = stats;
							if (includedCount === 0) return 'Save references';
							if (includedCount === total)
								return includedCount === 1
									? 'Save 1 reference'
									: `Save ${includedCount} references`;
							return `Save ${includedCount} of ${total}`;
						})()}
		/>
	</div>
</form>

<!-- Mobile bible book picker (shared; `max-sm` rows open this instead of Select). -->
<Sheet.Root bind:open={biblePickerOpen}>
	<Sheet.Content side="bottom" class="max-h-[88vh] gap-0 p-0">
		<Sheet.Header class="border-b border-border px-4 pb-3 pt-2 text-left">
			<Sheet.Title class="text-base">
				{biblePickerRowKey &&
				rows.some((r) => r.key === biblePickerRowKey && continuationNeedsBook(r))
					? 'Choose Bible book (continues from previous page)'
					: 'Choose Bible book'}
			</Sheet.Title>
		</Sheet.Header>
		<div class="border-b border-border px-3 py-2">
			<Input
				type="search"
				bind:value={bibleFilter}
				placeholder="Filter books…"
				class="h-11 text-base"
				autocomplete="off"
			/>
		</div>
		{#if biblePickerSuggestions.length > 0 && bibleFilter.trim().length === 0}
			<div class="border-b border-border px-3 py-2">
				<p class="mb-2 text-xs font-medium text-muted-foreground">Suggestions</p>
				<div class="grid grid-cols-2 gap-2">
					{#each biblePickerSuggestions as name (name)}
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="h-10 justify-start truncate px-2 text-sm font-normal"
							onclick={() => pickBibleForRow(name)}
						>
							{name}
						</Button>
					{/each}
				</div>
			</div>
		{/if}
		<div class="max-h-[60vh] overflow-y-auto overscroll-contain px-2 py-2">
			{#each filteredBibleNames as name (name)}
				<button
					type="button"
					class="flex min-h-12 w-full items-center rounded-md px-3 py-2.5 text-left text-base text-foreground hover:bg-muted"
					onclick={() => pickBibleForRow(name)}
				>
					{name}
				</button>
			{/each}
			{#if filteredBibleNames.length === 0}
				<p class="px-3 py-4 text-center text-sm text-muted-foreground">No matches.</p>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>

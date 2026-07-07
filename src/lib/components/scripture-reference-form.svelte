<script lang="ts">
	import { browser } from '$app/environment';
	import { deserialize } from '$app/forms';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { cn } from '$lib/utils.js';
	import Plus from '@lucide/svelte/icons/plus';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import SourcePicker from '$lib/components/source-picker.svelte';
	import ScriptureBiblePickerSheet from '$lib/components/scripture-bible-picker-sheet.svelte';
	import ScriptureOcrQueue from '$lib/components/scripture-ocr-queue.svelte';
	import ScriptureRowEditor from '$lib/components/scripture-row-editor.svelte';
	import type { PolymorphicParent } from '$lib/library/polymorphic';
	import type { BookListRow, ScriptureRefRow } from '$lib/types/library';
	import { createClient } from '$lib/supabase/client';
	import {
		SCRIPTURE_IMAGES_BUCKET,
		scriptureImagePath
	} from '$lib/library/storage';
	import {
		clearScriptureBatchDraft,
		loadScriptureBatchDraft,
		saveScriptureBatchDraft,
		serializePagesForDraft,
		type ScriptureBatchDraft
	} from '$lib/library/scripture-batch-draft';
	import {
		BATCH_ROW_WINDOW_THRESHOLD,
		BATCH_SAVE_CHUNK_SIZE,
		buildRowsJsonPayload,
		chunkArray,
		computeRowWindow,
		ocrPipelineProgressLabel
	} from '$lib/library/scripture-batch-upload';
	import {
		blankDraftRow,
		continuationNeedsBook,
		draftRowFromExisting,
		freshDraftRowKey,
		isDraftRowSaveable,
		type ScriptureDraftRow,
		type ScripturePageJob
	} from '$lib/library/scripture-draft-row';

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
	 *   Optional **multi-image** OCR via `<ScriptureOcrQueue>` (up to 10 photos/PDFs).
	 *   Posts to `?/createScriptureRefsBatch`. Empty draft rows are skipped server-side.
	 *
	 * Image upload: file input → client-side downscale (~2048px JPEG) →
	 * supabase.storage.upload to `library-scripture-images/${userId}/${bookId}/…`.
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
		onCancel,
		onBatchDirtyChange
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
		/** Batch mode: parent can gate in-app navigation while OCR/review draft is active. */
		onBatchDirtyChange?: (dirty: boolean) => void;
	} = $props();

	const isEdit = $derived(!!existingRef);

	const seedKey = $derived(existingRef?.id ?? `__create__:${lockedBookId ?? ''}`);

	let parent = $state<PolymorphicParent | null>(null);
	let rows = $state<ScriptureDraftRow[]>([blankDraftRow()]);
	let source_image_url = $state('');
	let source_image_mime = $state('image/jpeg');
	let preview_url = $state<string | null>(null);
	let pending = $state(false);
	let uploading = $state(false);
	let uploadError = $state<string | null>(null);
	let extractMessage = $state<string | null>(null);
	let extractInfo = $state<string | null>(null);
	let batchUploadNotice = $state<string | null>(null);

	let pages = $state<ScripturePageJob[]>([]);
	let reviewNoteOpen = $state<Record<string, boolean>>({});
	let pulseRowKeys = $state<Record<string, true>>({});
	let saveProgress = $state('');
	let draftResumeOffer = $state<ScriptureBatchDraft | null>(null);
	let draftBannerSuppressed = $state(false);
	let pageExtractLabels = $state<Record<string, string | undefined>>({});
	let rowListScrollTop = $state(0);
	let rowListViewportHeight = $state(400);
	let rowListEl = $state<HTMLDivElement | null>(null);
	let ocrPipelineBusy = $state(false);

	const PATCH_ROW_THRESHOLD = 50;

	const ocrProgressFooterLabel = $derived(ocrPipelineProgressLabel(pages, pageExtractLabels));

	const hasUnsavedBatchDraft = $derived(
		!isEdit &&
			rows.length > 1 &&
			(rows.some((r) => r.included && isDraftRowSaveable(r)) || pages.length > 0 || ocrPipelineBusy)
	);

	const useRowWindow = $derived(!isEdit && rows.length > BATCH_ROW_WINDOW_THRESHOLD);

	const rowWindow = $derived.by(() => {
		if (!useRowWindow) {
			return { start: 0, end: rows.length, topSpacer: 0, bottomSpacer: 0 };
		}
		const inputs = rows.map((r, i) => ({
			expanded: r.expanded,
			pageJobOrder: r.pageJobOrder,
			prevPageJobOrder: i > 0 ? rows[i - 1]!.pageJobOrder : 0
		}));
		return computeRowWindow(inputs, rowListScrollTop, rowListViewportHeight);
	});

	const visibleRows = $derived(
		useRowWindow ? rows.slice(rowWindow.start, rowWindow.end) : rows
	);

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
		const confident = rows.filter((r) => !r.needs_review && isDraftRowSaveable(r)).length;
		const includedCount = rows.filter((r) => r.included && isDraftRowSaveable(r)).length;
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

	function patchRow(key: string, partial: Partial<ScriptureDraftRow>) {
		if (rows.length <= PATCH_ROW_THRESHOLD) {
			rows = rows.map((r) => (r.key === key ? { ...r, ...partial } : r));
			return;
		}
		const idx = rows.findIndex((r) => r.key === key);
		if (idx === -1) return;
		rows[idx] = { ...rows[idx]!, ...partial };
		rows = rows;
	}

	function pickBibleForRow(name: string) {
		const key = biblePickerRowKey;
		if (!key) return;
		patchRow(key, { bible_book: name, continuation_from_previous_page: false });
		closeBiblePicker();
	}

	function setRowBibleBook(rowKey: string, value: string) {
		patchRow(rowKey, {
			bible_book: value,
			continuation_from_previous_page:
				value.trim().length > 0
					? false
					: (rows.find((r) => r.key === rowKey)?.continuation_from_previous_page ?? false)
		});
	}

	function revokeAllPagePreviewBlobs(jobs: ScripturePageJob[]) {
		for (const j of jobs) {
			if (j.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(j.previewUrl);
		}
	}

	let seededFor = $state<string | null>(null);
	$effect(() => {
		const key = seedKey;
		if (seededFor === key) return;
		seededFor = key;

		if (existingRef) {
			parent = existingRef.book_id
				? { kind: 'book', book_id: existingRef.book_id }
				: existingRef.essay_id
					? { kind: 'essay', essay_id: existingRef.essay_id }
					: null;
			rows = [draftRowFromExisting(existingRef)];
			source_image_url = existingRef.source_image_url ?? '';
			preview_url = existingRef.source_image_signed_url ?? null;
		} else {
			parent = lockedBookId ? { kind: 'book', book_id: lockedBookId } : null;
			rows = [blankDraftRow()];
			source_image_url = '';
			preview_url = null;
		}
		uploadError = null;
		extractMessage = null;
		extractInfo = null;
		batchUploadNotice = null;
		revokeAllPagePreviewBlobs(pages);
		pages = [];
		pageExtractLabels = {};
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

	const hasAnyValidRow = $derived(rows.some((r) => r.included && isDraftRowSaveable(r)));

	function toggleRowExpanded(key: string) {
		const row = rows.find((r) => r.key === key);
		if (!row) return;
		patchRow(key, { expanded: !row.expanded });
	}

	function setRowIncluded(key: string, included: boolean) {
		patchRow(key, { included });
	}

	function expandAllRows() {
		rows = rows.map((r) => ({ ...r, expanded: true }));
	}

	function confirmConfidentRows() {
		const keys: string[] = [];
		rows = rows.map((r) => {
			if (!r.needs_review && isDraftRowSaveable(r)) {
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
			patchRow(key, { expanded: false });
		}
	}

	function handleRowListScroll(e: Event) {
		const el = e.currentTarget as HTMLDivElement;
		rowListScrollTop = el.scrollTop;
		rowListViewportHeight = el.clientHeight;
	}

	function resumeDraft() {
		const draft = draftResumeOffer;
		if (!draft) return;
		draftResumeOffer = null;
		draftBannerSuppressed = true;
		parent = draft.parent;
		rows = draft.rows as ScriptureDraftRow[];
		extractInfo = null;
		extractMessage = null;
	}

	function discardDraftOffer() {
		if (lockedBookId) clearScriptureBatchDraft(lockedBookId);
		draftResumeOffer = null;
		draftBannerSuppressed = true;
	}

	let draftSaveTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleDraftSave() {
		if (!browser || isEdit || !lockedBookId || rows.length < 2) return;
		if (draftSaveTimer) clearTimeout(draftSaveTimer);
		draftSaveTimer = setTimeout(() => {
			draftSaveTimer = null;
			saveScriptureBatchDraft({
				version: 1,
				bookId: lockedBookId!,
				savedAt: new Date().toISOString(),
				parent,
				rows: rows.map((r) => ({ ...r })),
				pages: serializePagesForDraft(pages)
			});
		}, 500);
	}

	function addRow() {
		rows = [...rows, blankDraftRow()];
	}

	function duplicateRow(idx: number) {
		const src = rows[idx];
		const copy: ScriptureDraftRow = { ...src, key: freshDraftRowKey(), expanded: true };
		rows = [...rows.slice(0, idx + 1), copy, ...rows.slice(idx + 1)];
	}

	function removeRow(idx: number) {
		if (rows.length === 1) {
			rows = [blankDraftRow()];
			return;
		}
		rows = rows.filter((_, i) => i !== idx);
	}

	function toggleReviewNote(key: string) {
		reviewNoteOpen = { ...reviewNoteOpen, [key]: !reviewNoteOpen[key] };
	}

	// ---------------------------------------------------------------------------
	// Edit-mode single-image upload
	// ---------------------------------------------------------------------------

	const MAX_LONG_EDGE = 2048;
	const TARGET_QUALITY = 0.85;

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

	async function saveBatchChunked(): Promise<string[]> {
		const payload = buildRowsJsonPayload(rows);
		if (payload.length === 0) {
			throw new Error('No included references to save.');
		}
		const chunks = chunkArray(payload, BATCH_SAVE_CHUNK_SIZE);
		const allRefIds: string[] = [];
		const total = payload.length;
		let saved = 0;
		for (const chunk of chunks) {
			saved += chunk.length;
			saveProgress = `Saving ${saved}/${total}…`;
			const fd = new FormData();
			fd.set('source_kind', sourceKind);
			fd.set('book_id', sourceBookId);
			fd.set('essay_id', sourceEssayId);
			if (source_image_url.trim() !== '') fd.set('source_image_url', source_image_url);
			fd.set('rows_json', JSON.stringify(chunk));
			const res = await fetch(action, { method: 'POST', body: fd });
			const result = deserialize(await res.text());
			if (result.type === 'failure') {
				const msg = (result.data as { message?: string } | undefined)?.message;
				throw new Error(msg ?? 'Save failed.');
			}
			if (result.type === 'error') {
				throw new Error(result.error?.message ?? 'Save failed.');
			}
			if (result.type === 'success') {
				const r = result.data as { refIds?: string[] };
				if (Array.isArray(r.refIds)) allRefIds.push(...r.refIds);
			}
		}
		return allRefIds;
	}

	const editRow = $derived(rows[0] ?? blankDraftRow());

	const submitEnhance: SubmitFunction = ({ cancel }) => {
		if (!isEdit) {
			cancel();
			pending = true;
			saveProgress = '';
			batchUploadNotice = null;
			return async () => {
				try {
					const refIds = await saveBatchChunked();
					if (lockedBookId) clearScriptureBatchDraft(lockedBookId);
					if (browser) {
						rows = [blankDraftRow()];
						source_image_url = '';
						revokeAllPagePreviewBlobs(pages);
						pages = [];
						pageExtractLabels = {};
						if (preview_url && preview_url.startsWith('blob:'))
							URL.revokeObjectURL(preview_url);
						preview_url = null;
					}
					onSavedBatch?.(refIds);
				} catch (e) {
					batchUploadNotice = e instanceof Error ? e.message : 'Save failed.';
				} finally {
					pending = false;
					saveProgress = '';
				}
			};
		}
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				const r = (result.data ?? {}) as { kind?: string; refId?: string };
				if (isEdit && r.refId) onSaved?.(r.refId);
			}
		};
	};

	$effect(() => {
		if (!browser || isEdit || !lockedBookId || draftBannerSuppressed) return;
		const draft = loadScriptureBatchDraft(lockedBookId);
		if (draft) draftResumeOffer = draft;
	});

	$effect(() => {
		if (isEdit) return;
		void rows;
		void pages;
		scheduleDraftSave();
	});

	$effect(() => {
		onBatchDirtyChange?.(hasUnsavedBatchDraft);
	});

	$effect(() => {
		if (!browser) return;
		const handler = (e: BeforeUnloadEvent) => {
			if (!ocrPipelineBusy && !pending && !hasUnsavedBatchDraft) return;
			e.preventDefault();
		};
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	});

	$effect(() => {
		if (!rowListEl || !useRowWindow) return;
		rowListViewportHeight = rowListEl.clientHeight;
	});
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
	{/if}

	{#if !isEdit && draftResumeOffer}
		<div
			class="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
			role="status"
		>
			<p class="text-amber-950 dark:text-amber-100">
				Unsaved batch draft ({draftResumeOffer.rows.length} references) from
				{new Date(draftResumeOffer.savedAt).toLocaleString()}.
			</p>
			<div class="flex flex-wrap gap-2">
				<Button type="button" size="sm" onclick={resumeDraft}>Resume draft</Button>
				<Button type="button" variant="outline" size="sm" onclick={discardDraftOffer}>
					Discard
				</Button>
			</div>
		</div>
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
		{#key seedKey}
			<ScriptureOcrQueue
				{userId}
				{lockedBookId}
				{sourceBookId}
				bind:pages
				bind:rows
				bind:pageExtractLabels
				bind:batchUploadNotice
				bind:extractMessage
				bind:extractInfo
				bind:ocrPipelineBusy
				onDraftClear={() => lockedBookId && clearScriptureBatchDraft(lockedBookId)}
			/>
		{/key}
	{:else}
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

		<div
			bind:this={rowListEl}
			class={cn(
				'flex flex-col gap-2',
				useRowWindow && 'max-h-[min(60vh,32rem)] overflow-y-auto overscroll-contain'
			)}
			onscroll={handleRowListScroll}
		>
			{#if useRowWindow && rowWindow.topSpacer > 0}
				<div aria-hidden="true" style:height="{rowWindow.topSpacer}px"></div>
			{/if}
			{#each visibleRows as row, localIdx (row.key)}
				{@const idx = useRowWindow ? rowWindow.start + localIdx : localIdx}
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
				<ScriptureRowEditor
					bind:row={rows[idx]!}
					index={idx}
					{isEdit}
					{bibleBookItems}
					{reviewNoteOpen}
					pulsed={!!pulseRowKeys[row.key]}
					onOpenBiblePicker={() => openBiblePicker(row.key)}
					onSetBibleBook={(v) => setRowBibleBook(row.key, v)}
					onDuplicate={() => duplicateRow(idx)}
					onRemove={() => removeRow(idx)}
					onToggleExpanded={() => toggleRowExpanded(row.key)}
					onSetIncluded={(included) => setRowIncluded(row.key, included)}
					onToggleReviewNote={() => toggleReviewNote(row.key)}
					onStripKeydown={(e) => handleStripKeydown(e, row.key)}
				/>
			{/each}
			{#if useRowWindow && rowWindow.bottomSpacer > 0}
				<div aria-hidden="true" style:height="{rowWindow.bottomSpacer}px"></div>
			{/if}
		</div>

		{#if !isEdit}
			<Button type="button" variant="outline" size="sm" onclick={addRow} class="self-start">
				<Plus class="size-4" /> Add another reference
			</Button>
		{/if}
	</div>

	<div
		class="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur max-md:shadow-[0_-4px_12px_-4px_rgb(0_0_0/0.06)] max-md:dark:shadow-[0_-4px_12px_-4px_rgb(0_0_0/0.25)] sm:-mx-6 sm:px-6"
	>
		{#if ocrProgressFooterLabel || saveProgress}
			<p class="text-center text-xs text-muted-foreground" role="status">
				{saveProgress || ocrProgressFooterLabel}
			</p>
		{/if}
		<div class="flex flex-wrap items-center justify-end gap-2">
			{#if onCancel}
				<Button
					type="button"
					variant="outline"
					class="min-h-11 gap-1.5"
					hotkey="Escape"
					label="Cancel"
					onclick={() => onCancel?.()}
					disabled={pending}
				/>
			{/if}
			<Button
				type="submit"
				class="min-h-11 gap-1.5"
				hotkey="s"
				disabled={pending ||
					uploading ||
					ocrPipelineBusy ||
					!parent ||
					!hasAnyValidRow}
				label={pending
					? saveProgress || 'Saving…'
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
	</div>
</form>

<ScriptureBiblePickerSheet
	bind:open={biblePickerOpen}
	title={biblePickerRowKey &&
	rows.some((r) => r.key === biblePickerRowKey && continuationNeedsBook(r))
		? 'Choose Bible book (continues from previous page)'
		: 'Choose Bible book'}
	bind:bibleFilter
	suggestions={biblePickerSuggestions}
	filteredNames={filteredBibleNames}
	onPick={pickBibleForRow}
/>

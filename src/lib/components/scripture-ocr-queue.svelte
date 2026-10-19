<script lang="ts">
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { cn } from '$lib/utils.js';
	import Copy from '@lucide/svelte/icons/copy';
	import Mail from '@lucide/svelte/icons/mail';
	import X from '@lucide/svelte/icons/x';
	import FileText from '@lucide/svelte/icons/file-text';
	import { createClient } from '$lib/supabase/client';
	import { SCRIPTURE_IMAGES_BUCKET, scriptureImagePath } from '$lib/library/storage';
	import type { OcrScriptureCandidate } from '$lib/library/ocr-scripture-refs';
	import {
		formatOcrPipelineError,
		invokeOcrScriptureRefs
	} from '$lib/library/ocr-invoke-client';
	import { runWithConcurrency } from '$lib/library/run-with-concurrency';
	import { collapseRowsAfterMerge } from '$lib/library/scripture-batch-upload';
	import {
		MAX_BATCH_IMAGES,
		type QueuedOcrFile,
		type ScriptureDraftRow,
		type ScripturePageJob
	} from '$lib/library/scripture-draft-row';
	import {
		finalizeOcrMerge,
		pdfOcrWarningText,
		removeCandidatesForPdfPages,
		stampSourcePageIndex
	} from '$lib/library/scripture-ocr-merge';
	import { mergeIndexChecker } from '$lib/library/scripture-ocr-consensus';
	import { flagIndexCandidates } from '$lib/library/scripture-index-validate';
	import { applyIndexQualifierFields } from '$lib/library/scripture-index-qualifiers';

	let {
		userId,
		lockedBookId,
		sourceBookId,
		pages = $bindable([]),
		rows = $bindable([]),
		pageExtractLabels = $bindable({} as Record<string, string | undefined>),
		batchUploadNotice = $bindable(null as string | null),
		extractMessage = $bindable(null as string | null),
		extractInfo = $bindable(null as string | null),
		ocrPipelineBusy = $bindable(false),
		indexMode = $bindable(false),
		onDraftClear
	}: {
		userId: string;
		lockedBookId: string | null;
		sourceBookId: string;
		pages?: ScripturePageJob[];
		rows?: ScriptureDraftRow[];
		pageExtractLabels?: Record<string, string | undefined>;
		batchUploadNotice?: string | null;
		extractMessage?: string | null;
		extractInfo?: string | null;
		ocrPipelineBusy?: boolean;
		/** Scripture-index prompt + volume tokens ([252]). */
		indexMode?: boolean;
		onDraftClear?: () => void;
	} = $props();

	let ocrQueue = $state<QueuedOcrFile[]>([]);
	let wakeLock: WakeLockSentinel | null = null;
	/** Page job ids the owner has side-by-side verified (clears needs_review on merge). */
	let verifiedPageIds = $state<Set<string>>(new Set());

	const pipelineBusy = $derived(
		pages.some((p) => p.status === 'uploading' || p.status === 'extracting')
	);

	$effect(() => {
		ocrPipelineBusy = pipelineBusy;
	});

	// ---------------------------------------------------------------------------
	// Image upload + multi-page OCR (batch create)
	// ---------------------------------------------------------------------------

	const MAX_LONG_EDGE = 2048;
	const INDEX_LONG_EDGE = 3000;
	const TARGET_QUALITY = 0.85;

	function revokeAllPagePreviewBlobs(jobs: ScripturePageJob[]) {
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

	async function copyJobError(job: ScripturePageJob) {
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

	function ocrErrorMailtoHref(job: ScripturePageJob): string {
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
		const longEdge = indexMode ? INDEX_LONG_EDGE : MAX_LONG_EDGE;
		try {
			const bitmap = await createImageBitmap(file);
			const ratio = Math.min(longEdge / bitmap.width, longEdge / bitmap.height, 1);
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
			bitmap.close();
			return blob ?? file;
		} catch {
			return file;
		}
	}

	/** Index mode: column crops, Sonnet 4.6 writer, Sonnet 5.5 pointer check, structural flags. */
	async function ocrIndexJpeg(
		supa: ReturnType<typeof createClient>,
		jpegBlob: Blob,
		bookIdForPath: string
	): Promise<OcrScriptureCandidate[]> {
		const { splitImageIntoColumns } = await import('$lib/library/image-column-split');
		let crops: Blob[];
		try {
			crops = await splitImageIntoColumns(jpegBlob);
			if (crops.length === 0) crops = [jpegBlob];
		} catch {
			crops = [jpegBlob];
		}

		async function onePass(blob: Blob, pass: 1 | 2): Promise<OcrScriptureCandidate[] | null> {
			const path = scriptureImagePath({ userId, bookId: bookIdForPath, ext: 'jpg' });
			const { error } = await supa.storage
				.from(SCRIPTURE_IMAGES_BUCKET)
				.upload(path, blob, { contentType: 'image/jpeg', upsert: false });
			if (error) return null;
			const result = await invokeOcrScriptureRefs(supa, {
				object_path: path,
				mime_type: 'image/jpeg',
				book_id: bookIdForPath,
				index_mode: true,
				index_pass: pass
			});
			return result.ok ? result.data.candidates : null;
		}

		const prepare = (rows: OcrScriptureCandidate[]): OcrScriptureCandidate[] =>
			rows.map((c) => {
				const q = applyIndexQualifierFields(c.page_start, c.review_note);
				return {
					...c,
					page_start: q.pageStart || null,
					review_note: q.reviewNote || null
				};
			});

		const merged: OcrScriptureCandidate[] = [];
		for (const crop of crops) {
			const [passA, passB] = await Promise.all([onePass(crop, 1), onePass(crop, 2)]);
			if (passA == null && passB == null) continue;
			if (passA == null) {
				merged.push(
					...prepare(passB ?? []).map((c) => ({
						...c,
						confidence_score: Math.min(c.confidence_score, 0.75),
						consensus_flag: 'checker_only' as const
					}))
				);
			} else if (passB == null) {
				merged.push(
					...prepare(passA).map((c) => ({
						...c,
						confidence_score: Math.min(c.confidence_score, 0.75),
						consensus_flag: 'checker_mismatch' as const
					}))
				);
			} else merged.push(...mergeIndexChecker(prepare(passA), prepare(passB)));
		}
		return flagIndexCandidates(merged);
	}

	function tryFinalizeBatchMerge() {
		const outcome = finalizeOcrMerge(pages);
		if (outcome.rows.length > 0) {
			rows = collapseRowsAfterMerge(outcome.rows);
			extractInfo = outcome.extractInfo;
			extractMessage = outcome.extractMessage;
		} else if (
			pages.length > 0 &&
			pages.every((p) => p.status === 'done' || p.status === 'error')
		) {
			extractInfo = outcome.extractInfo;
			extractMessage = outcome.extractMessage;
		}
	}

	async function ocrPdfPageIndices(
		jobId: string,
		file: File,
		bookIdForPath: string,
		pageIndices: number[],
		pageTotal: number,
		existingCandidates: OcrScriptureCandidate[]
	): Promise<{ candidates: OcrScriptureCandidate[]; failedPages: number[] }> {
		const supa = createClient();
		const merged = [...existingCandidates];
		const failedPages: number[] = [];

		const { renderPdfPageToJpegBlob } = await import('$lib/library/pdf-page-render');

		for (const i of pageIndices) {
			patchPage(jobId, {
				status: 'extracting',
				extractLabel: pageTotal > 1 ? `Page ${i + 1}/${pageTotal}` : undefined
			});
			try {
				const jpegBlob = await renderPdfPageToJpegBlob(
					file,
					i,
					indexMode ? INDEX_LONG_EDGE : MAX_LONG_EDGE
				);
				if (indexMode) {
					const candidates = await ocrIndexJpeg(supa, jpegBlob, bookIdForPath);
					if (candidates.length === 0) {
						failedPages.push(i);
						continue;
					}
					merged.push(...stampSourcePageIndex(candidates, i));
					continue;
				}
				const jpgPath = scriptureImagePath({ userId, bookId: bookIdForPath, ext: 'jpg' });
				const { error: jpgErr } = await supa.storage
					.from(SCRIPTURE_IMAGES_BUCKET)
					.upload(jpgPath, jpegBlob, { contentType: 'image/jpeg', upsert: false });
				if (jpgErr) {
					failedPages.push(i);
					continue;
				}
				const pageResult = await invokeOcrScriptureRefs(supa, {
					object_path: jpgPath,
					mime_type: 'image/jpeg',
					book_id: bookIdForPath,
					index_mode: indexMode || undefined
				});
				if (!pageResult.ok) {
					failedPages.push(i);
					continue;
				}
				merged.push(...stampSourcePageIndex(pageResult.data.candidates, i));
			} catch {
				failedPages.push(i);
			}
		}

		return { candidates: merged, failedPages };
	}

	async function retryFailedPdfPages(job: ScripturePageJob) {
		if (!job.sourceFile || !job.failedPdfPages?.length || !job.sourcePath) return;
		const bookIdForPath = lockedBookId ?? sourceBookId;
		if (!bookIdForPath) return;

		const { getPdfPageCountFromFile } = await import('$lib/library/pdf-page-render');
		const pageTotal = await getPdfPageCountFromFile(job.sourceFile);
		const indices = [...job.failedPdfPages];
		patchPage(job.id, {
			status: 'extracting',
			error: undefined,
			pdfOcrWarning: undefined,
			extractLabel: undefined
		});

		const kept = removeCandidatesForPdfPages(job.candidates ?? [], indices);
		const { candidates, failedPages } = await ocrPdfPageIndices(
			job.id,
			job.sourceFile,
			bookIdForPath,
			indices,
			pageTotal,
			kept
		);

		if (candidates.length === 0) {
			patchPage(job.id, {
				status: 'error',
				error: `OCR failed on all pages (${indices.map((i) => i + 1).join(', ')}).`,
				candidates: undefined,
				failedPdfPages: failedPages.length > 0 ? failedPages : indices,
				extractLabel: undefined
			});
		} else {
			patchPage(job.id, {
				status: 'done',
				candidates,
				failedPdfPages: failedPages.length > 0 ? failedPages : undefined,
				pdfOcrWarning:
					failedPages.length > 0 ? pdfOcrWarningText(failedPages, pageTotal) : undefined,
				extractLabel: undefined
			});
		}
		tryFinalizeBatchMerge();
	}

	function setPageExtractLabel(id: string, label: string | undefined) {
		if (pageExtractLabels[id] === label) return;
		pageExtractLabels = { ...pageExtractLabels, [id]: label };
	}

	function patchPage(id: string, patch: Partial<ScripturePageJob>) {
		const { extractLabel, ...pagePatch } = patch;
		if ('extractLabel' in patch) {
			setPageExtractLabel(id, extractLabel);
		}
		if (Object.keys(pagePatch).length > 0) {
			pages = pages.map((p) => (p.id === id ? { ...p, ...pagePatch } : p));
		}
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
		patchPage(jobId, { isPdf, sourceFile: isPdf ? file : undefined });

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
				book_id: bookIdForPath,
				index_mode: indexMode || undefined
			};

			if (isPdf) {
				let pageTotal: number;
				try {
					const { getPdfPageCountFromFile } = await import('$lib/library/pdf-page-render');
					pageTotal = await getPdfPageCountFromFile(file);
				} catch (e) {
					patchPage(jobId, {
						status: 'error',
						error: e instanceof Error ? e.message : 'Could not read PDF page count.',
						sourcePath: objectPath,
						previewUrl
					});
					tryFinalizeBatchMerge();
					return;
				}
				const pageIndices = Array.from({ length: pageTotal }, (_, i) => i);
				const { candidates, failedPages } = await ocrPdfPageIndices(
					jobId,
					file,
					bookIdForPath,
					pageIndices,
					pageTotal,
					[]
				);

				if (candidates.length === 0) {
					patchPage(jobId, {
						status: 'error',
						error:
							failedPages.length > 0
								? `OCR failed on all pages (${failedPages.map((i) => i + 1).join(', ')}/${pageTotal}).`
								: 'No references detected in PDF.',
						sourcePath: objectPath,
						previewUrl,
						failedPdfPages: failedPages.length > 0 ? failedPages : undefined,
						extractLabel: undefined
					});
				} else {
					patchPage(jobId, {
						status: 'done',
						candidates,
						sourcePath: objectPath,
						previewUrl,
						failedPdfPages: failedPages.length > 0 ? failedPages : undefined,
						pdfOcrWarning:
							failedPages.length > 0 ? pdfOcrWarningText(failedPages, pageTotal) : undefined,
						extractLabel: undefined
					});
				}
			} else if (indexMode) {
				const candidates = await ocrIndexJpeg(supa, await downscaleImage(file), bookIdForPath);
				if (candidates.length === 0) {
					patchPage(jobId, {
						status: 'error',
						error: 'No references detected (index mode).',
						sourcePath: objectPath,
						previewUrl
					});
					tryFinalizeBatchMerge();
					return;
				}
				patchPage(jobId, {
					status: 'done',
					candidates,
					sourcePath: objectPath,
					previewUrl
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

	async function acquireWakeLock() {
		if (!browser || !('wakeLock' in navigator)) return;
		try {
			wakeLock = await navigator.wakeLock.request('screen');
		} catch {
			/* unsupported or denied */
		}
	}

	function releaseWakeLock() {
		void wakeLock?.release();
		wakeLock = null;
	}

	async function startBatchFromFiles(fileArr: File[]) {
		if (fileArr.length === 0) return;

		extractMessage = null;
		extractInfo = null;
		batchUploadNotice = null;

		const sorted = [...fileArr].sort((a, b) => {
			const t = a.lastModified - b.lastModified;
			if (t !== 0) return t;
			return a.name.localeCompare(b.name);
		});

		revokeAllPagePreviewBlobs(pages);

		const newJobs: ScripturePageJob[] = sorted.map((f, i) => ({
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
		pageExtractLabels = {};
		onDraftClear?.();

		await acquireWakeLock();
		try {
			await runWithConcurrency(newJobs, 2, async (job, i) => {
				await runPagePipeline(job.id, sorted[i]!);
			});
		} finally {
			releaseWakeLock();
		}
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
		if (ocrQueue.length === 0 || pipelineBusy) return;
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
		pageExtractLabels = {};
		clearOcrQueue();
		batchUploadNotice = null;
		extractMessage = null;
		extractInfo = null;
		onDraftClear?.();
	}

	$effect(() => {
		return () => {
			revokeAllPagePreviewBlobs(pages);
			clearOcrQueue();
		};
	});
</script>

<div class="space-y-2">
	<Label for="sr-img-multi"
		>Source images / PDF <span class="text-xs text-muted-foreground">(optional, OCR — up to 10)</span></Label
	>
	<label class="flex items-center gap-2 text-sm text-muted-foreground">
		<input type="checkbox" bind:checked={indexMode} class="size-4 rounded border-input" />
		Scripture index mode (dense index — volume:page or section locators)
	</label>
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
			disabled={ocrQueue.length === 0 || pipelineBusy}
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
						job.error || job.pdfOcrWarning || job.failedPdfPages?.length
							? 'min-w-[min(100%,20rem)] max-w-full sm:max-w-md'
							: 'w-[4.5rem]'
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
						{#if job.status === 'extracting' && (pageExtractLabels[job.id] ?? job.extractLabel)}
							{pageExtractLabels[job.id] ?? job.extractLabel}
						{:else}
							{job.status}
						{/if}
					</span>
					{#if job.status === 'done'}
						<label class="flex items-center gap-1 text-[10px] text-muted-foreground">
							<input
								type="checkbox"
								checked={verifiedPageIds.has(job.id)}
								onchange={() => {
									const marking = !verifiedPageIds.has(job.id);
									const next = new Set(verifiedPageIds);
									if (marking) next.add(job.id);
									else next.delete(job.id);
									verifiedPageIds = next;
									if (marking) {
										rows = rows.map((r) =>
											r.pageJobId === job.id
												? { ...r, needs_review: false, review_note: '' }
												: r
										);
									}
								}}
								class="size-3 rounded border-input"
							/>
							Verified
						</label>
					{/if}
					{#if job.pdfOcrWarning}
						<p
							class="max-w-full whitespace-pre-wrap break-words rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] leading-snug text-amber-900 dark:text-amber-200"
							role="status"
						>
							{job.pdfOcrWarning}
						</p>
					{/if}
					{#if job.failedPdfPages?.length && job.sourceFile}
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="w-full"
							disabled={job.status === 'extracting'}
							onclick={() => void retryFailedPdfPages(job)}
						>
							Retry failed pages
						</Button>
					{/if}
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

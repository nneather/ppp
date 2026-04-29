<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import Plus from '@lucide/svelte/icons/plus';
	import Copy from '@lucide/svelte/icons/copy';
	import X from '@lucide/svelte/icons/x';
	import SourcePicker from '$lib/components/source-picker.svelte';
	import type { PolymorphicParent } from '$lib/library/polymorphic';
	import type { BookListRow, ScriptureRefRow } from '$lib/types/library';
	import { createClient } from '$lib/supabase/client';
	import {
		SCRIPTURE_IMAGES_BUCKET,
		scriptureImagePath
	} from '$lib/library/storage';

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
	 *   Add row / duplicate row / remove row controls visible. Optional shared
	 *   page-image upload sits at the top of the batch (one image, many refs).
	 *   Posts to `?/createScriptureRefsBatch`. Empty draft rows (no bible_book
	 *   AND no page_start) are silently skipped server-side.
	 *
	 * Image upload: file input → client-side downscale (~2048px JPEG) →
	 * supabase.storage.upload to `library-scripture-images/${userId}/${bookId}/…`.
	 * The resulting object path is stored in a hidden `source_image_url` field
	 * (the path, not a public URL — loaders generate signed URLs on read).
	 *
	 * Page numbers are TEXT — schema handles `IV.317`, `xiv`. We intentionally
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
	};

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
			review_note: ''
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
			review_note: r.review_note ?? ''
		};
	}

	let parent = $state<PolymorphicParent | null>(null);
	let rows = $state<DraftRow[]>([blankRow()]);
	let source_image_url = $state(''); // bucket object path
	let preview_url = $state<string | null>(null);
	let pending = $state(false);
	let uploading = $state(false);
	let uploadError = $state<string | null>(null);

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

	// Save bar: enabled when at least one row has both bible_book + page_start.
	const hasAnyValidRow = $derived(
		rows.some((r) => r.bible_book.trim().length > 0 && r.page_start.trim().length > 0)
	);

	function addRow() {
		rows = [...rows, blankRow()];
	}

	function duplicateRow(idx: number) {
		const src = rows[idx];
		const copy: DraftRow = { ...src, key: freshKey() };
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

	// ---------------------------------------------------------------------------
	// Image upload (shared across the batch in create mode; single image in edit)
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
		preview_url = null;
	}

	// ---------------------------------------------------------------------------
	// Submit payloads
	// ---------------------------------------------------------------------------

	const rowsJson = $derived(
		JSON.stringify(
			rows.map((r) => ({
				bible_book: r.bible_book,
				chapter_start: r.chapter_start,
				verse_start: r.verse_start,
				chapter_end: r.chapter_end,
				verse_end: r.verse_end,
				page_start: r.page_start,
				page_end: r.page_end,
				needs_review: r.needs_review,
				review_note: r.review_note
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
						if (preview_url && preview_url.startsWith('blob:'))
							URL.revokeObjectURL(preview_url);
						preview_url = null;
					}
					onSavedBatch?.(r.refIds);
				}
			}
		};
	};
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
				Pages are free text — `IV.317`, `xiv`, etc. all welcome.
			{:else}
				Add as many references as you like — one save commits the whole batch. Pages are free
				text. The optional image is shared across the batch (one page, many refs).
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

	<!-- Shared image -->
	<div class="space-y-2">
		<Label for="sr-img">
			Source image <span class="text-xs text-muted-foreground">(optional, shared across batch)</span>
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

	<!-- Rows -->
	<div class="flex flex-col gap-3">
		{#each rows as row, idx (row.key)}
			<div
				class="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3"
				aria-label={`Reference row ${idx + 1}`}
			>
				<div class="flex items-center justify-between">
					<span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
						Row {idx + 1}
					</span>
					{#if !isEdit}
						<div class="flex gap-1">
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
					{/if}
				</div>

				<div class="grid gap-3 sm:grid-cols-[1fr_2fr]">
					<div class="space-y-2">
						<Label for={`sr-bible-${row.key}`}>
							Bible book <span class="text-destructive">*</span>
						</Label>
						<Select.Root type="single" bind:value={row.bible_book} items={bibleBookItems}>
							<Select.Trigger
								id={`sr-bible-${row.key}`}
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

					<div class="grid grid-cols-4 gap-2">
						<div class="space-y-1">
							<Label for={`sr-cs-${row.key}`} class="text-xs">Chapter</Label>
							<Input
								id={`sr-cs-${row.key}`}
								type="number"
								inputmode="numeric"
								min="0"
								max="199"
								bind:value={row.chapter_start}
								class="h-11 text-base tabular-nums"
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
								class="h-11 text-base tabular-nums"
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
								class="h-11 text-base tabular-nums"
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
								class="h-11 text-base tabular-nums"
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
							class="h-11 text-base"
						/>
					</div>
					<div class="space-y-1">
						<Label for={`sr-pe-${row.key}`} class="text-xs">Page end</Label>
						<Input
							id={`sr-pe-${row.key}`}
							bind:value={row.page_end}
							placeholder="(blank for single page)"
							class="h-11 text-base"
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
		{/each}

		{#if !isEdit}
			<Button type="button" variant="outline" size="sm" onclick={addRow} class="self-start">
				<Plus class="size-4" /> Add another reference
			</Button>
		{/if}
	</div>

	<div class="flex items-center justify-end gap-2">
		{#if onCancel}
			<Button type="button" variant="ghost" onclick={() => onCancel?.()} disabled={pending}>
				Cancel
			</Button>
		{/if}
		<Button
			type="submit"
			disabled={pending || uploading || !parent || !hasAnyValidRow}
		>
			{#if pending}
				Saving…
			{:else if isEdit}
				Save changes
			{:else}
				Save {rows.filter((r) => r.bible_book && r.page_start).length || ''}
				{rows.filter((r) => r.bible_book && r.page_start).length === 1
					? 'reference'
					: 'references'}
			{/if}
		</Button>
	</div>
</form>

<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import Plus from '@lucide/svelte/icons/plus';
	import Copy from '@lucide/svelte/icons/copy';
	import X from '@lucide/svelte/icons/x';
	import SourcePicker from '$lib/components/source-picker.svelte';
	import CanonicalizingCombobox from '$lib/components/canonicalizing-combobox.svelte';
	import type { ComboboxItem } from '$lib/components/canonicalizing-combobox.svelte';
	import type { PolymorphicParent } from '$lib/library/polymorphic';
	import type { BookListRow, BookTopicRow, TopicCount } from '$lib/types/library';
	import { createClient } from '$lib/supabase/client';
	import {
		SCRIPTURE_IMAGES_BUCKET,
		scriptureImagePath
	} from '$lib/library/storage';
	import { bestSimilar } from '$lib/library/fuzzy';

	/**
	 * <BookTopicForm>
	 *
	 * Batch-capable clone of <ScriptureReferenceForm>. Lands the third
	 * junction entry surface per Session 5 (topics), wrapping:
	 *   - <SourcePicker> for the parent (locked to the host book).
	 *   - <CanonicalizingCombobox> per row for the topic field, with a
	 *     client-side trigram-Jaccard typo warning that only fires when the
	 *     fuzzy-matched existing topic has fewer than TYPO_WARN_MAX_USES
	 *     uses (below-threshold fragmentation risk).
	 *
	 * Edit mode renders a single-row form posting the legacy contract to
	 * `?/updateBookTopic`. Batch-create mode renders N draft rows + Add /
	 * Duplicate / Remove + shared page-image upload, posting `rows_json` to
	 * `?/createBookTopicsBatch`.
	 *
	 * Shares the scripture-images bucket (reused per Session 2 convention —
	 * one bucket per module per entity; topics fit the "page image" idiom
	 * exactly the same as scripture references).
	 */

	type FormMessage = { message?: string } | null | undefined;

	const TYPO_WARN_THRESHOLD = 0.7;
	const TYPO_WARN_MAX_USES = 3;

	let {
		books,
		topicCounts,
		lockedBookId = null,
		userId,
		actionPath = '',
		existingTopic = null,
		formMessage = null,
		onSaved,
		onSavedBatch,
		onCancel
	}: {
		books: BookListRow[];
		topicCounts: TopicCount[];
		lockedBookId?: string | null;
		userId: string;
		actionPath?: string;
		existingTopic?: BookTopicRow | null;
		formMessage?: FormMessage;
		onSaved?: (topicId: string) => void;
		onSavedBatch?: (topicIds: string[]) => void;
		onCancel?: () => void;
	} = $props();

	const isEdit = $derived(!!existingTopic);

	type DraftRow = {
		key: string;
		topic: string;
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
			topic: '',
			page_start: '',
			page_end: '',
			needs_review: false,
			review_note: ''
		};
	}

	function rowFromExisting(r: BookTopicRow): DraftRow {
		return {
			key: r.id,
			topic: r.topic,
			page_start: r.page_start ?? '',
			page_end: r.page_end ?? '',
			needs_review: r.needs_review,
			review_note: r.review_note ?? ''
		};
	}

	let parent = $state<PolymorphicParent | null>(null);
	let rows = $state<DraftRow[]>([blankRow()]);
	let source_image_url = $state('');
	let preview_url = $state<string | null>(null);
	let pending = $state(false);
	let uploading = $state(false);
	let uploadError = $state<string | null>(null);

	// The topic combobox binds to the lowercased topic string itself
	// (topics have no stable UUID; the column value IS the identity).
	// We mirror each row's `topic` into a combobox-compatible id.
	function topicToId(t: string): string {
		return t.trim().toLowerCase();
	}

	// Synthesize CanonicalizingCombobox items from the topic-count aggregate.
	const topicItems = $derived.by<ComboboxItem[]>(() => {
		return topicCounts.map((tc) => ({
			id: tc.topic,
			canonical_name: tc.topic,
			count: tc.count
		}));
	});

	// Fuzzy-warn closure: suggests an existing topic when (1) input is
	// similar-enough to an existing row (>= 0.7 trigram Jaccard) and (2)
	// that existing row has < 3 uses (below-threshold fragmentation risk).
	function fuzzyWarn(raw: string): { suggestion: string; count: number } | null {
		const trimmed = raw.trim().toLowerCase();
		if (!trimmed) return null;
		const haystack = topicItems.map((it) => ({
			label: it.canonical_name,
			count: it.count ?? 0
		}));
		const match = bestSimilar(trimmed, haystack, TYPO_WARN_THRESHOLD);
		if (!match) return null;
		if (match.item.count >= TYPO_WARN_MAX_USES) return null;
		// Don't warn if the "match" is the user's current input verbatim.
		if (match.item.label === trimmed) return null;
		return { suggestion: match.item.label, count: match.item.count };
	}

	let seededFor = $state<string | null>(null);
	$effect(() => {
		const key = existingTopic?.id ?? `__create__:${lockedBookId ?? ''}`;
		if (seededFor === key) return;
		seededFor = key;

		if (existingTopic) {
			parent = existingTopic.book_id
				? { kind: 'book', book_id: existingTopic.book_id }
				: existingTopic.essay_id
					? { kind: 'essay', essay_id: existingTopic.essay_id }
					: null;
			rows = [rowFromExisting(existingTopic)];
			source_image_url = existingTopic.source_image_url ?? '';
			preview_url = existingTopic.source_image_signed_url ?? null;
		} else {
			parent = lockedBookId ? { kind: 'book', book_id: lockedBookId } : null;
			rows = [blankRow()];
			source_image_url = '';
			preview_url = null;
		}
		uploadError = null;
	});

	const sourceKind = $derived<'book' | 'essay'>(parent?.kind ?? 'book');
	const sourceBookId = $derived(parent?.kind === 'book' ? parent.book_id : '');
	const sourceEssayId = $derived(parent?.kind === 'essay' ? parent.essay_id : '');

	const action = $derived(
		isEdit
			? `${actionPath}?/updateBookTopic`
			: `${actionPath}?/createBookTopicsBatch`
	);

	const hasAnyValidRow = $derived(
		rows.some((r) => r.topic.trim().length > 0 && r.page_start.trim().length > 0)
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
			rows = [blankRow()];
			return;
		}
		rows = rows.filter((_, i) => i !== idx);
	}

	// Bridge between the combobox's `value` (canonical topic string) and
	// the row's raw `topic` field. Setting the combobox to an existing
	// topic drops it in place; typing free-text leaves the combobox value
	// null but populates the row.topic via the inline input below.
	function setTopicFor(rowKey: string, val: string | null) {
		rows = rows.map((r) => (r.key === rowKey ? { ...r, topic: val ?? '' } : r));
	}

	// ---------------------------------------------------------------------------
	// Image upload (mirrors <ScriptureReferenceForm>)
	// ---------------------------------------------------------------------------

	const MAX_LONG_EDGE = 2048;
	const TARGET_QUALITY = 0.85;

	async function downscaleImage(file: File): Promise<Blob> {
		try {
			const bitmap = await createImageBitmap(file);
			const ratio = Math.min(
				MAX_LONG_EDGE / bitmap.width,
				MAX_LONG_EDGE / bitmap.height,
				1
			);
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

	const rowsJson = $derived(
		JSON.stringify(
			rows.map((r) => ({
				topic: r.topic,
				page_start: r.page_start,
				page_end: r.page_end,
				needs_review: r.needs_review,
				review_note: r.review_note
			}))
		)
	);

	const editRow = $derived(rows[0] ?? blankRow());

	const submitEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				const r = (result.data ?? {}) as {
					kind?: string;
					topicId?: string;
					topicIds?: string[];
				};
				if (isEdit && r.topicId) {
					onSaved?.(r.topicId);
				} else if (!isEdit && Array.isArray(r.topicIds)) {
					if (browser) {
						rows = [blankRow()];
						source_image_url = '';
						if (preview_url && preview_url.startsWith('blob:'))
							URL.revokeObjectURL(preview_url);
						preview_url = null;
					}
					onSavedBatch?.(r.topicIds);
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

	{#if isEdit && existingTopic}
		<input type="hidden" name="id" value={existingTopic.id} />
		<input type="hidden" name="topic" value={editRow.topic} />
		<input type="hidden" name="page_start" value={editRow.page_start} />
		<input type="hidden" name="page_end" value={editRow.page_end} />
		<input type="hidden" name="needs_review" value={editRow.needs_review ? 'true' : 'false'} />
		<input type="hidden" name="review_note" value={editRow.review_note} />
	{:else}
		<input type="hidden" name="rows_json" value={rowsJson} />
	{/if}

	<header>
		<h3 class="text-sm font-semibold tracking-tight">
			{isEdit ? 'Edit topic' : 'Add topics'}
		</h3>
		<p class="text-xs text-muted-foreground">
			{#if isEdit}
				Pages are free text — `IV.317`, `xiv`, etc. all welcome.
			{:else}
				Add as many topics as you like — one save commits the whole batch. Topics
				lowercase automatically.
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

	<div class="space-y-2">
		<Label for="bt-img">
			Source image <span class="text-xs text-muted-foreground">(optional, shared across batch)</span>
		</Label>
		{#if preview_url}
			<div class="flex flex-wrap items-start gap-3">
				<img
					src={preview_url}
					alt="Topic source page"
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
							id="bt-img"
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
					id="bt-img"
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

	<div class="flex flex-col gap-3">
		{#each rows as row, idx (row.key)}
			{@const rowTopicId = row.topic.trim().length > 0 ? topicToId(row.topic) : null}
			{@const existsInList = rowTopicId
				? topicItems.some((it) => it.id === rowTopicId)
				: false}
			<div
				class="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3"
				aria-label={`Topic row ${idx + 1}`}
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

				<div class="space-y-2">
					<Label>Topic <span class="text-destructive">*</span></Label>
					<CanonicalizingCombobox
						value={existsInList ? rowTopicId : null}
						items={topicItems}
						onCreate={(raw) => setTopicFor(row.key, raw.toLowerCase())}
						{fuzzyWarn}
						placeholder="e.g. christology, kenosis, imago dei"
						ariaLabel="Topic"
					/>
					{#if !existsInList && row.topic.trim().length > 0}
						<p class="text-xs text-muted-foreground">
							New topic: <span class="font-semibold text-foreground">{row.topic}</span>
						</p>
					{/if}
					<!-- Raw topic text bound below so free-typed values persist across combobox toggles. -->
					<Input
						type="text"
						bind:value={row.topic}
						placeholder="(or type a new topic — lowercased on save)"
						class="h-9 text-sm"
						aria-label="Topic text"
					/>
				</div>

				<div class="grid gap-3 sm:grid-cols-2">
					<div class="space-y-1">
						<Label class="text-xs">
							Page start <span class="text-destructive">*</span>
						</Label>
						<Input
							bind:value={row.page_start}
							placeholder="e.g. 317, IV.317, xiv"
							class="h-11 text-base"
						/>
					</div>
					<div class="space-y-1">
						<Label class="text-xs">Page end</Label>
						<Input
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
				<Plus class="size-4" /> Add another topic
			</Button>
		{/if}
	</div>

	<div class="flex items-center justify-end gap-2">
		{#if onCancel}
			<Button
				type="button"
				variant="ghost"
				onclick={() => onCancel?.()}
				disabled={pending}
				hotkey="Escape"
				label="Cancel"
			/>
		{/if}
		<Button
			type="submit"
			disabled={pending || uploading || !parent || !hasAnyValidRow}
			hotkey={isEdit ? 'u' : 's'}
			label={pending
				? 'Saving…'
				: isEdit
					? 'Update topic'
					: `Save ${rows.filter((r) => r.topic.trim() && r.page_start.trim()).length || ''} ${
							rows.filter((r) => r.topic.trim() && r.page_start.trim()).length === 1
								? 'topic'
								: 'topics'
						}`.trim()}
		/>
	</div>
</form>

<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
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
	 * Embedded sub-form for adding (or editing) a scripture_reference on a book
	 * or essay. Lives inline on `/library/books/[id]`.
	 *
	 * Edit mode: pass `existingRef`. The form pre-fills, posts to
	 * `?/updateScriptureRef`, and shows a Cancel button (hooked to `onCancel`).
	 *
	 * Image upload: file input → client-side downscale (~2048px JPEG) →
	 * supabase.storage.upload to `library-scripture-images/${userId}/${bookId}/…`.
	 * The resulting object path is stored in a hidden `source_image_url` field
	 * (the path, not a public URL — loaders generate signed URLs on read per
	 * the Storage convention in `.cursor/rules/library-module.mdc`).
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
		onCancel
	}: {
		books: BookListRow[];
		bibleBookNames: string[];
		lockedBookId?: string | null;
		userId: string;
		actionPath?: string;
		existingRef?: ScriptureRefRow | null;
		formMessage?: FormMessage;
		onSaved?: (refId: string) => void;
		onCancel?: () => void;
	} = $props();

	const isEdit = $derived(!!existingRef);

	let parent = $state<PolymorphicParent | null>(null);
	let bible_book = $state('');
	let chapter_start = $state('');
	let verse_start = $state('');
	let chapter_end = $state('');
	let verse_end = $state('');
	let page_start = $state('');
	let page_end = $state('');
	let needs_review = $state<boolean>(false);
	let review_note = $state('');
	let source_image_url = $state(''); // bucket object path (NOT a public URL)
	let preview_url = $state<string | null>(null); // signed URL OR local blob URL
	let pending = $state(false);
	let uploading = $state(false);
	let uploadError = $state<string | null>(null);

	// Seed from existingRef OR lockedBookId. Wrap in untrack-style guard via a
	// dependency-free seeded flag; the seed needs to re-run when existingRef
	// changes (e.g. user clicks Edit on a different ref) but must not re-fire
	// from internal field state changes.
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
			bible_book = existingRef.bible_book;
			chapter_start = existingRef.chapter_start?.toString() ?? '';
			verse_start = existingRef.verse_start?.toString() ?? '';
			chapter_end = existingRef.chapter_end?.toString() ?? '';
			verse_end = existingRef.verse_end?.toString() ?? '';
			page_start = existingRef.page_start ?? '';
			page_end = existingRef.page_end ?? '';
			needs_review = existingRef.needs_review;
			review_note = existingRef.review_note ?? '';
			source_image_url = existingRef.source_image_url ?? '';
			preview_url = existingRef.source_image_signed_url ?? null;
		} else {
			parent = lockedBookId ? { kind: 'book', book_id: lockedBookId } : null;
			bible_book = '';
			chapter_start = '';
			verse_start = '';
			chapter_end = '';
			verse_end = '';
			page_start = '';
			page_end = '';
			needs_review = false;
			review_note = '';
			source_image_url = '';
			preview_url = null;
		}
		uploadError = null;
	});

	const bibleBookItems = $derived([
		{ value: '', label: '— Pick a book —' },
		...bibleBookNames.map((n) => ({ value: n, label: n }))
	]);
	const bibleBookLabel = $derived(bible_book.length > 0 ? bible_book : '— Pick a book —');

	const sourceKind = $derived<'book' | 'essay'>(parent?.kind ?? 'book');
	const sourceBookId = $derived(parent?.kind === 'book' ? parent.book_id : '');
	const sourceEssayId = $derived(parent?.kind === 'essay' ? parent.essay_id : '');

	const action = $derived(
		isEdit ? `${actionPath}?/updateScriptureRef` : `${actionPath}?/createScriptureRef`
	);

	// -------------------------------------------------------------------------
	// Image upload
	// -------------------------------------------------------------------------

	const MAX_LONG_EDGE = 2048;
	const TARGET_QUALITY = 0.85;

	async function downscaleImage(file: File): Promise<Blob> {
		// HEIC and other browser-incompatible formats can throw on
		// createImageBitmap; fall back to uploading the original.
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
			// Prefer JPEG (downscale output) for everything except already-jpeg-ish
			// originals; the bucket allows jpeg/png/webp/heic so we just key off
			// the resulting blob's type.
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
			// Preview locally — the signed URL only materializes on next page load.
			if (preview_url && preview_url.startsWith('blob:')) URL.revokeObjectURL(preview_url);
			preview_url = URL.createObjectURL(blob);
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Upload failed.';
		} finally {
			uploading = false;
			input.value = ''; // allow re-picking the same file
		}
	}

	function removeImage() {
		if (preview_url && preview_url.startsWith('blob:')) URL.revokeObjectURL(preview_url);
		source_image_url = '';
		preview_url = null;
	}

	// -------------------------------------------------------------------------
	// Submit
	// -------------------------------------------------------------------------

	const submitEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				const r = (result.data ?? {}) as { kind?: string; refId?: string };
				if (r.refId) {
					// In create mode, clear the form for the next entry. In edit
					// mode, leave the fields populated — the parent will close the
					// inline editor via onSaved.
					if (browser && !isEdit) {
						bible_book = '';
						chapter_start = '';
						verse_start = '';
						chapter_end = '';
						verse_end = '';
						page_start = '';
						page_end = '';
						needs_review = false;
						review_note = '';
						source_image_url = '';
						if (preview_url && preview_url.startsWith('blob:')) URL.revokeObjectURL(preview_url);
						preview_url = null;
					}
					onSaved?.(r.refId);
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
	{#if isEdit && existingRef}
		<input type="hidden" name="id" value={existingRef.id} />
	{/if}
	<input type="hidden" name="source_kind" value={sourceKind} />
	<input type="hidden" name="book_id" value={sourceBookId} />
	<input type="hidden" name="essay_id" value={sourceEssayId} />
	<input type="hidden" name="needs_review" value={needs_review ? 'true' : 'false'} />
	<input type="hidden" name="source_image_url" value={source_image_url} />

	<header>
		<h3 class="text-sm font-semibold tracking-tight">
			{isEdit ? 'Edit scripture reference' : 'Add scripture reference'}
		</h3>
		<p class="text-xs text-muted-foreground">
			Pages are free text — `IV.317`, `xiv`, etc. all welcome. Snap or attach a page image
			(optional).
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
		<Label for="sr-bible">Bible book <span class="text-destructive">*</span></Label>
		<Select.Root type="single" bind:value={bible_book} items={bibleBookItems}>
			<Select.Trigger id="sr-bible" size="default" class="h-11 w-full justify-between px-3">
				<span data-slot="select-value" class="truncate text-left">{bibleBookLabel}</span>
			</Select.Trigger>
			<Select.Content class="max-h-72">
				{#each bibleBookItems as b (b.value)}
					<Select.Item value={b.value} label={b.label} class="min-h-10 py-2">
						{b.label}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
		<input type="hidden" name="bible_book" value={bible_book} />
	</div>

	<div class="grid gap-3 sm:grid-cols-4">
		<div class="space-y-2">
			<Label for="sr-cs">Chapter start</Label>
			<Input
				id="sr-cs"
				name="chapter_start"
				type="number"
				inputmode="numeric"
				min="0"
				max="199"
				bind:value={chapter_start}
				class="h-11 text-base tabular-nums"
			/>
		</div>
		<div class="space-y-2">
			<Label for="sr-vs">Verse start</Label>
			<Input
				id="sr-vs"
				name="verse_start"
				type="number"
				inputmode="numeric"
				min="0"
				max="999"
				bind:value={verse_start}
				class="h-11 text-base tabular-nums"
			/>
		</div>
		<div class="space-y-2">
			<Label for="sr-ce">Chapter end</Label>
			<Input
				id="sr-ce"
				name="chapter_end"
				type="number"
				inputmode="numeric"
				min="0"
				max="199"
				bind:value={chapter_end}
				class="h-11 text-base tabular-nums"
			/>
		</div>
		<div class="space-y-2">
			<Label for="sr-ve">Verse end</Label>
			<Input
				id="sr-ve"
				name="verse_end"
				type="number"
				inputmode="numeric"
				min="0"
				max="999"
				bind:value={verse_end}
				class="h-11 text-base tabular-nums"
			/>
		</div>
	</div>

	<div class="grid gap-3 sm:grid-cols-2">
		<div class="space-y-2">
			<Label for="sr-ps">Page start <span class="text-destructive">*</span></Label>
			<Input
				id="sr-ps"
				name="page_start"
				bind:value={page_start}
				placeholder="e.g. 317, IV.317, xiv"
				required
				class="h-11 text-base"
			/>
		</div>
		<div class="space-y-2">
			<Label for="sr-pe">Page end</Label>
			<Input
				id="sr-pe"
				name="page_end"
				bind:value={page_end}
				placeholder="(blank for single page)"
				class="h-11 text-base"
			/>
		</div>
	</div>

	<div class="space-y-2">
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" bind:checked={needs_review} class="size-4" />
			<span>Needs review</span>
		</label>
		{#if needs_review}
			<textarea
				name="review_note"
				bind:value={review_note}
				rows={2}
				class="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
				placeholder="Why does this need review?"
			></textarea>
		{/if}
	</div>

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

	<div class="flex justify-end gap-2">
		{#if isEdit && onCancel}
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
			disabled={pending || uploading || !parent || !bible_book || !page_start}
			hotkey="s"
			label={pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add reference'}
		/>
	</div>
</form>

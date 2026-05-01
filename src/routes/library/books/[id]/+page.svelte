<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Plus from '@lucide/svelte/icons/plus';
	import {
		AUTHOR_ROLE_LABELS,
		LANGUAGE_LABELS,
		READING_STATUSES,
		READING_STATUS_LABELS
	} from '$lib/types/library';
	import type { ReadingStatus, ScriptureRefRow, BookListRow } from '$lib/types/library';
	import ScriptureReferenceForm from '$lib/components/scripture-reference-form.svelte';
	import BookTopicForm from '$lib/components/book-topic-form.svelte';
	import BookBibleCoverageEditor from '$lib/components/book-bible-coverage-editor.svelte';
	import BookAncientCoverageEditor from '$lib/components/book-ancient-coverage-editor.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import type { BookTopicRow } from '$lib/types/library';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let deletePending = $state(false);
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
		};
	};

	function fmtYearChunk(): string {
		const parts: string[] = [];
		if (data.book.publisher_location) parts.push(data.book.publisher_location);
		if (data.book.publisher) parts.push(data.book.publisher);
		const head = parts.join(': ');
		const yearStr = data.book.year != null ? String(data.book.year) : '';
		return [head, yearStr].filter((s) => s.length > 0).join(', ');
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
			genre: data.book.genre,
			reading_status: data.book.reading_status,
			needs_review: data.book.needs_review,
			primary_category_name: data.book.primary_category_name,
			series_abbreviation: data.book.series_abbreviation,
			series_name: data.book.series_name,
			volume_number: data.book.volume_number,
			authors_label:
				data.book.authors
					.filter((a) => a.role === 'author')
					.map((a) => a.person_label)
					.join(', ') || null
		}
	]);

	// Optimistic local list — start from server state, mutate on add/edit/delete
	// for snappy feedback. After invalidateAll the canonical state takes over.
	// Keep `refs` in sync with `data.scriptureRefs` via $effect; the warning
	// "state_referenced_locally" is suppressed by initializing to [] then
	// hydrating in the effect (which tracks data.scriptureRefs as a dep).
	let refs = $state<ScriptureRefRow[]>([]);
	$effect(() => {
		refs = data.scriptureRefs;
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
		queueMicrotask(tryScroll);
	});

	let addOpen = $state(false);
	let editingId = $state<string | null>(null);
	let pendingDeleteId = $state<string | null>(null);
	let confirmDeleteOpen = $state(false);

	const formMessage = $derived.by(() => {
		const f = form as { kind?: string; message?: string; refId?: string } | null;
		if (!f) return null;
		if (
			f.kind === 'createScriptureRef' ||
			f.kind === 'createScriptureRefsBatch' ||
			f.kind === 'updateScriptureRef' ||
			f.kind === 'softDeleteScriptureRef'
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
	}

	function cancelEdit() {
		editingId = null;
	}

	async function onCreatedBatch(refIds: string[]) {
		addOpen = false;
		await invalidateAll();
	}

	async function onUpdated(refId: string) {
		editingId = null;
		await invalidateAll();
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
				await invalidateAll();
			} else {
				// Revert optimistic remove on failure by reloading.
				await invalidateAll();
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
		topics = data.bookTopics;
	});

	function startEditTopic(id: string) {
		editingTopicId = id;
		topicAddOpen = false;
	}
	function cancelEditTopic() {
		editingTopicId = null;
	}
	async function onTopicCreated() {
		topicAddOpen = false;
		await invalidateAll();
	}
	async function onTopicUpdated() {
		editingTopicId = null;
		await invalidateAll();
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
			await invalidateAll();
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
</script>

<svelte:head>
	<title>{data.book.title ?? '(untitled)'} — Library — ppp</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
	<a href="/library" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
		<ArrowLeft class="size-4" /> Library
	</a>

	<header class="mt-4 flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2 text-muted-foreground">
				<BookOpen class="size-5" />
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
			</div>
			<h1 class="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
				{#if data.book.title}
					{data.book.title}
				{:else}
					<span class="italic text-muted-foreground">(untitled book)</span>
				{/if}
				{#if data.book.volume_number}<span class="text-muted-foreground">, vol. {data.book.volume_number}</span>{/if}
			</h1>
			{#if data.book.subtitle}
				<p class="mt-1 text-base text-muted-foreground">{data.book.subtitle}</p>
			{/if}
			{#if data.book.authors.length > 0}
				<p class="mt-2 text-sm text-foreground">
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
		</div>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" href={`/library/books/${data.book.id}/edit`} hotkey="e">
				<Pencil class="size-4" /> <HotkeyLabel label="Edit" mnemonic="e" />
			</Button>
			<form method="POST" action="?/softDeleteBook" use:enhance={deleteEnhance} class="contents">
				<input type="hidden" name="id" value={data.book.id} />
				<Button type="submit" variant="destructive" disabled={deletePending} hotkey="d">
					<Trash2 class="size-4" />
					<HotkeyLabel label={deletePending ? 'Deleting…' : 'Delete'} mnemonic="d" />
				</Button>
			</form>
		</div>
	</header>

	{#if data.book.needs_review_note}
		<p class="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
			<strong class="font-semibold">Review note:</strong> {data.book.needs_review_note}
		</p>
	{/if}

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

			<dt class="font-medium text-muted-foreground">Primary category</dt>
			<dd>
				{#if data.book.primary_category_name}
					{data.book.primary_category_name}
				{:else}
					<span class="text-muted-foreground italic">(uncategorized)</span>
				{/if}
			</dd>

			{#if data.book.category_ids.length > (data.book.primary_category_id ? 1 : 0)}
				<dt class="font-medium text-muted-foreground">Other categories</dt>
				<dd>
					{data.categories
						.filter(
							(c) =>
								data.book.category_ids.includes(c.id) &&
								c.id !== data.book.primary_category_id
						)
						.map((c) => c.name)
						.join(', ') || '—'}
				</dd>
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

			{#if data.book.personal_notes}
				<div class="rounded-xl border border-border bg-card p-4 text-card-foreground">
					<div class="text-xs uppercase tracking-wide text-muted-foreground">Personal notes</div>
					<p class="mt-2 whitespace-pre-wrap text-sm">{data.book.personal_notes}</p>
				</div>
			{/if}
		</aside>
	</div>

	<!-- ------------------------------------------------------------------- -->
	<!-- Scripture references                                                  -->
	<!-- ------------------------------------------------------------------- -->
	<section class="mt-10" aria-labelledby="scripture-refs-heading">
		<div class="flex items-center justify-between gap-3">
			<h2
				id="scripture-refs-heading"
				class="text-lg font-semibold tracking-tight text-foreground"
			>
				Scripture references
				{#if refs.length > 0}
					<span class="ml-1 text-sm font-normal text-muted-foreground">({refs.length})</span>
				{/if}
			</h2>
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

		{#if refs.length === 0 && !addOpen}
			<p class="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
				No scripture references yet. Click <strong class="font-semibold text-foreground">Add</strong> to log a passage you found discussed in this book.
			</p>
		{/if}

		{#if groupedRefs.length > 0}
			<div class="mt-4 space-y-6">
				{#each groupedRefs as group (group.bible_book)}
					<div>
						<h3
							id={`scripture-group-${group.bible_book}`}
							class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						>
							{group.bible_book}
						</h3>
						<ul class="flex flex-col gap-3">
							{#each group.rows as ref (ref.id)}
								<li id={`ref-${ref.id}`}>
									{#if editingId === ref.id}
										<ScriptureReferenceForm
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
										<article
											class={`flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-3 text-card-foreground transition-shadow ${
												highlightedRefId === ref.id
													? 'border-amber-500/60 ring-2 ring-amber-500/40 shadow-md'
													: 'border-border'
											}`}
										>
											<div class="flex min-w-0 flex-1 items-start gap-3">
												{#if ref.source_image_signed_url}
													<a
														href={ref.source_image_signed_url}
														target="_blank"
														rel="noopener noreferrer"
														class="shrink-0"
														aria-label="Open page image in a new tab"
													>
														<img
															src={ref.source_image_signed_url}
															alt="Source page"
															class="size-16 rounded-md border border-border object-cover"
															loading="lazy"
														/>
													</a>
												{/if}
												<div class="min-w-0 flex-1">
													<div class="flex flex-wrap items-center gap-2">
														<span class="font-medium text-foreground">
															{fmtRef(ref)}
														</span>
														<span class="text-sm text-muted-foreground">
															{fmtPages(ref)}
														</span>
														{#if ref.needs_review}
															<span
																class="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200"
															>
																<AlertCircle class="size-3" /> Needs review
															</span>
														{/if}
													</div>
													{#if ref.review_note}
														<p class="mt-1 text-xs text-muted-foreground">
															{ref.review_note}
														</p>
													{/if}
												</div>
											</div>
											<div class="flex shrink-0 gap-1">
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onclick={() => startEdit(ref.id)}
													aria-label={`Edit ${fmtRef(ref)}`}
												>
													<Pencil class="size-4" /> Edit
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onclick={() => requestDelete(ref.id)}
													aria-label={`Delete ${fmtRef(ref)}`}
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
					</div>
				{/each}
			</div>
		{/if}

		{#if addOpen}
			<div class="mt-4">
				<ScriptureReferenceForm
					books={sourcePickerBooks}
					bibleBookNames={data.bibleBookNames}
					lockedBookId={data.book.id}
					userId={data.userId}
					{formMessage}
					onSavedBatch={onCreatedBatch}
					onCancel={() => (addOpen = false)}
				/>
				<div class="mt-2 flex justify-end">
					<Button type="button" variant="ghost" size="sm" onclick={() => (addOpen = false)}>
						Close add form
					</Button>
				</div>
			</div>
		{/if}
	</section>

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
				{#if data.bibleCoverage.length > 0}
					<span class="ml-1 text-sm font-normal text-muted-foreground">({data.bibleCoverage.length})</span>
				{/if}
			</h2>
		</div>
		<p class="mt-1 text-xs text-muted-foreground">
			Which biblical books does this work cover? Tagged books surface on passage search.
		</p>
		<div class="mt-3">
			<BookBibleCoverageEditor
				bookId={data.book.id}
				bibleBookNames={data.bibleBookNames}
				covered={data.bibleCoverage}
			/>
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
				{#if data.ancientCoverage.length > 0}
					<span class="ml-1 text-sm font-normal text-muted-foreground">({data.ancientCoverage.length})</span>
				{/if}
			</h2>
		</div>
		<div class="mt-3">
			<BookAncientCoverageEditor
				bookId={data.book.id}
				ancientTexts={data.ancientTexts}
				coverage={data.ancientCoverage}
				isOwner={data.isOwner}
			/>
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
							<BookTopicForm
								books={sourcePickerBooks}
								topicCounts={data.topicCounts}
								lockedBookId={data.book.id}
								userId={data.userId}
								existingTopic={topic}
								formMessage={topicFormMessage}
								onSaved={onTopicUpdated}
								onCancel={cancelEditTopic}
							/>
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
				<BookTopicForm
					books={sourcePickerBooks}
					topicCounts={data.topicCounts}
					lockedBookId={data.book.id}
					userId={data.userId}
					formMessage={topicFormMessage}
					onSavedBatch={onTopicCreated}
					onCancel={() => (topicAddOpen = false)}
				/>
			</div>
		{/if}
	</section>
</div>

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

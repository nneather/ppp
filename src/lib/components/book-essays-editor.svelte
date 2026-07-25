<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Copy from '@lucide/svelte/icons/copy';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import X from '@lucide/svelte/icons/x';
	import PersonAutocomplete from '$lib/components/person-autocomplete.svelte';
	import PersonEditDialog, {
		type PersonNamePrefill
	} from '$lib/components/person-edit-dialog.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import type { BookCitationInput, EssayCitationInput } from '$lib/library/turabian';
	import {
		copyCitationToClipboard,
		essayRowToCitationInput,
		formatEssayBibliography,
		formatEssayFootnote,
		normalizeCitationText
	} from '$lib/library/turabian';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import type { EssayRow, PersonRow } from '$lib/types/library';
	import { cn } from '$lib/utils.js';

	/**
	 * Essays & articles CRUD on book detail (reference_work + edited_volume parents).
	 * Batch create (N draft rows → `?/createEssaysBatch`); single-row edit.
	 */

	type FormMessage = {
		kind?: string;
		message?: string;
		essayId?: string;
		success?: boolean;
	} | null;

	type AuthorRow = {
		key: string;
		person_id: string;
	};

	type DraftEssayRow = {
		key: string;
		essay_title: string;
		page_start: string;
		page_end: string;
		authors: AuthorRow[];
	};

	const ESSAY_HASH_RE =
		/^#essay-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

	let {
		essays,
		volumeCitation,
		people: peopleProp,
		personBookCounts = {},
		parentBookId,
		isOwner,
		formMessage = null,
		onSaved,
		onCopied
	}: {
		essays: EssayRow[];
		volumeCitation: BookCitationInput;
		people: PersonRow[];
		personBookCounts?: Record<string, number>;
		parentBookId: string;
		isOwner: boolean;
		formMessage?: FormMessage;
		onSaved?: () => void;
		onCopied?: (message: string) => void;
	} = $props();

	/** Local overlay so inline create chips before peopleProp refreshes. */
	let peopleOverlay = $state<PersonRow[] | null>(null);
	$effect(() => {
		peopleProp;
		peopleOverlay = null;
	});
	const people = $derived(peopleOverlay ?? peopleProp);

	/** Open by default so articles are visible; user can still collapse. */
	let essaysOpen = $state(true);
	let highlightedEssayId = $state<string | null>(null);
	let highlightTimer: number | null = null;
	let addOpen = $state(false);
	let editingId = $state<string | null>(null);
	let pendingDeleteId = $state<string | null>(null);
	let confirmDeleteOpen = $state(false);
	let deletePending = $state(false);
	let deleteFormEl = $state<HTMLFormElement | null>(null);
	let deleteIdField = $state<HTMLInputElement | null>(null);

	/** Edit-mode single-row fields. */
	let essayTitle = $state('');
	let pageStart = $state('');
	let pageEnd = $state('');
	let authorRows = $state<AuthorRow[]>([]);

	/** Create-mode batch drafts. */
	let draftRows = $state<DraftEssayRow[]>([]);

	let pending = $state(false);

	/** Inline person create (PersonAutocomplete onCreate). */
	let personCreateOpen = $state(false);
	let personCreatePrefill = $state<PersonNamePrefill | null>(null);
	/** Edit-mode author row key, or null when targeting a draft author. */
	let pendingAuthorKey = $state<string | null>(null);
	/** Draft essay row key when creating from batch mode. */
	let pendingDraftRowKey = $state<string | null>(null);

	function freshKey(): string {
		return typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	}

	function blankAuthorRow(): AuthorRow {
		return { key: freshKey(), person_id: '' };
	}

	/** Client-side name parse for create-dialog prefill (mirrors book-form-authors). */
	function prefillFromTypedName(text: string): PersonNamePrefill {
		const trimmed = text.trim();
		if (!trimmed) return {};
		const isInitial = (s: string) => /^[A-Za-z]\.?$/.test(s);
		const stripDot = (s: string) => s.replace(/\.$/, '');
		if (trimmed.includes(',')) {
			const commaIdx = trimmed.indexOf(',');
			const last = trimmed.slice(0, commaIdx).trim();
			const after = trimmed.slice(commaIdx + 1).trim();
			if (!last) return { last_name: trimmed };
			const tokens = after.split(/\s+/).filter(Boolean);
			if (tokens.length === 0) return { last_name: last };
			if (tokens.length === 1) return { first_name: tokens[0], last_name: last };
			const lastTok = tokens[tokens.length - 1];
			if (isInitial(lastTok)) {
				return {
					first_name: tokens.slice(0, -1).join(' '),
					middle_name: stripDot(lastTok),
					last_name: last
				};
			}
			return { first_name: tokens.join(' '), last_name: last };
		}
		const tokens = trimmed.split(/\s+/);
		if (tokens.length === 1) return { last_name: tokens[0] };
		if (tokens.length === 2) return { first_name: tokens[0], last_name: tokens[1] };
		const last = tokens[tokens.length - 1];
		const maybeMiddle = tokens[tokens.length - 2];
		if (isInitial(maybeMiddle)) {
			return {
				first_name: tokens.slice(0, -2).join(' '),
				middle_name: stripDot(maybeMiddle),
				last_name: last
			};
		}
		return { first_name: tokens.slice(0, -1).join(' '), last_name: last };
	}

	function blankDraftRow(): DraftEssayRow {
		return {
			key: freshKey(),
			essay_title: '',
			page_start: '',
			page_end: '',
			authors: [blankAuthorRow()]
		};
	}

	function resetEditForm() {
		essayTitle = '';
		pageStart = '';
		pageEnd = '';
		authorRows = [blankAuthorRow()];
	}

	function resetDrafts() {
		draftRows = [blankDraftRow()];
	}

	function seedFromEssay(essay: EssayRow) {
		essayTitle = essay.essay_title;
		pageStart = essay.page_start != null ? String(essay.page_start) : '';
		pageEnd = essay.page_end != null ? String(essay.page_end) : '';
		authorRows =
			essay.authors.length > 0
				? essay.authors.map((a) => ({ key: freshKey(), person_id: a.person_id }))
				: [blankAuthorRow()];
	}

	function startAdd() {
		editingId = null;
		resetEditForm();
		resetDrafts();
		addOpen = true;
		essaysOpen = true;
	}

	function startEdit(id: string) {
		const essay = essays.find((e) => e.id === id);
		if (!essay) return;
		addOpen = false;
		editingId = id;
		seedFromEssay(essay);
		essaysOpen = true;
	}

	function cancelForm() {
		addOpen = false;
		editingId = null;
		resetEditForm();
		resetDrafts();
	}

	function addDraftRow() {
		draftRows = [...draftRows, blankDraftRow()];
	}

	function duplicateDraftRow(idx: number) {
		const src = draftRows[idx];
		if (!src) return;
		const copy: DraftEssayRow = {
			key: freshKey(),
			essay_title: src.essay_title,
			page_start: src.page_start,
			page_end: src.page_end,
			authors: src.authors.map((a) => ({ key: freshKey(), person_id: a.person_id }))
		};
		const next = draftRows.slice();
		next.splice(idx + 1, 0, copy);
		draftRows = next;
	}

	function removeDraftRow(idx: number) {
		if (draftRows.length <= 1) {
			draftRows = [blankDraftRow()];
			return;
		}
		draftRows = draftRows.filter((_, i) => i !== idx);
	}

	function addAuthorToDraft(rowKey: string) {
		draftRows = draftRows.map((r) =>
			r.key === rowKey ? { ...r, authors: [...r.authors, blankAuthorRow()] } : r
		);
	}

	function removeAuthorFromDraft(rowKey: string, authorKey: string) {
		draftRows = draftRows.map((r) => {
			if (r.key !== rowKey) return r;
			const authors = r.authors.filter((a) => a.key !== authorKey);
			return { ...r, authors: authors.length > 0 ? authors : [blankAuthorRow()] };
		});
	}

	function moveAuthorInDraft(rowKey: string, authorKey: string, delta: number) {
		draftRows = draftRows.map((r) => {
			if (r.key !== rowKey) return r;
			const idx = r.authors.findIndex((a) => a.key === authorKey);
			if (idx < 0) return r;
			const target = idx + delta;
			if (target < 0 || target >= r.authors.length) return r;
			const next = r.authors.slice();
			const [row] = next.splice(idx, 1);
			next.splice(target, 0, row);
			return { ...r, authors: next };
		});
	}

	function addAuthorRow() {
		authorRows = [...authorRows, blankAuthorRow()];
	}

	function removeAuthorRow(key: string) {
		authorRows = authorRows.filter((a) => a.key !== key);
		if (authorRows.length === 0) authorRows = [blankAuthorRow()];
	}

	function moveAuthor(key: string, delta: number) {
		const idx = authorRows.findIndex((a) => a.key === key);
		if (idx < 0) return;
		const target = idx + delta;
		if (target < 0 || target >= authorRows.length) return;
		const next = authorRows.slice();
		const [row] = next.splice(idx, 1);
		next.splice(target, 0, row);
		authorRows = next;
	}

	function openPersonCreate(
		rawText: string,
		opts: { authorKey: string; draftRowKey?: string | null }
	) {
		personCreatePrefill = prefillFromTypedName(rawText);
		pendingAuthorKey = opts.authorKey;
		pendingDraftRowKey = opts.draftRowKey ?? null;
		personCreateOpen = true;
	}

	async function onPersonCreated(created: PersonRow) {
		const base = peopleOverlay ?? peopleProp;
		peopleOverlay = [...base.filter((p) => p.id !== created.id), created].sort((a, b) =>
			a.last_name.localeCompare(b.last_name)
		);
		const authorKey = pendingAuthorKey;
		const draftKey = pendingDraftRowKey;
		pendingAuthorKey = null;
		pendingDraftRowKey = null;
		personCreatePrefill = null;
		if (authorKey && draftKey) {
			draftRows = draftRows.map((r) =>
				r.key !== draftKey
					? r
					: {
							...r,
							authors: r.authors.map((a) =>
								a.key === authorKey ? { ...a, person_id: created.id } : a
							)
						}
			);
		} else if (authorKey) {
			authorRows = authorRows.map((a) =>
				a.key === authorKey ? { ...a, person_id: created.id } : a
			);
		}
		await invalidate('app:library:people').catch(() => {});
	}

	function authorsJsonFrom(rows: AuthorRow[]): string {
		return JSON.stringify(
			rows
				.filter((a) => (a.person_id ?? '').trim().length > 0)
				.map((a, idx) => ({ person_id: a.person_id, sort_order: idx }))
		);
	}

	function authorsJson(): string {
		return authorsJsonFrom(authorRows);
	}

	const rowsJson = $derived(
		JSON.stringify(
			draftRows.map((r) => ({
				essay_title: r.essay_title,
				page_start: r.page_start,
				page_end: r.page_end,
				authors: r.authors
					.filter((a) => (a.person_id ?? '').trim().length > 0)
					.map((a, idx) => ({ person_id: a.person_id, sort_order: idx }))
			}))
		)
	);

	function authorsLabel(essay: EssayRow): string | null {
		const labels = essay.authors.map((a) => a.person_label).filter(Boolean);
		return labels.length > 0 ? labels.join(', ') : null;
	}

	/** Shared page override for essay note/short copy; empty → `[page]` (not stored range). */
	let essayCitationPage = $state('');

	function pageLabel(essay: EssayRow): string | null {
		if (essay.page_start == null) return null;
		if (essay.page_end != null && essay.page_end !== essay.page_start) {
			return `pp. ${essay.page_start}–${essay.page_end}`;
		}
		return `p. ${essay.page_start}`;
	}

	function essayInput(essay: EssayRow): EssayCitationInput {
		return essayRowToCitationInput(essay);
	}

	function essayPageOpts(): { page?: string; shortForm?: 'short' } {
		const page = essayCitationPage.trim();
		return page ? { page } : {};
	}

	async function copyEssayCitation(
		essay: EssayRow,
		kind: 'footnote' | 'bibliography' | 'short'
	) {
		if (!browser) return;
		const input = essayInput(essay);
		const opts = essayPageOpts();
		const citation =
			kind === 'bibliography'
				? formatEssayBibliography(input, volumeCitation)
				: kind === 'short'
					? formatEssayFootnote(input, volumeCitation, { ...opts, shortForm: 'short' })
					: formatEssayFootnote(input, volumeCitation, opts);
		if (!citation.plain) {
			onCopied?.('Nothing to copy.');
			return;
		}
		try {
			await copyCitationToClipboard(citation);
			onCopied?.(kind === 'short' ? 'Copied short form.' : `Copied ${kind}.`);
		} catch {
			onCopied?.('Clipboard unavailable.');
		}
	}

	function bibAvailable(essay: EssayRow): boolean {
		return formatEssayBibliography(essayInput(essay), volumeCitation).plain.length > 0;
	}

	const saveEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			await update({ reset: false });
			pending = false;
			if (result.type === 'success') {
				addOpen = false;
				editingId = null;
				resetEditForm();
				resetDrafts();
				onSaved?.();
			}
		};
	};

	const deleteEnhance: SubmitFunction = () => {
		deletePending = true;
		const deletedId = pendingDeleteId;
		return async ({ result, update }) => {
			await update({ reset: false });
			deletePending = false;
			confirmDeleteOpen = false;
			if (result.type === 'success') {
				if (editingId === deletedId) cancelForm();
				pendingDeleteId = null;
				onSaved?.();
			}
		};
	};

	function requestDelete(id: string) {
		pendingDeleteId = id;
		confirmDeleteOpen = true;
	}

	function confirmDelete() {
		if (!deleteIdField || !pendingDeleteId) return;
		deleteIdField.value = pendingDeleteId;
		deleteFormEl?.requestSubmit();
	}

	const isEdit = $derived(editingId != null);
	const formAction = $derived(isEdit ? '?/updateEssay' : '?/createEssaysBatch');
	const saveHotkey = $derived(isEdit ? 'u' : 's');
	const saveLabel = $derived(
		pending ? 'Saving…' : isEdit ? 'Update essay' : 'Save essays'
	);

	$effect(() => {
		if (addOpen || editingId != null || essays.length === 0) essaysOpen = true;
	});

	$effect(() => {
		if (!browser) return;
		const m = page.url.hash.match(ESSAY_HASH_RE);
		if (!m) return;
		const id = m[1];
		const tryScroll = () => {
			if (!essays.some((e) => e.id === id)) return;
			essaysOpen = true;
			const el = document.getElementById(`essay-${id}`);
			if (!el) return;
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			highlightedEssayId = id;
			if (highlightTimer != null) clearTimeout(highlightTimer);
			highlightTimer = window.setTimeout(() => {
				highlightedEssayId = null;
				highlightTimer = null;
			}, 2200);
		};
		queueMicrotask(() => {
			requestAnimationFrame(() => {
				requestAnimationFrame(tryScroll);
			});
		});
	});

	const scopedMessage = $derived.by(() => {
		if (!formMessage) return null;
		if (isEdit && formMessage.essayId && formMessage.essayId !== editingId) return null;
		if (
			formMessage.kind === 'createEssay' ||
			formMessage.kind === 'createEssaysBatch' ||
			formMessage.kind === 'updateEssay' ||
			formMessage.kind === 'softDeleteEssay'
		) {
			return formMessage;
		}
		return null;
	});
</script>

<details
	class="mt-10 rounded-lg border border-border bg-card text-card-foreground shadow-sm"
	bind:open={essaysOpen}
>
	<summary
		class="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden"
	>
		<span
			id="book-essays-heading"
			class="text-lg font-semibold tracking-tight text-foreground"
		>
			Essays &amp; articles
			{#if essays.length > 0}
				<span class="ml-1 text-sm font-normal text-muted-foreground">({essays.length})</span>
			{/if}
		</span>
		<ChevronDown
			class={cn(
				'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
				essaysOpen && 'rotate-180'
			)}
			aria-hidden="true"
		/>
	</summary>

	<div class="border-t border-border px-4 pb-4 pt-3">
		{#if essays.length > 0}
			<div class="mb-3 flex flex-wrap items-end gap-2">
				<div class="space-y-1">
					<Label for="essay-citation-page" class="text-xs text-muted-foreground">
						Page (note copy)
					</Label>
					<Input
						id="essay-citation-page"
						type="text"
						inputmode="numeric"
						placeholder="article range"
						bind:value={essayCitationPage}
						class="h-10 w-28 text-base"
						autocomplete="off"
					/>
				</div>
				<p class="pb-2 text-xs text-muted-foreground">
					Empty uses [page] for Footnote / Short form. Bibliography still uses the essay’s page range.
				</p>
			</div>
		{/if}
		{#if isOwner && !addOpen && editingId == null}
			<div class="mb-3 flex justify-end">
				<Button type="button" variant="outline" size="sm" onclick={startAdd}>
					<Plus class="size-4" /> Add essays
				</Button>
			</div>
		{/if}

		{#if essays.length === 0 && !addOpen && editingId == null}
			<p
				class="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
			>
				{#if isOwner}
					No essays yet. Click <strong class="font-semibold text-foreground">Add essays</strong> to
					log dictionary articles or chapter entries for Turabian copy.
				{:else}
					No essays recorded for this volume yet.
				{/if}
			</p>
		{/if}

		{#if essays.length > 0}
			<ul class="mt-4 flex flex-col gap-3">
				{#each essays as essay (essay.id)}
					<li id={`essay-${essay.id}`}>
						{#if editingId === essay.id}
							<!-- inline edit form rendered below list -->
						{:else}
							<article
								class={cn(
									'flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground sm:flex-row sm:items-start sm:justify-between',
									highlightedEssayId === essay.id &&
										'ring-2 ring-primary/60 ring-offset-2 ring-offset-background'
								)}
							>
								<div class="min-w-0 flex-1">
									<div class="font-medium text-foreground">
										{normalizeCitationText(essay.essay_title)}
									</div>
									{#if authorsLabel(essay)}
										<div class="mt-0.5 text-sm text-muted-foreground">{authorsLabel(essay)}</div>
									{/if}
									{#if pageLabel(essay)}
										<div class="mt-0.5 text-sm text-muted-foreground">{pageLabel(essay)}</div>
									{/if}
								</div>
								<div class="flex flex-wrap shrink-0 gap-1">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onclick={() => copyEssayCitation(essay, 'footnote')}
									>
										<Copy class="size-4" /> Footnote
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onclick={() => copyEssayCitation(essay, 'short')}
									>
										<Copy class="size-4" /> Short form
									</Button>
									{#if bibAvailable(essay)}
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => copyEssayCitation(essay, 'bibliography')}
										>
											<Copy class="size-4" /> Bibliography
										</Button>
									{/if}
									{#if isOwner}
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onclick={() => startEdit(essay.id)}
											aria-label={`Edit essay ${essay.essay_title}`}
										>
											<Pencil class="size-4" /> Edit
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											class="text-destructive hover:text-destructive"
											onclick={() => requestDelete(essay.id)}
											aria-label={`Delete essay ${essay.essay_title}`}
										>
											<Trash2 class="size-4" />
										</Button>
									{/if}
								</div>
							</article>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		{#if addOpen || editingId != null}
			<div class="mt-4 rounded-lg border border-border bg-card p-4 text-card-foreground">
				<header class="mb-4">
					<h3 class="text-sm font-semibold text-foreground">
						{isEdit ? 'Edit essay' : 'Add essays'}
					</h3>
					{#if !isEdit}
						<p class="mt-0.5 text-xs text-muted-foreground">
							Add as many rows as you like — one save commits the whole batch. Leave authors empty
							for unsigned dictionary entries (e.g. BDAG <em>s.v.</em>).
						</p>
					{/if}
				</header>
				<form method="POST" action={formAction} use:enhance={saveEnhance} class="space-y-4">
					{#if isEdit && editingId}
						<input type="hidden" name="id" value={editingId} />
						<input type="hidden" name="authors_json" value={authorsJson()} />
					{:else}
						<input type="hidden" name="rows_json" value={rowsJson} />
					{/if}
					<input type="hidden" name="parent_book_id" value={parentBookId} />

					{#if isEdit}
						<div class="space-y-2">
							<Label for="essay-title">Title</Label>
							<Input
								id="essay-title"
								name="essay_title"
								bind:value={essayTitle}
								placeholder="Canon, ἀγάπη, chapter title…"
								required
								class="min-h-11"
							/>
						</div>

						<div class="grid gap-4 sm:grid-cols-2">
							<div class="space-y-2">
								<Label for="essay-page-start">Page start</Label>
								<Input
									id="essay-page-start"
									name="page_start"
									type="number"
									min="0"
									step="1"
									bind:value={pageStart}
									placeholder="Optional"
									class="min-h-11"
								/>
							</div>
							<div class="space-y-2">
								<Label for="essay-page-end">Page end</Label>
								<Input
									id="essay-page-end"
									name="page_end"
									type="number"
									min="0"
									step="1"
									bind:value={pageEnd}
									placeholder="Optional"
									class="min-h-11"
								/>
							</div>
						</div>

						<fieldset class="space-y-2">
							<legend class="text-sm font-medium text-foreground">Authors</legend>
							<p class="text-xs text-muted-foreground">
								Leave empty for unsigned dictionary entries. Add authors for signed articles or
								chapters.
							</p>
							<div class="space-y-2">
								{#each authorRows as row, idx (row.key)}
									<div class="flex items-center gap-1">
										<div class="min-w-0 flex-1">
											<PersonAutocomplete
												{people}
												{personBookCounts}
												bind:value={row.person_id}
												placeholder="Search author…"
												onCreate={(text) =>
													openPersonCreate(text, { authorKey: row.key })}
											/>
										</div>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											class={cn(
												'min-h-11 min-w-11 shrink-0',
												authorRows.length === 1 && 'invisible'
											)}
											disabled={idx === 0}
											onclick={() => moveAuthor(row.key, -1)}
											aria-label="Move author up"
										>
											<ChevronUp class="size-4" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											class={cn(
												'min-h-11 min-w-11 shrink-0',
												authorRows.length === 1 && 'invisible'
											)}
											disabled={idx === authorRows.length - 1}
											onclick={() => moveAuthor(row.key, 1)}
											aria-label="Move author down"
										>
											<ChevronDown class="size-4" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											class="min-h-11 min-w-11 shrink-0 text-destructive hover:text-destructive"
											onclick={() => removeAuthorRow(row.key)}
											aria-label="Remove author"
										>
											<X class="size-4" />
										</Button>
									</div>
								{/each}
							</div>
							<Button type="button" variant="outline" size="sm" onclick={addAuthorRow}>
								<Plus class="size-4" /> Add author
							</Button>
						</fieldset>
					{:else}
						<div class="flex flex-col gap-3">
							{#each draftRows as row, idx (row.key)}
								<div
									class="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3"
									aria-label={`Essay row ${idx + 1}`}
								>
									<div class="flex items-center justify-between">
										<span
											class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
										>
											Row {idx + 1}
										</span>
										<div class="flex gap-1">
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onclick={() => duplicateDraftRow(idx)}
												aria-label="Duplicate row"
											>
												<Copy class="size-3.5" /> Duplicate
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onclick={() => removeDraftRow(idx)}
												aria-label="Remove row"
												class="text-destructive hover:text-destructive"
											>
												<X class="size-3.5" />
											</Button>
										</div>
									</div>

									<div class="space-y-2">
										<Label for={`essay-title-${row.key}`}>Title</Label>
										<Input
											id={`essay-title-${row.key}`}
											bind:value={row.essay_title}
											placeholder="Chapter or article title…"
											class="min-h-11"
										/>
									</div>

									<div class="grid gap-3 sm:grid-cols-2">
										<div class="space-y-2">
											<Label for={`essay-ps-${row.key}`}>Page start</Label>
											<Input
												id={`essay-ps-${row.key}`}
												type="number"
												min="0"
												step="1"
												bind:value={row.page_start}
												placeholder="Optional"
												class="min-h-11"
											/>
										</div>
										<div class="space-y-2">
											<Label for={`essay-pe-${row.key}`}>Page end</Label>
											<Input
												id={`essay-pe-${row.key}`}
												type="number"
												min="0"
												step="1"
												bind:value={row.page_end}
												placeholder="Optional"
												class="min-h-11"
											/>
										</div>
									</div>

									<div class="space-y-2">
										<span class="text-sm font-medium text-foreground">Authors</span>
										<div class="space-y-2">
											{#each row.authors as author, aIdx (author.key)}
												<div class="flex items-center gap-1">
													<div class="min-w-0 flex-1">
														<PersonAutocomplete
															{people}
															{personBookCounts}
															bind:value={author.person_id}
															placeholder="Search author…"
															onCreate={(text) =>
																openPersonCreate(text, {
																	authorKey: author.key,
																	draftRowKey: row.key
																})}
														/>
													</div>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														class={cn(
															'min-h-11 min-w-11 shrink-0',
															row.authors.length === 1 && 'invisible'
														)}
														disabled={aIdx === 0}
														onclick={() => moveAuthorInDraft(row.key, author.key, -1)}
														aria-label="Move author up"
													>
														<ChevronUp class="size-4" />
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														class={cn(
															'min-h-11 min-w-11 shrink-0',
															row.authors.length === 1 && 'invisible'
														)}
														disabled={aIdx === row.authors.length - 1}
														onclick={() => moveAuthorInDraft(row.key, author.key, 1)}
														aria-label="Move author down"
													>
														<ChevronDown class="size-4" />
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														class="min-h-11 min-w-11 shrink-0 text-destructive hover:text-destructive"
														onclick={() => removeAuthorFromDraft(row.key, author.key)}
														aria-label="Remove author"
													>
														<X class="size-4" />
													</Button>
												</div>
											{/each}
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => addAuthorToDraft(row.key)}
										>
											<Plus class="size-4" /> Add author
										</Button>
									</div>
								</div>
							{/each}
						</div>

						<Button type="button" variant="outline" size="sm" onclick={addDraftRow}>
							<Plus class="size-4" /> Add row
						</Button>
					{/if}

					{#if scopedMessage?.message}
						<p
							class={cn(
								'text-sm',
								scopedMessage.success
									? 'text-emerald-700 dark:text-emerald-300'
									: 'text-destructive'
							)}
							role="alert"
						>
							{scopedMessage.message}
						</p>
					{/if}

					<div class="flex flex-wrap gap-2">
						<Button type="submit" hotkey={saveHotkey} label={saveLabel} disabled={pending}>
							{saveLabel}
						</Button>
						<Button
							type="button"
							variant="outline"
							hotkey="Escape"
							label="Cancel"
							onclick={cancelForm}
						>
							Cancel
						</Button>
					</div>
				</form>
			</div>
		{/if}
	</div>
</details>

<form
	method="POST"
	action="?/softDeleteEssay"
	use:enhance={deleteEnhance}
	bind:this={deleteFormEl}
	class="hidden"
>
	<input type="hidden" name="id" value="" bind:this={deleteIdField} />
</form>

<ConfirmDialog
	bind:open={confirmDeleteOpen}
	title="Delete essay?"
	description="This soft-deletes the essay. You can restore it from the audit log if needed."
	confirmLabel="Delete"
	cancelLabel="Keep"
	destructive
	pending={deletePending}
	onConfirm={confirmDelete}
	onCancel={() => {
		pendingDeleteId = null;
	}}
/>

<PersonEditDialog
	bind:open={personCreateOpen}
	person={null}
	prefill={personCreatePrefill}
	{people}
	createActionPath="?/createPerson"
	onSaved={onPersonCreated}
/>

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
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import type { BookCitationInput, EssayCitationInput } from '$lib/library/turabian';
	import {
		copyCitationToClipboard,
		essayRowToCitationInput,
		formatEssayBibliography,
		formatEssayFootnote
	} from '$lib/library/turabian';
	import { page } from '$app/state';
	import type { EssayRow, PersonRow } from '$lib/types/library';
	import { cn } from '$lib/utils.js';

	/**
	 * Essays & articles CRUD on book detail (reference_work + edited_volume parents).
	 * Single-row create/edit — not batch-capable (unlike scripture refs).
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

	const ESSAY_HASH_RE =
		/^#essay-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

	let {
		essays,
		volumeCitation,
		people,
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

	let essayTitle = $state('');
	let pageStart = $state('');
	let pageEnd = $state('');
	let authorRows = $state<AuthorRow[]>([]);
	let pending = $state(false);

	function freshKey(): string {
		return typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	}

	function blankAuthorRow(): AuthorRow {
		return { key: freshKey(), person_id: '' };
	}

	function resetForm() {
		essayTitle = '';
		pageStart = '';
		pageEnd = '';
		authorRows = [blankAuthorRow()];
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
		resetForm();
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
		resetForm();
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

	function authorsJson(): string {
		return JSON.stringify(
			authorRows
				.filter((a) => a.person_id.trim().length > 0)
				.map((a, idx) => ({ person_id: a.person_id, sort_order: idx }))
		);
	}

	function authorsLabel(essay: EssayRow): string | null {
		const labels = essay.authors.map((a) => a.person_label).filter(Boolean);
		return labels.length > 0 ? labels.join(', ') : null;
	}

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

	async function copyEssayCitation(essay: EssayRow, kind: 'footnote' | 'bibliography') {
		if (!browser) return;
		const input = essayInput(essay);
		const citation =
			kind === 'footnote'
				? formatEssayFootnote(input, volumeCitation)
				: formatEssayBibliography(input, volumeCitation);
		if (!citation.plain) {
			onCopied?.('Nothing to copy.');
			return;
		}
		try {
			await copyCitationToClipboard(citation);
			onCopied?.(`Copied ${kind}.`);
		} catch {
			onCopied?.('Clipboard unavailable.');
		}
	}

	function bibAvailable(essay: EssayRow): boolean {
		return formatEssayBibliography(essayInput(essay), volumeCitation).plain.length > 0;
	}

	const saveEnhance: SubmitFunction = ({ formData }) => {
		formData.set('authors_json', authorsJson());
		pending = true;
		return async ({ result, update }) => {
			await update({ reset: false });
			pending = false;
			if (result.type === 'success') {
				addOpen = false;
				editingId = null;
				resetForm();
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
	const formAction = $derived(isEdit ? '?/updateEssay' : '?/createEssay');
	const saveHotkey = $derived(isEdit ? 'u' : 's');
	const saveLabel = $derived(pending ? 'Saving…' : isEdit ? 'Update essay' : 'Save essay');

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
		{#if isOwner && !addOpen && editingId == null}
			<div class="mb-3 flex justify-end">
				<Button type="button" variant="outline" size="sm" onclick={startAdd}>
					<Plus class="size-4" /> Add essay
				</Button>
			</div>
		{/if}

	{#if essays.length === 0 && !addOpen && editingId == null}
		<p
			class="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
		>
			{#if isOwner}
				No essays yet. Click <strong class="font-semibold text-foreground">Add essay</strong> to
				log a dictionary article or chapter entry for Turabian copy.
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
						<!-- inline edit form rendered below list item slot -->
					{:else}
						<article
							class={cn(
								'flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground sm:flex-row sm:items-start sm:justify-between',
								highlightedEssayId === essay.id &&
									'ring-2 ring-primary/60 ring-offset-2 ring-offset-background'
							)}
						>
							<div class="min-w-0 flex-1">
								<div class="font-medium text-foreground">{essay.essay_title}</div>
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
			<h3 class="text-sm font-semibold text-foreground">
				{isEdit ? 'Edit essay' : 'New essay'}
			</h3>
			<form method="POST" action={formAction} use:enhance={saveEnhance} class="mt-4 space-y-4">
				{#if isEdit && editingId}
					<input type="hidden" name="id" value={editingId} />
				{/if}
				<input type="hidden" name="parent_book_id" value={parentBookId} />
				<input type="hidden" name="authors_json" value={authorsJson()} />

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
						Leave empty for unsigned dictionary entries (e.g. BDAG <em>s.v.</em>). Add authors for
						signed articles or chapters.
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
									/>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									class={cn('min-h-11 min-w-11 shrink-0', authorRows.length === 1 && 'invisible')}
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
									class={cn('min-h-11 min-w-11 shrink-0', authorRows.length === 1 && 'invisible')}
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

				{#if scopedMessage?.message}
					<p
						class={cn(
							'text-sm',
							scopedMessage.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'
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
					<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={cancelForm}>
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

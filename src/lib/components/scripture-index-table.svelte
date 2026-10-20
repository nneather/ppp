<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import ScriptureIndexRow from '$lib/components/scripture-index-row.svelte';
	import { formatVolumePage } from '$lib/library/scripture-index';
	import type { ScriptureIndexRefRow } from '$lib/library/server/scripture-index-loaders';
	import { cn } from '$lib/utils.js';

	let {
		rows,
		filteredCount,
		scopeBookIds,
		showVolume = false,
		offset,
		limit,
		onInvalidate
	}: {
		rows: ScriptureIndexRefRow[];
		filteredCount: number;
		scopeBookIds: string[];
		showVolume?: boolean;
		offset: number;
		limit: number;
		onInvalidate?: () => void | Promise<void>;
	} = $props();

	let selected = $state<Set<string>>(new Set());
	let editingId = $state<string | null>(null);
	let confirmBulkDeleteOpen = $state(false);
	let bulkPending = $state(false);
	let undoIds = $state<string[] | null>(null);
	let undoVisible = $state(false);
	let undoTimer: number | null = null;

	const selectedCount = $derived(selected.size);
	const allOnPageSelected = $derived(
		rows.length > 0 && rows.every((r) => selected.has(r.id))
	);

	function toggleAll(on: boolean) {
		if (on) selected = new Set(rows.map((r) => r.id));
		else selected = new Set();
	}

	function toggleOne(id: string, on: boolean) {
		const next = new Set(selected);
		if (on) next.add(id);
		else next.delete(id);
		selected = next;
	}

	function showUndo(ids: string[]) {
		undoIds = ids;
		undoVisible = true;
		if (undoTimer != null) clearTimeout(undoTimer);
		undoTimer = window.setTimeout(() => {
			undoVisible = false;
			undoIds = null;
			undoTimer = null;
		}, 10000);
	}

	const scopeJson = $derived(JSON.stringify(scopeBookIds));
	const selectedJson = $derived(JSON.stringify([...selected]));

	const bulkEnhance =
		(kind: string): SubmitFunction =>
		() => {
			bulkPending = true;
			const snapshot = [...selected];
			return async ({ result }) => {
				bulkPending = false;
				confirmBulkDeleteOpen = false;
				if (result.type === 'success') {
					selected = new Set();
					if (kind === 'delete') showUndo(snapshot);
					await onInvalidate?.();
				} else {
					await onInvalidate?.();
				}
			};
		};

	const undoEnhance: SubmitFunction = () => {
		return async ({ result }) => {
			undoVisible = false;
			undoIds = null;
			if (undoTimer != null) {
				clearTimeout(undoTimer);
				undoTimer = null;
			}
			await onInvalidate?.();
			if (result.type !== 'success') {
				/* ignore */
			}
		};
	};

	const editEnhance: SubmitFunction = () => {
		return async ({ result }) => {
			if (result.type === 'success') {
				editingId = null;
				await onInvalidate?.();
			}
		};
	};

	const pageFrom = $derived(filteredCount === 0 ? 0 : offset + 1);
	const pageTo = $derived(Math.min(offset + rows.length, filteredCount));

	// Drop ids that left the page so a filter change cannot bulk-delete unseen rows.
	$effect(() => {
		const visible = new Set(rows.map((r) => r.id));
		const next = new Set([...selected].filter((id) => visible.has(id)));
		if (next.size !== selected.size) selected = next;
	});
</script>

{#if selectedCount > 0}
	<div
		class="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm"
	>
		<span class="text-sm font-medium tabular-nums">{selectedCount} selected</span>
		<form method="POST" action="?/setNeedsReview" use:enhance={bulkEnhance('flag')}>
			<input type="hidden" name="ids_json" value={selectedJson} />
			<input type="hidden" name="scope_book_ids_json" value={scopeJson} />
			<input type="hidden" name="needs_review" value="true" />
			<Button type="submit" variant="outline" size="sm" disabled={bulkPending} label="Flag review" />
		</form>
		<form method="POST" action="?/setNeedsReview" use:enhance={bulkEnhance('clear')}>
			<input type="hidden" name="ids_json" value={selectedJson} />
			<input type="hidden" name="scope_book_ids_json" value={scopeJson} />
			<input type="hidden" name="needs_review" value="false" />
			<Button type="submit" variant="outline" size="sm" disabled={bulkPending} label="Clear review" />
		</form>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="text-destructive"
			disabled={bulkPending}
			onclick={() => (confirmBulkDeleteOpen = true)}
			label="Delete"
		/>
	</div>
{/if}

<div class="mb-2 flex items-center justify-between gap-2 text-sm text-muted-foreground">
	<label class="inline-flex items-center gap-2">
		<input
			type="checkbox"
			class="size-4 rounded border-border"
			checked={allOnPageSelected}
			onchange={(e) => toggleAll((e.currentTarget as HTMLInputElement).checked)}
		/>
		Select page
	</label>
	<span class="tabular-nums">
		{pageFrom}–{pageTo} of {filteredCount.toLocaleString()}
	</span>
</div>

<!-- Desktop table -->
<div class="hidden overflow-hidden rounded-lg border border-border md:block">
	<table class="w-full text-sm">
		<thead class="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
			<tr>
				<th class="w-10 px-3 py-2"></th>
				<th class="px-3 py-2">Passage</th>
				<th class="px-3 py-2">Pages</th>
				<th class="px-3 py-2">Outline</th>
				<th class="px-3 py-2">Flags</th>
				<th class="px-3 py-2"></th>
			</tr>
		</thead>
		<tbody class="divide-y divide-border/60">
			{#each rows as row (row.id)}
				{#if editingId === row.id}
					<tr class="bg-muted/20">
						<td colspan="6" class="px-3 py-3">
							<form
								method="POST"
								action="?/updateScriptureRef"
								class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
								use:enhance={editEnhance}
							>
								<input type="hidden" name="id" value={row.id} />
								<input type="hidden" name="source_kind" value="book" />
								<input type="hidden" name="book_id" value={row.book_id} />
								<input type="hidden" name="bible_book" value={row.bible_book} />
								<div class="space-y-1">
									<Label for={`cs-${row.id}`}>Chapter start</Label>
									<Input
										id={`cs-${row.id}`}
										name="chapter_start"
										type="number"
										value={row.chapter_start ?? ''}
									/>
								</div>
								<div class="space-y-1">
									<Label for={`vs-${row.id}`}>Verse start</Label>
									<Input
										id={`vs-${row.id}`}
										name="verse_start"
										type="number"
										value={row.verse_start ?? ''}
									/>
								</div>
								<div class="space-y-1">
									<Label for={`ce-${row.id}`}>Chapter end</Label>
									<Input
										id={`ce-${row.id}`}
										name="chapter_end"
										type="number"
										value={row.chapter_end ?? ''}
									/>
								</div>
								<div class="space-y-1">
									<Label for={`ve-${row.id}`}>Verse end</Label>
									<Input
										id={`ve-${row.id}`}
										name="verse_end"
										type="number"
										value={row.verse_end ?? ''}
									/>
								</div>
								<div class="space-y-1">
									<Label for={`ps-${row.id}`}>Page start</Label>
									<Input id={`ps-${row.id}`} name="page_start" value={row.page_start} required />
								</div>
								<div class="space-y-1">
									<Label for={`pe-${row.id}`}>Page end</Label>
									<Input id={`pe-${row.id}`} name="page_end" value={row.page_end ?? ''} />
								</div>
								<div class="flex items-end gap-2 sm:col-span-2">
									<Button type="submit" size="sm" hotkey="s" label="Save" />
									<Button
										type="button"
										variant="outline"
										size="sm"
										hotkey="Escape"
										label="Cancel"
										onclick={() => (editingId = null)}
									/>
								</div>
							</form>
						</td>
					</tr>
				{:else}
					<tr class={cn(selected.has(row.id) && 'bg-muted/40')}>
						<td class="px-3 py-2">
							<input
								type="checkbox"
								class="size-4 rounded border-border"
								checked={selected.has(row.id)}
								onchange={(e) =>
									toggleOne(row.id, (e.currentTarget as HTMLInputElement).checked)}
								aria-label="Select row"
							/>
						</td>
						<td class="px-3 py-2 font-medium tabular-nums">
							{row.bible_book}
							{row.chapter_start ?? ''}{row.verse_start != null ? `:${row.verse_start}` : ''}
							{#if row.chapter_end != null || row.verse_end != null}
								–{row.chapter_end ?? row.chapter_start}{row.verse_end != null
									? `:${row.verse_end}`
									: ''}
							{/if}
						</td>
						<td class="px-3 py-2 tabular-nums text-muted-foreground">
							{showVolume
								? formatVolumePage(row.volume_number, row.page_start, row.page_end)
								: row.page_end && row.page_end !== row.page_start
									? `${row.page_start}–${row.page_end}`
									: row.page_start}
						</td>
						<td class="max-w-[12rem] truncate px-3 py-2 text-muted-foreground" title={row.outline_label ?? ''}>
							{row.outline_label ?? '—'}
						</td>
						<td class="px-3 py-2">
							{#if row.needs_review}
								<span
									class="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200"
								>
									<AlertCircle class="size-3" /> Review
								</span>
							{/if}
						</td>
						<td class="px-3 py-2 text-right">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onclick={() => (editingId = row.id)}
								label="Edit"
								hotkey="e"
							/>
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</div>

<!-- Mobile stacked rows -->
<ul class="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 md:hidden">
	{#each rows as row (row.id)}
		{#if editingId === row.id}
			<li class="space-y-2 bg-muted/20 p-3">
				<form method="POST" action="?/updateScriptureRef" class="grid gap-2" use:enhance={editEnhance}>
					<input type="hidden" name="id" value={row.id} />
					<input type="hidden" name="source_kind" value="book" />
					<input type="hidden" name="book_id" value={row.book_id} />
					<input type="hidden" name="bible_book" value={row.bible_book} />
					<Input name="chapter_start" type="number" placeholder="Ch start" value={row.chapter_start ?? ''} />
					<Input name="verse_start" type="number" placeholder="Vs start" value={row.verse_start ?? ''} />
					<Input name="chapter_end" type="number" placeholder="Ch end" value={row.chapter_end ?? ''} />
					<Input name="verse_end" type="number" placeholder="Vs end" value={row.verse_end ?? ''} />
					<Input name="page_start" placeholder="Page start" value={row.page_start} required />
					<Input name="page_end" placeholder="Page end" value={row.page_end ?? ''} />
					<div class="flex gap-2">
						<Button type="submit" size="sm" hotkey="s" label="Save" />
						<Button
							type="button"
							variant="outline"
							size="sm"
							hotkey="Escape"
							label="Cancel"
							onclick={() => (editingId = null)}
						/>
					</div>
				</form>
			</li>
		{:else}
			<ScriptureIndexRow
				ref={row}
				{showVolume}
				selectable
				selected={selected.has(row.id)}
				onSelectChange={toggleOne}
				onEdit={(id) => (editingId = id)}
			/>
		{/if}
	{/each}
</ul>

<form method="POST" action="?/softDeleteBulk" class="hidden" id="bulk-delete-form" use:enhance={bulkEnhance('delete')}>
	<input type="hidden" name="ids_json" value={selectedJson} />
	<input type="hidden" name="scope_book_ids_json" value={scopeJson} />
</form>

{#if undoVisible && undoIds}
	<div
		class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 shadow-lg"
	>
		<span class="text-sm">Deleted {undoIds.length} reference{undoIds.length === 1 ? '' : 's'}.</span>
		<form method="POST" action="?/undoSoftDeleteBulk" use:enhance={undoEnhance}>
			<input type="hidden" name="ids_json" value={JSON.stringify(undoIds)} />
			<input type="hidden" name="scope_book_ids_json" value={scopeJson} />
			<Button type="submit" size="sm" variant="outline" label="Undo" />
		</form>
	</div>
{/if}

<ConfirmDialog
	bind:open={confirmBulkDeleteOpen}
	title="Delete selected references?"
	description={`Soft-delete ${selectedCount} reference${selectedCount === 1 ? '' : 's'}. You can undo for 10 seconds.`}
	confirmLabel="Delete"
	destructive
	pending={bulkPending}
	onConfirm={() => {
		const form = document.getElementById('bulk-delete-form') as HTMLFormElement | null;
		form?.requestSubmit();
	}}
/>

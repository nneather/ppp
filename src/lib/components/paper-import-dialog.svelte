<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Dialog from '$lib/components/ui/dialog';
	import {
		SUGGESTION_REASON_LABELS,
		importChecklistLead,
		visibleImportChecklistRows,
		type ImportChecklistRow,
		type ImportChecklistSort,
		type SetSuggestion
	} from '$lib/studies/import-suggest';
	import { cn } from '$lib/utils';

	type SetOption = { id: string; name: string };
	type PaperOption = { id: string; title: string; passageDisplay: string | null };

	let {
		open = $bindable(false),
		paperId,
		parentField = 'paper_id',
		suggestions = [],
		importSets,
		importPapers = [],
		checklist = null,
		sectionCandidateCount = 0,
		importError = null,
		onImported
	}: {
		open?: boolean;
		paperId: string;
		parentField?: 'paper_id' | 'sermon_id';
		suggestions?: SetSuggestion[];
		importSets: { label: string; sets: SetOption[] }[];
		importPapers?: PaperOption[];
		checklist?: {
			key: string;
			groupName: string;
			sourceLabel: string;
			copyNotes: boolean;
			rows: ImportChecklistRow[];
		} | null;
		/** Books whose curated sections overlap this study's passage. */
		sectionCandidateCount?: number;
		importError?: string | null;
		onImported?: () => void | Promise<void>;
	} = $props();

	let pending = $state(false);
	let checked = $state<Record<string, boolean>>({});
	let seenKey = $state<string | null>(null);
	let filterQuery = $state('');
	let sortBy = $state<ImportChecklistSort>('title');

	const visibleRows = $derived(
		checklist ? visibleImportChecklistRows(checklist.rows, filterQuery, sortBy) : []
	);
	const selectableVisible = $derived(visibleRows.filter((r) => !r.attached));
	const selectedCount = $derived(
		(checklist?.rows ?? []).filter((r) => !r.attached && checked[r.key]).length
	);

	$effect(() => {
		const key = checklist?.key ?? null;
		if (key === seenKey) return;
		untrack(() => {
			seenKey = key;
			checked = {};
			filterQuery = '';
			sortBy = 'title';
		});
	});

	function goImport(value: string | null) {
		const url = new URL(page.url);
		if (value) url.searchParams.set('import', value);
		else url.searchParams.delete('import');
		void goto(`${url.pathname}${url.search}`, { keepFocus: true, noScroll: true, replaceState: true });
	}

	function prepareItems(event: SubmitEvent) {
		const form = event.currentTarget as HTMLFormElement;
		const input = form.querySelector('input[name="items"]') as HTMLInputElement | null;
		if (!input || !checklist) return;
		const items = checklist.rows
			.filter((r) => !r.attached && checked[r.key])
			.map((r) => ({
				book_id: r.bookId,
				essay_id: r.essayId,
				notes: r.notes,
				write_notes: checklist?.copyNotes === true
			}));
		input.value = JSON.stringify(items);
	}

	const importEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false });
			if (result.type === 'success') await onImported?.();
		};
	};

	function toggle(key: string, on: boolean) {
		checked = { ...checked, [key]: on };
	}

	function selectVisible() {
		const next = { ...checked };
		for (const row of selectableVisible) next[row.key] = true;
		checked = next;
	}

	function clearVisible() {
		const next = { ...checked };
		for (const row of selectableVisible) next[row.key] = false;
		checked = next;
	}

	function closePicker() {
		open = false;
		goImport(null);
	}
</script>

{#snippet setButton(set: SetOption, hint: string | null)}
	<button
		type="button"
		class="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/70"
		onclick={() => goImport(`set:${set.id}`)}
	>
		<span class="min-w-0 truncate">{set.name}</span>
		{#if hint}
			<span class="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{hint}</span>
		{/if}
	</button>
{/snippet}

{#snippet checklistRow(row: ImportChecklistRow)}
	{@const lead = importChecklistLead(row)}
	{@const showTitleUnder = !!row.seriesAbbreviation?.trim() && lead !== row.title}
	{@const vols =
		typeof row.volumeCount === 'number' && row.volumeCount > 1 ? `${row.volumeCount} vols.` : null}
	<li class={row.attached ? 'opacity-50' : ''}>
		<label class="flex items-start gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-muted/40">
			<input
				type="checkbox"
				class="mt-0.5 size-4 shrink-0"
				checked={!row.attached && checked[row.key] === true}
				disabled={row.attached}
				onchange={(e) => toggle(row.key, e.currentTarget.checked)}
			/>
			<span class="min-w-0 flex-1">
				<span class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
					<span class="font-medium break-words">{lead}</span>
					{#if vols}
						<span class="shrink-0 text-[10px] text-muted-foreground">{vols}</span>
					{/if}
					{#if row.attached}
						<span class="shrink-0 text-xs text-muted-foreground">Attached</span>
					{/if}
				</span>
				{#if showTitleUnder}
					<span class="mt-0.5 block break-words text-xs text-muted-foreground">{row.title}</span>
				{/if}
				{#if row.authors}
					<span class="mt-0.5 block break-words text-xs text-muted-foreground">{row.authors}</span>
				{/if}
				{#if row.hint}
					<span class="mt-0.5 block text-xs text-muted-foreground">{row.hint}</span>
				{/if}
				{#if row.notes}
					<span class="mt-0.5 block text-xs whitespace-pre-wrap text-muted-foreground">{row.notes}</span>
				{/if}
			</span>
		</label>
	</li>
{/snippet}

<Dialog.Root bind:open>
	<Dialog.Content
		class="flex h-[92dvh] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:h-[min(85dvh,720px)] sm:max-w-3xl"
		showCloseButton={true}
	>
		<Dialog.Header class="shrink-0 space-y-1 border-b border-border px-4 py-4 pr-12 text-left sm:px-5">
			<Dialog.Title>{checklist ? 'Import checklist' : 'Import sources'}</Dialog.Title>
			<Dialog.Description class="text-sm text-muted-foreground">
				{#if checklist}
					Selected rows land in “{checklist.groupName}” as candidates.
					{#if checklist.copyNotes} Notes come along from the prior paper.{/if}
				{:else}
					Start from a suggested set, books on this passage, or a prior paper. Already-attached
					rows stay greyed.
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
			{#if importError}
				<p class="shrink-0 px-4 pt-3 text-sm text-destructive sm:px-5" role="alert">{importError}</p>
			{/if}

			{#if checklist}
				<div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
					<Input
						type="search"
						value={filterQuery}
						oninput={(e) => (filterQuery = e.currentTarget.value)}
						placeholder="Filter title, abbreviation, or author"
						aria-label="Filter checklist"
						class="min-w-[12rem] flex-1"
					/>
					<div class="flex items-center gap-1 rounded-md border border-border p-0.5">
						<button
							type="button"
							class={cn(
								'rounded px-2 py-1 text-xs font-medium',
								sortBy === 'title' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
							)}
							onclick={() => (sortBy = 'title')}
						>
							Title
						</button>
						<button
							type="button"
							class={cn(
								'rounded px-2 py-1 text-xs font-medium',
								sortBy === 'author'
									? 'bg-muted text-foreground'
									: 'text-muted-foreground hover:text-foreground'
							)}
							onclick={() => (sortBy = 'author')}
						>
							Author
						</button>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						label="Select all"
						disabled={selectableVisible.length === 0}
						onclick={selectVisible}
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						label="Clear"
						disabled={selectableVisible.every((r) => !checked[r.key])}
						onclick={clearVisible}
					/>
				</div>

				<div class="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-3">
					{#if checklist.rows.length === 0}
						<p class="px-2 py-4 text-sm text-muted-foreground">
							Nothing to import from {checklist.sourceLabel}.
						</p>
					{:else if visibleRows.length === 0}
						<p class="px-2 py-4 text-sm text-muted-foreground">No rows match this filter.</p>
					{:else}
						<ul class="space-y-0.5">
							{#each visibleRows as row (row.key)}
								{@render checklistRow(row)}
							{/each}
						</ul>
					{/if}
				</div>
			{:else}
				<div class="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
					{#if sectionCandidateCount > 0 || suggestions.length > 0}
						<h3 class="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Suggested
						</h3>
						<ul class="mt-1">
							{#if sectionCandidateCount > 0}
								<li>
									<button
										type="button"
										class="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/70"
										onclick={() => goImport('sections')}
									>
										<span class="min-w-0 truncate">On this passage</span>
										<span
											class="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
										>
											{sectionCandidateCount === 1 ? '1 book' : `${sectionCandidateCount} books`}
										</span>
									</button>
								</li>
							{/if}
							{#each suggestions as s (s.id)}
								<li>
									{@render setButton(s, SUGGESTION_REASON_LABELS[s.reason])}
								</li>
							{/each}
						</ul>
					{/if}

					{#each importSets as section (section.label)}
						{#if section.sets.length > 0}
							<h3
								class="mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
							>
								{section.label}
							</h3>
							<ul class="mt-1">
								{#each section.sets as set (set.id)}
									<li>{@render setButton(set, null)}</li>
								{/each}
							</ul>
						{/if}
					{/each}

					<h3 class="mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Prior papers
					</h3>
					{#if importPapers.length === 0}
						<p class="mt-1 px-2 text-sm text-muted-foreground">No other active papers.</p>
					{:else}
						<ul class="mt-1">
							{#each importPapers as p (p.id)}
								<li>
									<button
										type="button"
										class="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-muted/70"
										onclick={() => goImport(`paper:${p.id}`)}
									>
										<span class="text-sm">{p.passageDisplay?.trim() || p.title}</span>
										{#if p.passageDisplay?.trim()}
											<span class="text-xs text-muted-foreground">{p.title}</span>
										{/if}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</div>

		<div class="shrink-0 flex gap-2 border-t border-border bg-background px-4 py-3 sm:px-5">
			{#if checklist}
				<Button type="button" variant="outline" label="Back" onclick={() => goImport(null)} />
				<form
					method="POST"
					action="?/importPaperSources"
					use:enhance={importEnhance}
					onsubmit={prepareItems}
					class="flex flex-1"
				>
					<input type="hidden" name={parentField} value={paperId} />
					<input type="hidden" name="group_name" value={checklist.groupName} />
					<input type="hidden" name="items" value="[]" />
					<Button
						type="submit"
						class="flex-1"
						hotkey="s"
						label={pending ? 'Importing…' : `Import ${selectedCount}`}
						disabled={pending || selectedCount === 0}
					/>
				</form>
			{:else}
				<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={closePicker} />
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>

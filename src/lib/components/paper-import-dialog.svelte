<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import {
		SUGGESTION_REASON_LABELS,
		importChecklistLead,
		importSelectableKeys,
		visibleImportChecklistRows,
		type ImportChecklistRow,
		type ImportChecklistSort,
		type ImportSetSection,
		type SetSuggestion
	} from '$lib/studies/import-suggest';
	import { bibleBookFromRules, testamentOfBibleBook } from '$lib/studies/resource-sets';
	import { GENRES } from '$lib/types/library';
	import { cn } from '$lib/utils';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	type SetOption = { id: string; name: string; bibleBook?: string | null };
	type PaperOption = { id: string; title: string; passageDisplay: string | null };
	type CreateSection = { id: string; name: string; setKind: 'language' | 'custom' };

	type ChecklistState = {
		key: string;
		groupName: string;
		sourceLabel: string;
		copyNotes: boolean;
		rows: ImportChecklistRow[];
		notIncludedRows: ImportChecklistRow[];
		error: string | null;
	};

	let {
		open = $bindable(false),
		parentId,
		parentField = 'paper_id',
		parentKind = 'paper',
		passageDisplay = null,
		suggestions = [],
		importSets,
		importCreateSections = [],
		importPapers = [],
		sectionCandidateCount = 0,
		metaLoading = false,
		isOwner = false,
		onImported
	}: {
		open?: boolean;
		parentId: string;
		parentField?: 'paper_id' | 'sermon_id';
		parentKind?: 'paper' | 'sermon';
		passageDisplay?: string | null;
		suggestions?: SetSuggestion[];
		importSets: ImportSetSection[];
		importCreateSections?: CreateSection[];
		importPapers?: PaperOption[];
		sectionCandidateCount?: number;
		metaLoading?: boolean;
		isOwner?: boolean;
		onImported?: () => void | Promise<void>;
	} = $props();

	let pending = $state(false);
	let checklistLoading = $state(false);
	let checklist = $state<ChecklistState | null>(null);
	let checkedByKey = $state<Record<string, Record<string, boolean>>>({});
	let filterQuery = $state('');
	let sortBy = $state<ImportChecklistSort>('title');
	let openSections = $state<Set<string>>(new Set());
	let openOt = $state(false);
	let openNt = $state(false);
	let notIncludedOpen = $state(false);
	let showNewSet = $state(false);
	let newSetPending = $state(false);
	let newSetMessage = $state<string | null>(null);

	const checked = $derived(checklist ? (checkedByKey[checklist.key] ?? {}) : {});
	const notIncludedKeySet = $derived(
		new Set((checklist?.notIncludedRows ?? []).map((r) => r.key))
	);
	const visibleRows = $derived(
		checklist ? visibleImportChecklistRows(checklist.rows, filterQuery, sortBy) : []
	);
	const visibleNotIncluded = $derived(
		checklist
			? visibleImportChecklistRows(checklist.notIncludedRows, filterQuery, sortBy)
			: []
	);
	const selectableVisible = $derived(
		importSelectableKeys(visibleRows, notIncludedKeySet)
	);
	const selectedCount = $derived(
		checklist
			? [...checklist.rows, ...checklist.notIncludedRows].filter(
					(r) => !r.attached && checked[r.key] === true
				).length
			: 0
	);

	$effect(() => {
		if (open) return;
		untrack(() => {
			checklist = null;
			filterQuery = '';
			sortBy = 'title';
			notIncludedOpen = false;
			showNewSet = false;
			newSetMessage = null;
			checklistLoading = false;
		});
	});

	function toggleSection(label: string) {
		const next = new Set(openSections);
		if (next.has(label)) next.delete(label);
		else next.add(label);
		openSections = next;
	}

	function sectionOpen(label: string): boolean {
		return openSections.has(label);
	}

	function splitBibleSets(sets: SetOption[]) {
		const ot: SetOption[] = [];
		const nt: SetOption[] = [];
		const other: SetOption[] = [];
		for (const set of sets) {
			const t = testamentOfBibleBook(set.bibleBook ?? null);
			if (t === 'ot') ot.push(set);
			else if (t === 'nt') nt.push(set);
			else other.push(set);
		}
		return { ot, nt, other };
	}

	async function fetchChecklist(importValue: string) {
		checklistLoading = true;
		filterQuery = '';
		sortBy = 'title';
		notIncludedOpen = false;
		const params = new URLSearchParams({
			parent_kind: parentKind,
			parent_id: parentId,
			import: importValue
		});
		if (passageDisplay?.trim()) params.set('passage', passageDisplay.trim());
		try {
			const res = await fetch(`/studies/import-checklist.json?${params}`);
			const data = (await res.json()) as ChecklistState & { error?: string | null };
			if (!res.ok) {
				checklist = {
					key: importValue,
					groupName: '',
					sourceLabel: '',
					copyNotes: false,
					rows: [],
					notIncludedRows: [],
					error: data.error ?? `Could not load checklist (${res.status}).`
				};
			} else {
				checklist = {
					key: data.key,
					groupName: data.groupName,
					sourceLabel: data.sourceLabel,
					copyNotes: data.copyNotes,
					rows: data.rows ?? [],
					notIncludedRows: data.notIncludedRows ?? [],
					error: data.error ?? null
				};
				if (!checkedByKey[data.key]) {
					checkedByKey = { ...checkedByKey, [data.key]: {} };
				}
			}
		} catch (e) {
			checklist = {
				key: importValue,
				groupName: '',
				sourceLabel: '',
				copyNotes: false,
				rows: [],
				notIncludedRows: [],
				error: e instanceof Error ? e.message : 'Could not load checklist.'
			};
		} finally {
			checklistLoading = false;
		}
	}

	function goImport(value: string) {
		void fetchChecklist(value);
	}

	function goBack() {
		checklist = null;
		filterQuery = '';
		sortBy = 'title';
		notIncludedOpen = false;
	}

	function closePicker() {
		open = false;
	}

	function prepareItems(event: SubmitEvent) {
		const form = event.currentTarget as HTMLFormElement;
		const input = form.querySelector('input[name="items"]') as HTMLInputElement | null;
		if (!input || !checklist) return;
		const all = [...checklist.rows, ...checklist.notIncludedRows];
		const items = all
			.filter((r) => !r.attached && checked[r.key] === true)
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
			if (result.type === 'success') {
				open = false;
				await onImported?.();
			}
		};
	};

	function setChecked(key: string, on: boolean) {
		if (!checklist) return;
		const map = { ...(checkedByKey[checklist.key] ?? {}), [key]: on };
		checkedByKey = { ...checkedByKey, [checklist.key]: map };
	}

	function selectVisible() {
		if (!checklist) return;
		const map = { ...(checkedByKey[checklist.key] ?? {}) };
		for (const key of selectableVisible) map[key] = true;
		checkedByKey = { ...checkedByKey, [checklist.key]: map };
	}

	function clearVisible() {
		if (!checklist) return;
		const map = { ...(checkedByKey[checklist.key] ?? {}) };
		for (const key of selectableVisible) map[key] = false;
		checkedByKey = { ...checkedByKey, [checklist.key]: map };
	}

	const createSetEnhance: SubmitFunction = () => {
		newSetPending = true;
		newSetMessage = null;
		return async ({ result, update }) => {
			newSetPending = false;
			await update({ reset: false });
			if (result.type === 'success' && result.data && typeof result.data === 'object') {
				const data = result.data as { setId?: string; success?: boolean };
				if (data.setId) {
					showNewSet = false;
					await invalidate('app:studies:sets');
					await invalidate(
						parentKind === 'paper'
							? `app:classwork:paper:${parentId}`
							: `app:sermons:sermon:${parentId}`
					);
					void fetchChecklist(`set:${data.setId}`);
					return;
				}
			}
			if (result.type === 'failure' && result.data && typeof result.data === 'object') {
				const data = result.data as { message?: string };
				newSetMessage = data.message ?? 'Could not create set.';
			}
		};
	};

	function setsForSection(section: ImportSetSection): SetOption[] {
		return section.sets.map((s) => ({
			id: s.id,
			name: s.name,
			bibleBook: bibleBookFromRules(s.rules)
		}));
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
			<span class="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
				>{hint}</span
			>
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
				onchange={(e) => setChecked(row.key, e.currentTarget.checked)}
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

{#snippet sectionHeader(label: string, displayLabel: string, count: number)}
	<button
		type="button"
		class="mt-4 flex w-full items-center gap-1.5 px-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground first:mt-0"
		onclick={() => toggleSection(label)}
		aria-expanded={sectionOpen(label)}
	>
		{#if sectionOpen(label)}
			<ChevronDown class="size-3.5 shrink-0" />
		{:else}
			<ChevronRight class="size-3.5 shrink-0" />
		{/if}
		<span class="min-w-0 flex-1 truncate">{displayLabel}</span>
		<span class="shrink-0 font-normal normal-case tracking-normal">{count}</span>
	</button>
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
			{#if checklistLoading}
				<p class="px-4 py-8 text-sm text-muted-foreground sm:px-5">Loading checklist…</p>
			{:else if checklist}
				{#if checklist.error}
					<p class="shrink-0 px-4 pt-3 text-sm text-destructive sm:px-5" role="alert">
						{checklist.error}
					</p>
				{/if}
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
								sortBy === 'title'
									? 'bg-muted text-foreground'
									: 'text-muted-foreground hover:text-foreground'
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
						disabled={selectableVisible.every((key) => !checked[key])}
						onclick={clearVisible}
					/>
				</div>

				<div class="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-3">
					{#if checklist.rows.length === 0 && checklist.notIncludedRows.length === 0}
						<p class="px-2 py-4 text-sm text-muted-foreground">
							Nothing to import from {checklist.sourceLabel}.
						</p>
					{:else if visibleRows.length === 0 && visibleNotIncluded.length === 0}
						<p class="px-2 py-4 text-sm text-muted-foreground">No rows match this filter.</p>
					{:else}
						{#if visibleRows.length > 0}
							<ul class="space-y-0.5">
								{#each visibleRows as row (row.key)}
									{@render checklistRow(row)}
								{/each}
							</ul>
						{/if}
						{#if checklist.notIncludedRows.length > 0}
							<button
								type="button"
								class="mt-4 flex w-full items-center gap-1.5 px-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
								onclick={() => (notIncludedOpen = !notIncludedOpen)}
								aria-expanded={notIncludedOpen}
							>
								{#if notIncludedOpen}
									<ChevronDown class="size-3.5 shrink-0" />
								{:else}
									<ChevronRight class="size-3.5 shrink-0" />
								{/if}
								Not included ({checklist.notIncludedRows.length})
							</button>
							{#if notIncludedOpen}
								<p class="px-2 pt-1 text-xs text-muted-foreground">
									Opt-in only — Select all does not include these.
								</p>
								{#if visibleNotIncluded.length === 0}
									<p class="px-2 py-2 text-sm text-muted-foreground">No matches in this filter.</p>
								{:else}
									<ul class="mt-1 space-y-0.5">
										{#each visibleNotIncluded as row (row.key)}
											{@render checklistRow(row)}
										{/each}
									</ul>
								{/if}
							{/if}
						{/if}
					{/if}
				</div>
			{:else}
				<div class="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
					{#if metaLoading}
						<p class="px-2 pb-3 text-sm text-muted-foreground">Loading sources…</p>
					{/if}
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
							{@const options = setsForSection(section)}
							{@render sectionHeader(section.label, section.displayLabel, options.length)}
							{#if sectionOpen(section.label)}
								{#if section.kind === 'bible_book'}
									{@const split = splitBibleSets(options)}
									<button
										type="button"
										class="mt-1 flex w-full items-center gap-1.5 px-2 py-1 text-left text-xs font-medium text-muted-foreground"
										onclick={() => (openOt = !openOt)}
										aria-expanded={openOt}
									>
										{#if openOt}
											<ChevronDown class="size-3 shrink-0" />
										{:else}
											<ChevronRight class="size-3 shrink-0" />
										{/if}
										Old Testament ({split.ot.length})
									</button>
									{#if openOt}
										<ul class="mt-0.5">
											{#each split.ot as set (set.id)}
												<li>{@render setButton(set, null)}</li>
											{/each}
										</ul>
									{/if}
									<button
										type="button"
										class="mt-1 flex w-full items-center gap-1.5 px-2 py-1 text-left text-xs font-medium text-muted-foreground"
										onclick={() => (openNt = !openNt)}
										aria-expanded={openNt}
									>
										{#if openNt}
											<ChevronDown class="size-3 shrink-0" />
										{:else}
											<ChevronRight class="size-3 shrink-0" />
										{/if}
										New Testament ({split.nt.length})
									</button>
									{#if openNt}
										<ul class="mt-0.5">
											{#each split.nt as set (set.id)}
												<li>{@render setButton(set, null)}</li>
											{/each}
										</ul>
									{/if}
									{#if split.other.length > 0}
										<ul class="mt-0.5">
											{#each split.other as set (set.id)}
												<li>{@render setButton(set, null)}</li>
											{/each}
										</ul>
									{/if}
								{:else}
									<ul class="mt-1">
										{#each options as set (set.id)}
											<li>{@render setButton(set, null)}</li>
										{/each}
									</ul>
								{/if}
							{/if}
						{/if}
					{/each}

					{@render sectionHeader('__prior__', 'Prior papers', importPapers.length)}
					{#if sectionOpen('__prior__')}
						{#if metaLoading}
							<p class="mt-1 px-2 text-sm text-muted-foreground">Loading papers…</p>
						{:else if importPapers.length === 0}
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
					{/if}

					{#if isOwner && importCreateSections.length > 0}
						{#if showNewSet}
							<form
								method="POST"
								action="?/createSet"
								use:enhance={createSetEnhance}
								class="mt-4 space-y-3 rounded-lg border border-border p-3"
							>
								<div>
									<Label for="import-set-section" class="text-xs uppercase tracking-wide text-muted-foreground"
										>Section</Label
									>
									<select
										id="import-set-section"
										name="section_id"
										required
										class="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
									>
										{#each importCreateSections as sec (sec.id)}
											<option value={sec.id}>{sec.name}</option>
										{/each}
									</select>
								</div>
								<div>
									<Label for="import-set-name" class="text-xs uppercase tracking-wide text-muted-foreground"
										>Name</Label
									>
									<Input
										id="import-set-name"
										name="name"
										required
										maxlength={80}
										placeholder="Set name"
										class="mt-1"
									/>
								</div>
								<div>
									<Label for="import-set-genre" class="text-xs uppercase tracking-wide text-muted-foreground"
										>Genre rule</Label
									>
									<select
										id="import-set-genre"
										name="genre"
										class="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
									>
										<option value="">No rule — add books on the set page</option>
										{#each GENRES as genre (genre)}
											<option value={genre}>{genre}</option>
										{/each}
									</select>
								</div>
								{#if newSetMessage}
									<p class="text-sm text-destructive" role="alert">{newSetMessage}</p>
								{/if}
								<div class="flex gap-2">
									<Button
										type="submit"
										size="sm"
										hotkey="s"
										label={newSetPending ? 'Saving…' : 'Save set'}
										disabled={newSetPending}
									/>
									<Button
										type="button"
										size="sm"
										variant="outline"
										hotkey="Escape"
										label="Cancel"
										onclick={() => {
											showNewSet = false;
											newSetMessage = null;
										}}
									/>
								</div>
							</form>
						{:else}
							<div class="mt-4 px-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									label="New set"
									onclick={() => (showNewSet = true)}
								/>
							</div>
						{/if}
					{/if}
				</div>
			{/if}
		</div>

		<div class="shrink-0 flex gap-2 border-t border-border bg-background px-4 py-3 sm:px-5">
			{#if checklist}
				<Button type="button" variant="outline" label="Back" onclick={goBack} />
				<form
					method="POST"
					action="?/importPaperSources"
					use:enhance={importEnhance}
					onsubmit={prepareItems}
					class="flex flex-1"
				>
					<input type="hidden" name={parentField} value={parentId} />
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

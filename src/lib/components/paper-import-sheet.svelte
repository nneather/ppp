<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import { SUGGESTION_REASON_LABELS, type ImportChecklistRow, type SetSuggestion } from '$lib/studies/import-suggest';

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
		importError = null,
		onImported
	}: {
		open?: boolean;
		paperId: string;
		parentField?: 'paper_id' | 'sermon_id';
		suggestions?: SetSuggestion[];
		importSets: { bibleBooks: SetOption[]; language: SetOption[]; custom: SetOption[] };
		importPapers?: PaperOption[];
		checklist?: {
			key: string;
			groupName: string;
			sourceLabel: string;
			copyNotes: boolean;
			rows: ImportChecklistRow[];
		} | null;
		importError?: string | null;
		onImported?: () => void | Promise<void>;
	} = $props();

	let sheetSide: 'right' | 'bottom' = $state('bottom');
	let pending = $state(false);
	let checked = $state<Record<string, boolean>>({});
	let seenKey = $state<string | null>(null);

	const selectedCount = $derived(
		(checklist?.rows ?? []).filter((r) => !r.attached && checked[r.key]).length
	);

	$effect(() => {
		if (!browser) return;
		const mq = window.matchMedia('(min-width: 768px)');
		const sync = () => {
			sheetSide = mq.matches ? 'right' : 'bottom';
		};
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});

	$effect(() => {
		const key = checklist?.key ?? null;
		const rows = checklist?.rows ?? [];
		if (key === seenKey) return;
		untrack(() => {
			seenKey = key;
			const next: Record<string, boolean> = {};
			for (const row of rows) {
				if (!row.attached) next[row.key] = true;
			}
			checked = next;
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

<Sheet.Root bind:open>
	<Sheet.Content side={sheetSide} class="flex w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
		<Sheet.Header class="shrink-0 border-b border-border pb-4">
			<Sheet.Title>{checklist ? 'Import checklist' : 'Import sources'}</Sheet.Title>
			<Sheet.Description class="text-sm text-muted-foreground">
				{#if checklist}
					Selected rows land in “{checklist.groupName}” as candidates.
					{#if checklist.copyNotes}Notes come along from the prior paper.{/if}
				{:else}
					Start from a resource set or a prior paper. Already-attached rows stay greyed.
				{/if}
			</Sheet.Description>
		</Sheet.Header>

		<div class="flex-1 overflow-y-auto px-1 py-4">
			{#if importError}
				<p class="mb-3 text-sm text-destructive" role="alert">{importError}</p>
			{/if}

			{#if checklist}
				{#if checklist.rows.length === 0}
					<p class="text-sm text-muted-foreground">Nothing to import from {checklist.sourceLabel}.</p>
				{:else}
					<ul class="space-y-1">
						{#each checklist.rows as row (row.key)}
							<li class={row.attached ? 'opacity-50' : ''}>
								<label class="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm">
									<input
										type="checkbox"
										class="mt-0.5 size-4 shrink-0"
										checked={!row.attached && checked[row.key] === true}
										disabled={row.attached}
										onchange={(e) => toggle(row.key, e.currentTarget.checked)}
									/>
									<span class="min-w-0">
										<span class="break-words">{row.title}</span>
										{#if row.attached}
											<span class="ml-1 text-xs text-muted-foreground">Attached</span>
										{/if}
										{#if row.notes}
											<span class="mt-0.5 block text-xs whitespace-pre-wrap text-muted-foreground">{row.notes}</span>
										{/if}
									</span>
								</label>
							</li>
						{/each}
					</ul>
				{/if}
			{:else}
				{#if suggestions.length > 0}
					<h3 class="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested</h3>
					<ul class="mt-1">
						{#each suggestions as s (s.id)}
							<li>
								{@render setButton(s, SUGGESTION_REASON_LABELS[s.reason])}
							</li>
						{/each}
					</ul>
				{/if}

				{#each [
					{ label: 'Bible books', sets: importSets.bibleBooks },
					{ label: 'Language', sets: importSets.language },
					{ label: 'Custom', sets: importSets.custom }
				] as section (section.label)}
					{#if section.sets.length > 0}
						<h3 class="mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							{section.label}
						</h3>
						<ul class="mt-1">
							{#each section.sets as set (set.id)}
								<li>{@render setButton(set, null)}</li>
							{/each}
						</ul>
					{/if}
				{/each}

				<h3 class="mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prior papers</h3>
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
			{/if}
		</div>

		<div class="sticky bottom-0 flex gap-2 border-t border-border bg-background px-1 pt-4 pb-1">
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
				<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={() => (open = false)} />
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>

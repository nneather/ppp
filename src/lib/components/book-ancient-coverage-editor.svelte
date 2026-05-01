<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance, deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import CanonicalizingCombobox from '$lib/components/canonicalizing-combobox.svelte';
	import type { ComboboxItem } from '$lib/components/canonicalizing-combobox.svelte';
	import type { AncientTextRow, AncientCoverageRow } from '$lib/types/library';

	/**
	 * <BookAncientCoverageEditor>
	 *
	 * Picks from the `ancient_texts` table via <CanonicalizingCombobox>,
	 * adds each pick as a `book_ancient_coverage` row for the current book,
	 * and lists the covered items as removable chips.
	 *
	 * Owner-only inline create (Session 0 A2): when `isOwner === true`, the
	 * combobox shows a "+ Create …" row; picking it opens a dialog for
	 * canonical_name + abbreviations + category, fires `?/createAncientText`
	 * via fetch+deserialize so the rest of the page state is preserved,
	 * then selects the newly-created row inline. Viewers (`isOwner === false`)
	 * never see the create affordance — RLS would reject the INSERT anyway.
	 */

	let {
		bookId,
		ancientTexts = $bindable<AncientTextRow[]>([]),
		coverage = $bindable<AncientCoverageRow[]>([]),
		isOwner
	}: {
		bookId: string;
		ancientTexts?: AncientTextRow[];
		coverage?: AncientCoverageRow[];
		isOwner: boolean;
	} = $props();

	const coveredIds = $derived(new Set(coverage.map((c) => c.ancient_text_id)));

	const items = $derived.by<ComboboxItem[]>(() =>
		ancientTexts
			.filter((a) => !coveredIds.has(a.id))
			.map((a) => ({
				id: a.id,
				canonical_name: a.canonical_name,
				abbreviations: a.abbreviations
			}))
	);

	let pickerValue = $state<string | null>(null);
	let addPending = $state(false);
	let addError = $state<string | null>(null);

	// Inline create dialog
	let createOpen = $state(false);
	let newName = $state('');
	let newAbbrev = $state('');
	let newCategory = $state('');
	let createPending = $state(false);
	let createMessage = $state<string | null>(null);

	async function addSelection() {
		if (!pickerValue || !browser) return;
		addPending = true;
		addError = null;
		try {
			const fd = new FormData();
			fd.set('source_kind', 'book');
			fd.set('book_id', bookId);
			fd.set('ancient_text_id', pickerValue);
			const resp = await fetch('?/createAncientCoverage', {
				method: 'POST',
				headers: { 'x-sveltekit-action': 'true' },
				body: fd
			});
			const result = deserialize(await resp.text()) as ActionResult;
			if (result.type === 'success' || result.type === 'failure') {
				const data = (result.data ?? {}) as { message?: string };
				if (result.type === 'failure') {
					addError = data.message ?? 'Could not add coverage.';
				} else {
					pickerValue = null;
					await invalidateAll();
				}
			}
		} catch (err) {
			addError = err instanceof Error ? err.message : 'Request failed.';
		} finally {
			addPending = false;
		}
	}

	const removeEnhance = (id: string): SubmitFunction => () => {
		// Optimistic remove
		coverage = coverage.filter((c) => c.id !== id);
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type !== 'success') {
				// invalidateAll re-hydrates on failure
			}
			await invalidateAll();
		};
	};

	function openCreate(rawText: string) {
		newName = rawText;
		newAbbrev = '';
		newCategory = '';
		createMessage = null;
		createOpen = true;
	}

	async function submitCreate() {
		if (!browser) return;
		const trimmed = newName.trim();
		if (!trimmed) {
			createMessage = 'Canonical name is required.';
			return;
		}
		createPending = true;
		createMessage = null;
		try {
			const fd = new FormData();
			fd.set('canonical_name', trimmed);
			fd.set('abbreviations', newAbbrev);
			fd.set('category', newCategory);
			const resp = await fetch('?/createAncientText', {
				method: 'POST',
				headers: { 'x-sveltekit-action': 'true' },
				body: fd
			});
			const result = deserialize(await resp.text()) as ActionResult;
			if (result.type === 'success' || result.type === 'failure') {
				const data = (result.data ?? {}) as {
					kind?: string;
					ancientText?: AncientTextRow;
					message?: string;
				};
				if (result.type === 'failure') {
					createMessage = data.message ?? 'Could not create ancient text.';
					return;
				}
				if (data.ancientText) {
					ancientTexts = [...ancientTexts, data.ancientText];
					pickerValue = data.ancientText.id;
					createOpen = false;
					await invalidateAll();
					// Immediately link this newly created row to the current book.
					await addSelection();
				}
			}
		} catch (err) {
			createMessage = err instanceof Error ? err.message : 'Request failed.';
		} finally {
			createPending = false;
		}
	}
</script>

<div class="flex flex-col gap-3">
	{#if coverage.length > 0}
		<ul class="flex flex-wrap gap-1.5">
			{#each coverage as row (row.id)}
				<li>
					<form
						method="POST"
						action="?/softDeleteAncientCoverage"
						use:enhance={removeEnhance(row.id)}
						class="contents"
					>
						<input type="hidden" name="id" value={row.id} />
						<button
							type="submit"
							class="inline-flex max-w-full items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary/15"
							aria-label={`Remove coverage for ${row.canonical_name}`}
							title={row.abbreviations.length > 0 ? row.abbreviations.join(', ') : undefined}
						>
							<span class="max-w-[18rem] truncate">{row.canonical_name}</span>
							<X class="size-3 shrink-0" />
						</button>
					</form>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-xs text-muted-foreground italic">
			No ancient-text coverage yet. Pick from the dropdown below to tag which Josephus / Philo /
			Apostolic-Fathers / etc. works this book engages.
		</p>
	{/if}

	<div class="flex flex-col gap-2 sm:flex-row sm:items-end">
		<div class="min-w-0 flex-1 space-y-1.5">
			<Label>Add ancient text</Label>
			<CanonicalizingCombobox
				bind:value={pickerValue}
				{items}
				onCreate={isOwner ? openCreate : undefined}
				showCreate={isOwner}
				placeholder="Search by canonical name or abbreviation…"
				ariaLabel="Ancient text"
			/>
		</div>
		<Button
			type="button"
			onclick={addSelection}
			disabled={!pickerValue || addPending}
			hotkey="s"
			label={addPending ? 'Adding…' : 'Add'}
		/>
	</div>

	{#if addError}
		<p class="text-xs text-destructive" role="alert">{addError}</p>
	{/if}
</div>

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Create ancient text</Dialog.Title>
			<Dialog.Description class="text-xs">
				Owner-only. Add abbreviations as a comma-separated list (e.g. `Ant., A.J., Antiquities`).
			</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-3">
			<div class="space-y-1.5">
				<Label>Canonical name <span class="text-destructive">*</span></Label>
				<Input bind:value={newName} class="h-11" placeholder="Josephus, Antiquities of the Jews" />
			</div>
			<div class="space-y-1.5">
				<Label>Abbreviations</Label>
				<Input bind:value={newAbbrev} class="h-11" placeholder="Ant., A.J., Antiquities" />
			</div>
			<div class="space-y-1.5">
				<Label>Category</Label>
				<Input
					bind:value={newCategory}
					class="h-11"
					placeholder="Josephus / Philo / Apostolic Fathers / Apocrypha / ..."
				/>
			</div>
			{#if createMessage}
				<p class="text-xs text-destructive" role="alert">{createMessage}</p>
			{/if}
		</div>
		<Dialog.Footer>
			<Button
				type="button"
				variant="outline"
				onclick={() => (createOpen = false)}
				disabled={createPending}
				hotkey="Escape"
				label="Cancel"
			/>
			<Button
				type="button"
				onclick={submitCreate}
				disabled={createPending}
				hotkey="s"
				label={createPending ? 'Creating…' : 'Create'}
			>
				<Plus class="size-4" />
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

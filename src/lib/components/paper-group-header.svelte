<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import {
		paperSourceCatalog,
		paperSourceTitle,
		type PaperGroupView,
		type PaperSourceView
	} from '$lib/studies/paper-sources';
	import BookmarkPlus from '@lucide/svelte/icons/bookmark-plus';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let {
		group,
		sources = [],
		count,
		isOwner = false,
		canMoveUp = false,
		canMoveDown = false,
		onMove,
		onDelete,
		onSaved
	}: {
		group: PaperGroupView;
		/** Catalog sources in this group — multi-select for Save as set. */
		sources?: PaperSourceView[];
		count: number;
		isOwner?: boolean;
		canMoveUp?: boolean;
		canMoveDown?: boolean;
		onMove?: (groupId: string, direction: 'up' | 'down') => void;
		onDelete?: (group: PaperGroupView) => void;
		onSaved?: () => void | Promise<void>;
	} = $props();

	let renaming = $state(false);
	let nameDraft = $state('');
	let renamePending = $state(false);
	let saveOpen = $state(false);
	let setName = $state('');
	let selectedKeys = $state<Record<string, boolean>>({});
	let saveAsSetPending = $state(false);
	let saveAsSetMessage = $state<string | null>(null);

	type SaveOption = {
		key: string;
		title: string;
		authors: string | null;
		bookId: string | null;
		essayId: string | null;
	};

	const saveOptions = $derived.by((): SaveOption[] => {
		const out: SaveOption[] = [];
		const seen = new Set<string>();
		for (const source of sources) {
			const catalog = paperSourceCatalog(source);
			const key = catalog.essayId
				? `e:${catalog.essayId}`
				: catalog.bookId
					? `b:${catalog.bookId}`
					: '';
			if (!key || seen.has(key)) continue;
			seen.add(key);
			out.push({
				key,
				title: paperSourceTitle(source),
				authors: source.authorsLabel,
				bookId: catalog.bookId,
				essayId: catalog.essayId
			});
		}
		return out;
	});

	const selectedCount = $derived(saveOptions.filter((row) => selectedKeys[row.key] === true).length);

	function openSaveAsSet() {
		setName = group.name;
		const next: Record<string, boolean> = {};
		for (const row of saveOptions) next[row.key] = true;
		selectedKeys = next;
		saveAsSetMessage = null;
		saveOpen = true;
	}

	function setRowChecked(key: string, on: boolean) {
		selectedKeys = { ...selectedKeys, [key]: on };
	}

	function selectAllSave() {
		const next = { ...selectedKeys };
		for (const row of saveOptions) next[row.key] = true;
		selectedKeys = next;
	}

	function clearSaveSelection() {
		const next = { ...selectedKeys };
		for (const row of saveOptions) next[row.key] = false;
		selectedKeys = next;
	}

	function prepareSaveItems(event: SubmitEvent) {
		const form = event.currentTarget as HTMLFormElement;
		const input = form.querySelector('input[name="items"]') as HTMLInputElement | null;
		if (!input) return;
		const items = saveOptions
			.filter((row) => selectedKeys[row.key] === true)
			.map((row) => ({ book_id: row.bookId, essay_id: row.essayId }));
		input.value = JSON.stringify(items);
	}

	function startRename() {
		nameDraft = group.name;
		renaming = true;
	}

	const renameEnhance: SubmitFunction = () => {
		renamePending = true;
		return async ({ result, update }) => {
			renamePending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				renaming = false;
				await onSaved?.();
			}
		};
	};

	const saveAsSetEnhance: SubmitFunction = () => {
		saveAsSetPending = true;
		saveAsSetMessage = null;
		return async ({ result, update }) => {
			saveAsSetPending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				saveOpen = false;
				await onSaved?.();
				return;
			}
			if (result.type === 'failure' && result.data && typeof result.data === 'object') {
				const data = result.data as { message?: string };
				saveAsSetMessage = data.message ?? 'Could not save as set.';
			}
		};
	};
</script>

{#if renaming}
	<form
		method="POST"
		action="?/renamePaperGroup"
		use:enhance={renameEnhance}
		class="flex items-center gap-2"
	>
		<input type="hidden" name="group_id" value={group.id} />
		<Input
			type="text"
			name="name"
			bind:value={nameDraft}
			required
			aria-label="Group name"
			class="h-8 max-w-56 text-sm"
		/>
		<Button
			type="submit"
			size="sm"
			hotkey="s"
			label={renamePending ? 'Saving…' : 'Save'}
			disabled={renamePending || !nameDraft.trim()}
		/>
		<Button
			type="button"
			variant="outline"
			size="sm"
			hotkey="Escape"
			label="Cancel"
			onclick={() => (renaming = false)}
		/>
	</form>
{:else}
	<div class="flex items-center justify-between gap-2">
		<h3 class="min-w-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
			<span class="break-words normal-case text-sm font-semibold text-foreground">
				{group.name}
			</span>
			<span class="ml-1 font-normal">({count})</span>
		</h3>
		{#if isOwner}
			<div class="flex shrink-0 items-center gap-0.5">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Save group as set"
					disabled={saveOptions.length === 0}
					title="Save as set"
					onclick={openSaveAsSet}
				>
					<BookmarkPlus class="size-3.5" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Move group up"
					disabled={!canMoveUp}
					onclick={() => onMove?.(group.id, 'up')}
				>
					<ChevronUp class="size-3.5" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Move group down"
					disabled={!canMoveDown}
					onclick={() => onMove?.(group.id, 'down')}
				>
					<ChevronDown class="size-3.5" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Rename group"
					onclick={startRename}
				>
					<Pencil class="size-3.5" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					class="text-destructive"
					aria-label="Delete group"
					onclick={() => onDelete?.(group)}
				>
					<Trash2 class="size-3.5" />
				</Button>
			</div>
		{/if}
	</div>
{/if}

<Dialog.Root bind:open={saveOpen}>
	<Dialog.Content class="flex max-h-[min(85dvh,560px)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
		<Dialog.Header class="shrink-0 space-y-1 border-b border-border px-4 py-4 pr-12 text-left sm:px-5">
			<Dialog.Title>Save as set</Dialog.Title>
			<Dialog.Description class="text-sm text-muted-foreground">
				Create a custom set from sources in “{group.name}”. Pick which ones to include and give the
				set a name.
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/saveGroupAsSet"
			use:enhance={saveAsSetEnhance}
			onsubmit={prepareSaveItems}
			class="flex min-h-0 flex-1 flex-col"
		>
			<input type="hidden" name="group_id" value={group.id} />
			<input type="hidden" name="items" value="[]" />
			<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
				<div>
					<Label for="save-set-name" class="text-xs uppercase tracking-wide text-muted-foreground"
						>Set name</Label
					>
					<Input
						id="save-set-name"
						name="name"
						bind:value={setName}
						required
						maxlength={80}
						placeholder="Set name"
						class="mt-1"
					/>
				</div>
				<div>
					<div class="flex items-center justify-between gap-2">
						<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Sources ({selectedCount} of {saveOptions.length})
						</p>
						<div class="flex gap-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								label="Select all"
								disabled={saveOptions.length === 0 || selectedCount === saveOptions.length}
								onclick={selectAllSave}
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								label="Clear"
								disabled={selectedCount === 0}
								onclick={clearSaveSelection}
							/>
						</div>
					</div>
					{#if saveOptions.length === 0}
						<p class="mt-2 text-sm text-muted-foreground">No catalog sources in this group.</p>
					{:else}
						<ul class="mt-2 space-y-0.5">
							{#each saveOptions as row (row.key)}
								<li>
									<label
										class="flex items-start gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-muted/40"
									>
										<input
											type="checkbox"
											class="mt-0.5 size-4 shrink-0"
											checked={selectedKeys[row.key] === true}
											onchange={(e) => setRowChecked(row.key, e.currentTarget.checked)}
										/>
										<span class="min-w-0 flex-1">
											<span class="block break-words font-medium">{row.title}</span>
											{#if row.authors}
												<span class="mt-0.5 block break-words text-xs text-muted-foreground"
													>{row.authors}</span
												>
											{/if}
										</span>
									</label>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
				{#if saveAsSetMessage}
					<p class="text-sm text-destructive" role="alert">{saveAsSetMessage}</p>
				{/if}
			</div>
			<div class="shrink-0 flex gap-2 border-t border-border px-4 py-3 sm:px-5">
				<Button
					type="button"
					variant="outline"
					hotkey="Escape"
					label="Cancel"
					onclick={() => (saveOpen = false)}
				/>
				<Button
					type="submit"
					class="flex-1"
					hotkey="s"
					label={saveAsSetPending
						? 'Saving…'
						: selectedCount === 0
							? 'Save set'
							: `Save set (${selectedCount})`}
					disabled={saveAsSetPending || selectedCount === 0 || !setName.trim()}
				/>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>

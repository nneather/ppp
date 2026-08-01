<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { PaperGroupView } from '$lib/classwork/paper-sources';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let {
		group,
		count,
		isOwner = false,
		canMoveUp = false,
		canMoveDown = false,
		onMove,
		onDelete,
		onSaved
	}: {
		group: PaperGroupView;
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

<script lang="ts">
	import type { ContactListDef } from '$lib/types/contacts';

	let {
		lists,
		selectedIds = $bindable<string[]>([])
	}: {
		lists: ContactListDef[];
		selectedIds?: string[];
	} = $props();

	const selectedSet = $derived(new Set(selectedIds));

	function toggle(listId: string, checked: boolean) {
		if (checked) {
			if (!selectedSet.has(listId)) selectedIds = [...selectedIds, listId];
			return;
		}
		selectedIds = selectedIds.filter((id) => id !== listId);
	}
</script>

{#if lists.length > 0}
	<fieldset class="space-y-2">
		<legend class="text-sm font-medium">Lists</legend>
		<p class="text-xs text-muted-foreground">
			Christmas cards should use households. Contact membership is for future email lists.
		</p>
		<ul class="space-y-1.5">
			{#each lists as list (list.id)}
				<li>
					<label class="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							name="member_list_id"
							value={list.id}
							checked={selectedSet.has(list.id)}
							onchange={(e) => toggle(list.id, e.currentTarget.checked)}
							class="size-4 rounded border-input"
						/>
						<span class="truncate">{list.name}</span>
					</label>
				</li>
			{/each}
		</ul>
	</fieldset>
{/if}

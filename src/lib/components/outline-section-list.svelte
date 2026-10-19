<script lang="ts">
	import OutlineSectionBranch from '$lib/components/outline-section-branch.svelte';
	import { buildOutlineTree, type OutlineBookSpan } from '$lib/library/outline';
	import type { OutlineSectionRow } from '$lib/types/library';

	type FormMessage = { message?: string } | null | undefined;

	let {
		sections,
		bookId,
		editingId = null,
		formMessage = null,
		spanFor,
		onEdit,
		onDelete,
		onSaved,
		onCancel
	}: {
		sections: OutlineSectionRow[];
		bookId: string;
		editingId?: string | null;
		formMessage?: FormMessage;
		spanFor: (locator: string | null) => OutlineBookSpan | null;
		onEdit: (id: string) => void;
		onDelete: (id: string) => void;
		onSaved?: () => void;
		onCancel?: () => void;
	} = $props();

	const tree = $derived(buildOutlineTree(sections));
</script>

<ul class="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
	{#each tree as node (node.id)}
		<li>
			<OutlineSectionBranch
				{node}
				depth={0}
				{bookId}
				{editingId}
				{formMessage}
				{spanFor}
				{onEdit}
				{onDelete}
				{onSaved}
				{onCancel}
			/>
		</li>
	{/each}
</ul>

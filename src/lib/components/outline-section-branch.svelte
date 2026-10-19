<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import OutlineSectionBranch from '$lib/components/outline-section-branch.svelte';
	import OutlineSectionForm from '$lib/components/outline-section-form.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { OutlineBookSpan, OutlineTreeNode } from '$lib/library/outline';
	import { cn } from '$lib/utils.js';

	type FormMessage = { message?: string } | null | undefined;

	let {
		node,
		depth,
		bookId,
		editingId = null,
		formMessage = null,
		spanFor,
		onEdit,
		onDelete,
		onSaved,
		onCancel
	}: {
		node: OutlineTreeNode;
		depth: number;
		bookId: string;
		editingId?: string | null;
		formMessage?: FormMessage;
		spanFor: (locator: string | null) => OutlineBookSpan | null;
		onEdit: (id: string) => void;
		onDelete: (id: string) => void;
		onSaved?: () => void;
		onCancel?: () => void;
	} = $props();

	let open = $state(false);

	function containsId(current: OutlineTreeNode, id: string | null): boolean {
		if (!id) return false;
		if (current.id === id) return true;
		return current.children.some((child) => containsId(child, id));
	}

	const forced = $derived(containsId(node, editingId));

	$effect(() => {
		if (forced) open = true;
	});

	const pad = $derived(depth <= 0 ? '' : depth === 1 ? 'pl-6' : 'pl-9');
	const span = $derived(spanFor(node.locator));
</script>

{#snippet title()}
	<p class="text-sm font-medium text-foreground">
		{#if node.locator}
			<span class="tabular-nums text-muted-foreground">{node.locator}</span>
			{' '}
		{/if}
		{node.label}
	</p>
{/snippet}

{#snippet pages()}
	<p class="text-xs text-muted-foreground">
		{#if span}
			pp. {span.pageStart}–{span.pageEnd} · {span.volumesLabel}
		{:else}
			pp. {node.page_start}{#if node.page_end !== node.page_start}–{node.page_end}{/if}
		{/if}
	</p>
{/snippet}

{#snippet actions()}
	<div class="flex shrink-0 gap-1">
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onclick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				onEdit(node.id);
			}}
		>
			Edit
		</Button>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="text-destructive"
			onclick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				onDelete(node.id);
			}}
		>
			Delete
		</Button>
	</div>
{/snippet}

{#snippet editor()}
	<OutlineSectionForm {bookId} existing={node} {formMessage} {onSaved} {onCancel} />
{/snippet}

{#if node.children.length > 0}
	<details bind:open>
		<summary
			class={cn(
				'flex cursor-pointer list-none items-start justify-between gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden',
				pad
			)}
		>
			<span class="flex min-w-0 items-start gap-2">
				<ChevronDown
					class={cn(
						'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200',
						open && 'rotate-180'
					)}
					aria-hidden="true"
				/>
				<span class="min-w-0">
					{@render title()}
					{@render pages()}
				</span>
			</span>
			{#if editingId !== node.id}
				{@render actions()}
			{/if}
		</summary>
		{#if editingId === node.id}
			<div class={cn('px-3 pb-3', pad)}>
				{@render editor()}
			</div>
		{/if}
		<ul class="divide-y divide-border/60 border-t border-border/60">
			{#each node.children as child (child.id)}
				<li>
					<OutlineSectionBranch
						node={child}
						depth={depth + 1}
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
	</details>
{:else}
	<div class={cn('px-3 py-2', pad)}>
		{#if editingId === node.id}
			{@render editor()}
		{:else}
			<div class="flex flex-wrap items-start justify-between gap-2">
				<div class="min-w-0">
					{@render title()}
					{@render pages()}
				</div>
				{@render actions()}
			</div>
		{/if}
	</div>
{/if}

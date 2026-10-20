<script lang="ts">
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { Button } from '$lib/components/ui/button';
	import { formatVolumePage } from '$lib/library/scripture-index';
	import { cn } from '$lib/utils.js';
	import type { ScriptureIndexRefRow } from '$lib/library/server/scripture-index-loaders';

	let {
		ref,
		highlighted = false,
		showVolume = false,
		selectable = false,
		selected = false,
		onSelectChange,
		onEdit,
		onDelete,
		compact = false
	}: {
		ref: ScriptureIndexRefRow;
		highlighted?: boolean;
		showVolume?: boolean;
		selectable?: boolean;
		selected?: boolean;
		onSelectChange?: (id: string, selected: boolean) => void;
		onEdit?: (id: string) => void;
		onDelete?: (id: string) => void;
		compact?: boolean;
	} = $props();

	function rangeOnly(): string {
		const cs = ref.chapter_start;
		const vs = ref.verse_start;
		const ce = ref.chapter_end;
		const ve = ref.verse_end;
		if (cs == null && ce == null) return '—';
		const startPart =
			cs != null && vs != null ? `${cs}:${vs}` : cs != null ? `${cs}` : '';
		const endPart =
			ce != null && ve != null ? `${ce}:${ve}` : ce != null ? `${ce}` : '';
		let rangeText = startPart;
		if (endPart && endPart !== startPart) {
			if (cs != null && ce != null && cs === ce && ve != null && ve !== vs) {
				rangeText = `${startPart}–${ve}`;
			} else {
				rangeText = `${startPart}–${endPart}`;
			}
		}
		return rangeText.trim();
	}

	const pagesLabel = $derived(
		showVolume
			? formatVolumePage(ref.volume_number, ref.page_start, ref.page_end)
			: ref.page_end && ref.page_end !== ref.page_start
				? `p. ${ref.page_start}–${ref.page_end}`
				: `p. ${ref.page_start}`
	);

	const ariaLabel = $derived(
		`${ref.bible_book} ${rangeOnly()} ${pagesLabel}`
	);
</script>

<li
	id={`ref-${ref.id}`}
	class={cn(
		'group/row flex items-center gap-2 px-3 transition-colors',
		compact ? 'min-h-9 py-1' : 'min-h-12 py-1.5 md:min-h-9',
		highlighted && 'bg-amber-500/10 ring-2 ring-amber-500/40 ring-inset',
		selected && 'bg-muted/40'
	)}
>
	{#if selectable}
		<input
			type="checkbox"
			class="size-4 shrink-0 rounded border-border"
			checked={selected}
			onchange={(e) => onSelectChange?.(ref.id, (e.currentTarget as HTMLInputElement).checked)}
			aria-label={`Select ${ariaLabel}`}
		/>
	{/if}
	<span class="shrink-0 font-medium tabular-nums text-foreground">{rangeOnly()}</span>
	<span class="shrink-0 text-muted-foreground">— {pagesLabel}</span>
	{#if ref.outline_label}
		<span
			class="min-w-0 flex-1 truncate text-xs text-muted-foreground"
			title={ref.outline_label}
		>
			{ref.outline_label}
		</span>
	{:else}
		<span class="min-w-0 flex-1"></span>
	{/if}
	{#if ref.needs_review}
		<span
			class="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200"
		>
			<AlertCircle class="size-3" /> Review
		</span>
	{/if}
	{#if onEdit || onDelete}
		<div class="ml-auto flex shrink-0 gap-0.5 opacity-70 group-hover/row:opacity-100">
			{#if onEdit}
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					class="size-9 md:size-7"
					onclick={() => onEdit(ref.id)}
					aria-label={`Edit ${ariaLabel}`}
				>
					<Pencil class="size-3.5" />
				</Button>
			{/if}
			{#if onDelete}
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					class="size-9 text-destructive hover:text-destructive md:size-7"
					onclick={() => onDelete(ref.id)}
					aria-label={`Delete ${ariaLabel}`}
				>
					<Trash2 class="size-3.5" />
				</Button>
			{/if}
		</div>
	{/if}
</li>

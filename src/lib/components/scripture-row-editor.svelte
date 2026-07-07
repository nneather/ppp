<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { cn } from '$lib/utils.js';
	import Copy from '@lucide/svelte/icons/copy';
	import X from '@lucide/svelte/icons/x';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import {
		confidenceStripClass,
		continuationNeedsBook,
		formatRowStripLabel,
		isDraftRowSaveable,
		rowShowsPageEdge,
		type ScriptureDraftRow
	} from '$lib/library/scripture-draft-row';

	let {
		row = $bindable() as ScriptureDraftRow,
		index,
		isEdit,
		bibleBookItems,
		reviewNoteOpen,
		pulsed = false,
		onOpenBiblePicker,
		onSetBibleBook,
		onDuplicate,
		onRemove,
		onToggleExpanded,
		onSetIncluded,
		onToggleReviewNote,
		onStripKeydown
	}: {
		row: ScriptureDraftRow;
		index: number;
		isEdit: boolean;
		bibleBookItems: { value: string; label: string }[];
		reviewNoteOpen: Record<string, boolean>;
		pulsed?: boolean;
		onOpenBiblePicker: () => void;
		onSetBibleBook: (value: string) => void;
		onDuplicate: () => void;
		onRemove: () => void;
		onToggleExpanded: () => void;
		onSetIncluded: (included: boolean) => void;
		onToggleReviewNote: () => void;
		onStripKeydown: (e: KeyboardEvent) => void;
	} = $props();
</script>

{#if isEdit}
	<div
		class="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3"
		aria-label={`Reference row ${index + 1}`}
	>
		<div class="flex items-center justify-between">
			<span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
				Reference
			</span>
		</div>

		<div class="grid gap-3 sm:grid-cols-[1fr_2fr]">
			<div class="space-y-2">
				<Label for={`sr-bible-${row.key}`}>
					Bible book <span class="text-destructive">*</span>
				</Label>
				<div class="sm:hidden">
					<Button
						type="button"
						id={`sr-bible-${row.key}`}
						variant="outline"
						class="h-12 min-h-11 w-full justify-between px-3 text-base font-normal"
						onclick={onOpenBiblePicker}
					>
						<span class="truncate text-left">
							{row.bible_book.length > 0 ? row.bible_book : '— Pick a book —'}
						</span>
					</Button>
				</div>
				<div class="hidden sm:block">
					<Select.Root
						type="single"
						value={row.bible_book}
						onValueChange={(v) => onSetBibleBook(v ?? '')}
						items={bibleBookItems}
					>
						<Select.Trigger
							id={`sr-bible-dsk-${row.key}`}
							size="default"
							class="h-11 w-full justify-between px-3"
						>
							<span data-slot="select-value" class="truncate text-left">
								{row.bible_book.length > 0 ? row.bible_book : '— Pick a book —'}
							</span>
						</Select.Trigger>
						<Select.Content class="max-h-72">
							{#each bibleBookItems as b (b.value)}
								<Select.Item value={b.value} label={b.label} class="min-h-10 py-2">
									{b.label}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-2">
				<div class="space-y-1">
					<Label for={`sr-cs-${row.key}`} class="text-xs">Chapter</Label>
					<Input
						id={`sr-cs-${row.key}`}
						type="number"
						inputmode="numeric"
						min="0"
						max="199"
						bind:value={row.chapter_start}
						class="h-12 min-h-11 text-base tabular-nums sm:h-11"
					/>
				</div>
				<div class="space-y-1">
					<Label for={`sr-vs-${row.key}`} class="text-xs">Verse</Label>
					<Input
						id={`sr-vs-${row.key}`}
						type="number"
						inputmode="numeric"
						min="0"
						max="999"
						bind:value={row.verse_start}
						class="h-12 min-h-11 text-base tabular-nums sm:h-11"
					/>
				</div>
				<div class="space-y-1">
					<Label for={`sr-ce-${row.key}`} class="text-xs">to Ch.</Label>
					<Input
						id={`sr-ce-${row.key}`}
						type="number"
						inputmode="numeric"
						min="0"
						max="199"
						bind:value={row.chapter_end}
						class="h-12 min-h-11 text-base tabular-nums sm:h-11"
					/>
				</div>
				<div class="space-y-1">
					<Label for={`sr-ve-${row.key}`} class="text-xs">to Vs.</Label>
					<Input
						id={`sr-ve-${row.key}`}
						type="number"
						inputmode="numeric"
						min="0"
						max="999"
						bind:value={row.verse_end}
						class="h-12 min-h-11 text-base tabular-nums sm:h-11"
					/>
				</div>
			</div>
		</div>

		<div class="grid gap-3 sm:grid-cols-2">
			<div class="space-y-1">
				<Label for={`sr-ps-${row.key}`} class="text-xs">
					Page start <span class="text-destructive">*</span>
				</Label>
				<Input
					id={`sr-ps-${row.key}`}
					bind:value={row.page_start}
					placeholder="e.g. 317, IV.317, xiv"
					class="h-12 min-h-11 text-base sm:h-11"
				/>
			</div>
			<div class="space-y-1">
				<Label for={`sr-pe-${row.key}`} class="text-xs">Page end</Label>
				<Input
					id={`sr-pe-${row.key}`}
					bind:value={row.page_end}
					placeholder="(blank for single page)"
					class="h-12 min-h-11 text-base sm:h-11"
				/>
			</div>
		</div>

		<div class="space-y-2">
			<label class="flex items-center gap-2 text-xs">
				<input type="checkbox" bind:checked={row.needs_review} class="size-4" />
				<span>Needs review</span>
			</label>
			{#if row.needs_review}
				<textarea
					bind:value={row.review_note}
					rows={2}
					class="flex min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
					placeholder="Why does this need review?"
				></textarea>
			{/if}
		</div>
	</div>
{:else}
	{#if !row.expanded}
		<div
			class={cn(
				'flex min-h-11 items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-2 py-1 sm:hidden',
				rowShowsPageEdge(row) && 'border-l-2 border-l-amber-400/60',
				pulsed && 'bg-emerald-500/15 ring-1 ring-emerald-500/40',
				continuationNeedsBook(row) && 'border-amber-500/50 bg-amber-500/10'
			)}
			aria-label={`Reference row ${index + 1} (compact)`}
		>
			<input
				type="checkbox"
				class="size-4 shrink-0 max-md:h-11 max-md:w-11"
				checked={row.included}
				disabled={!isDraftRowSaveable(row)}
				aria-label="Include in save"
				onchange={(e) => onSetIncluded((e.currentTarget as HTMLInputElement).checked)}
			/>
			<button
				type="button"
				class="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
				onclick={onToggleExpanded}
				onkeydown={onStripKeydown}
			>
				<span class="min-w-0 flex-1 truncate font-medium text-foreground">
					{formatRowStripLabel(row)}
				</span>
				{#if row.confidence_score != null}
					<span class={cn('shrink-0 text-xs tabular-nums', confidenceStripClass(row.confidence_score))}>
						{Math.round(row.confidence_score * 100)}%
					</span>
				{/if}
			</button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class="size-9 shrink-0"
				aria-label="Expand row"
				onclick={onToggleExpanded}
			>
				<ChevronDown class="size-4" />
			</Button>
		</div>
		<div
			class={cn(
				'hidden min-h-9 items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-2 py-1 sm:flex',
				rowShowsPageEdge(row) && 'border-l-2 border-l-amber-400/60',
				pulsed && 'bg-emerald-500/15 ring-1 ring-emerald-500/40',
				continuationNeedsBook(row) && 'border-amber-500/50 bg-amber-500/10'
			)}
			aria-label={`Reference row ${index + 1} (compact)`}
		>
			<input
				type="checkbox"
				class="size-3.5 shrink-0"
				checked={row.included}
				disabled={!isDraftRowSaveable(row)}
				aria-label="Include in save"
				onchange={(e) => onSetIncluded((e.currentTarget as HTMLInputElement).checked)}
			/>
			<button
				type="button"
				class="flex min-w-0 flex-1 items-center gap-2 text-left text-xs"
				onclick={onToggleExpanded}
				onkeydown={onStripKeydown}
			>
				<span class="min-w-0 flex-1 truncate">{formatRowStripLabel(row)}</span>
				{#if row.confidence_score != null}
					<span class={cn('shrink-0 tabular-nums', confidenceStripClass(row.confidence_score))}>
						{Math.round(row.confidence_score * 100)}%
					</span>
				{/if}
			</button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class="size-8 shrink-0"
				aria-label="Expand row"
				onclick={onToggleExpanded}
			>
				<ChevronDown class="size-3.5" />
			</Button>
		</div>
	{/if}
	{#if row.expanded}
		<!-- Mobile: card -->
		<div
			class={cn(
				'flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 sm:hidden',
				rowShowsPageEdge(row) && 'border-l-2 border-l-amber-400/60',
				continuationNeedsBook(row) && 'border-amber-500/50 bg-amber-500/10'
			)}
			aria-label={`Reference row ${index + 1}`}
		>
			<div class="flex items-center justify-between">
				<span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
					Row {index + 1}
				</span>
				<div class="flex gap-1">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onclick={onToggleExpanded}
						aria-label="Collapse row"
					>
						<ChevronUp class="size-3.5" /> Collapse
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onclick={onDuplicate}
						aria-label="Duplicate row"
					>
						<Copy class="size-3.5" /> Duplicate
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onclick={onRemove}
						aria-label="Remove row"
						class="text-destructive hover:text-destructive"
					>
						<X class="size-3.5" />
					</Button>
				</div>
			</div>
			{#if continuationNeedsBook(row)}
				<p class="text-xs font-medium text-amber-900 dark:text-amber-200">
					Choose the Bible book — this line continues from the previous page.
				</p>
			{/if}

			<div class="grid gap-3 sm:grid-cols-[1fr_2fr]">
				<div class="space-y-2">
					<Label for={`sr-bible-m-${row.key}`}>
						Bible book <span class="text-destructive">*</span>
					</Label>
					<Button
						type="button"
						id={`sr-bible-m-${row.key}`}
						variant="outline"
						class={cn(
							'h-12 min-h-11 w-full justify-between px-3 text-base font-normal',
							continuationNeedsBook(row) &&
								'border-destructive/40 bg-destructive/5 text-destructive'
						)}
						onclick={onOpenBiblePicker}
					>
						<span class="truncate text-left">
							{continuationNeedsBook(row)
								? 'Choose book — continues from previous page'
								: row.bible_book.length > 0
									? row.bible_book
									: '— Pick a book —'}
						</span>
					</Button>
				</div>

				<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-2">
					<div class="space-y-1">
						<Label for={`sr-cs-m-${row.key}`} class="text-xs">Chapter</Label>
						<Input
							id={`sr-cs-m-${row.key}`}
							type="number"
							inputmode="numeric"
							min="0"
							max="199"
							bind:value={row.chapter_start}
							class="h-12 min-h-11 text-base tabular-nums sm:h-11"
						/>
					</div>
					<div class="space-y-1">
						<Label for={`sr-vs-m-${row.key}`} class="text-xs">Verse</Label>
						<Input
							id={`sr-vs-m-${row.key}`}
							type="number"
							inputmode="numeric"
							min="0"
							max="999"
							bind:value={row.verse_start}
							class="h-12 min-h-11 text-base tabular-nums sm:h-11"
						/>
					</div>
					<div class="space-y-1">
						<Label for={`sr-ce-m-${row.key}`} class="text-xs">to Ch.</Label>
						<Input
							id={`sr-ce-m-${row.key}`}
							type="number"
							inputmode="numeric"
							min="0"
							max="199"
							bind:value={row.chapter_end}
							class="h-12 min-h-11 text-base tabular-nums sm:h-11"
						/>
					</div>
					<div class="space-y-1">
						<Label for={`sr-ve-m-${row.key}`} class="text-xs">to Vs.</Label>
						<Input
							id={`sr-ve-m-${row.key}`}
							type="number"
							inputmode="numeric"
							min="0"
							max="999"
							bind:value={row.verse_end}
							class="h-12 min-h-11 text-base tabular-nums sm:h-11"
						/>
					</div>
				</div>
			</div>

			<div class="grid gap-3 sm:grid-cols-2">
				<div class="space-y-1">
					<Label for={`sr-ps-m-${row.key}`} class="text-xs">
						Page start <span class="text-destructive">*</span>
					</Label>
					<Input
						id={`sr-ps-m-${row.key}`}
						bind:value={row.page_start}
						placeholder="e.g. 317, IV.317, xiv"
						class="h-12 min-h-11 text-base sm:h-11"
					/>
				</div>
				<div class="space-y-1">
					<Label for={`sr-pe-m-${row.key}`} class="text-xs">Page end</Label>
					<Input
						id={`sr-pe-m-${row.key}`}
						bind:value={row.page_end}
						placeholder="(blank for single page)"
						class="h-12 min-h-11 text-base sm:h-11"
					/>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2 text-xs">
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						class="size-4"
						checked={row.included}
						disabled={!isDraftRowSaveable(row)}
						aria-label="Include in save"
						onchange={(e) => onSetIncluded((e.currentTarget as HTMLInputElement).checked)}
					/>
					<span>Include in save</span>
				</label>
				<label class="flex items-center gap-2">
					<input type="checkbox" bind:checked={row.needs_review} class="size-4" />
					<span>Needs review</span>
				</label>
				{#if row.needs_review}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="h-8 px-2"
						onclick={onToggleReviewNote}
						aria-expanded={reviewNoteOpen[row.key] === true}
						aria-label="Edit review note"
					>
						<MessageSquare class="size-3.5" />
						Note
					</Button>
				{/if}
			</div>
			{#if row.needs_review && reviewNoteOpen[row.key]}
				<textarea
					bind:value={row.review_note}
					rows={2}
					class="flex min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
					placeholder="Why does this need review?"
				></textarea>
			{/if}
		</div>

		<!-- Desktop: compact grid -->
		<div class="hidden sm:block">
			<div
				class={cn(
					'min-w-[48rem] rounded-lg border border-border/70 bg-muted/20 px-2 py-1.5',
					rowShowsPageEdge(row) && 'border-l-2 border-l-amber-400/60',
					continuationNeedsBook(row) && 'border-amber-500/50 bg-amber-500/10'
				)}
			>
				<div
					class="grid grid-cols-[minmax(8rem,10rem)_3.5rem_3.5rem_1.25rem_3.5rem_3.5rem_7rem_7rem_auto_minmax(6rem,1fr)] items-center gap-1"
				>
					<div class="min-w-0">
						{#if continuationNeedsBook(row)}
							<Button
								type="button"
								variant="outline"
								size="sm"
								class="h-8 w-full border-destructive/40 bg-destructive/5 px-2 text-xs text-destructive"
								onclick={onOpenBiblePicker}
							>
								<span class="line-clamp-2 text-left leading-tight">
									Choose book — continues from previous page
								</span>
							</Button>
						{:else}
							<Select.Root
								type="single"
								value={row.bible_book}
								onValueChange={(v) => onSetBibleBook(v ?? '')}
								items={bibleBookItems}
							>
								<Select.Trigger
									size="sm"
									class="h-8 w-full min-w-0 justify-between px-2 text-xs"
									aria-label="Bible book"
								>
									<span data-slot="select-value" class="truncate text-left">
										{row.bible_book.length > 0 ? row.bible_book : 'Book'}
									</span>
								</Select.Trigger>
								<Select.Content class="max-h-72">
									{#each bibleBookItems as b (b.value)}
										<Select.Item value={b.value} label={b.label} class="min-h-8 py-1 text-sm">
											{b.label}
										</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						{/if}
					</div>
					<Input
						id={`sr-cs-d-${row.key}`}
						type="number"
						inputmode="numeric"
						min="0"
						max="199"
						bind:value={row.chapter_start}
						class="h-8 min-w-0 px-2 text-xs tabular-nums"
						aria-label="Chapter start"
					/>
					<Input
						id={`sr-vs-d-${row.key}`}
						type="number"
						inputmode="numeric"
						min="0"
						max="999"
						bind:value={row.verse_start}
						class="h-8 min-w-0 px-2 text-xs tabular-nums"
						aria-label="Verse start"
					/>
					<span class="text-center text-xs text-muted-foreground">–</span>
					<Input
						id={`sr-ce-d-${row.key}`}
						type="number"
						inputmode="numeric"
						min="0"
						max="199"
						bind:value={row.chapter_end}
						class="h-8 min-w-0 px-2 text-xs tabular-nums"
						aria-label="Chapter end"
					/>
					<Input
						id={`sr-ve-d-${row.key}`}
						type="number"
						inputmode="numeric"
						min="0"
						max="999"
						bind:value={row.verse_end}
						class="h-8 min-w-0 px-2 text-xs tabular-nums"
						aria-label="Verse end"
					/>
					<Input
						id={`sr-ps-d-${row.key}`}
						bind:value={row.page_start}
						placeholder="Page"
						class="h-8 min-w-0 px-2 text-xs"
						aria-label="Page start"
					/>
					<Input
						id={`sr-pe-d-${row.key}`}
						bind:value={row.page_end}
						placeholder="End"
						class="h-8 min-w-0 px-2 text-xs"
						aria-label="Page end"
					/>
					<label class="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
						<input type="checkbox" bind:checked={row.needs_review} class="size-3.5" aria-label="Needs review" />
						<span class="hidden xl:inline">Review</span>
					</label>
					<div class="flex justify-center gap-0.5">
						{#if row.needs_review}
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								class="size-8"
								onclick={onToggleReviewNote}
								aria-label="Review note"
							>
								<MessageSquare class="size-3.5" />
							</Button>
						{:else}
							<span class="size-8"></span>
						{/if}
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							class="size-8"
							onclick={onDuplicate}
							aria-label="Duplicate row"
						>
							<Copy class="size-3.5" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							class="size-8 text-destructive hover:text-destructive"
							onclick={onRemove}
							aria-label="Remove row"
						>
							<X class="size-3.5" />
						</Button>
					</div>
				</div>
				{#if row.needs_review && reviewNoteOpen[row.key]}
					<textarea
						bind:value={row.review_note}
						rows={2}
						class="mt-2 min-h-14 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
						placeholder="Why does this need review?"
					></textarea>
				{/if}
			</div>
		</div>
	{/if}
{/if}

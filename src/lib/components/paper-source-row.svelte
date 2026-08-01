<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import {
		copyCitationToClipboard,
		formatBibliography,
		formatEssayBibliography,
		formatEssayFootnote,
		formatFootnote,
		type CitationFormatted
	} from '$lib/library/turabian';
	import { paperSourceTitle, type PaperSourceView } from '$lib/classwork/paper-sources';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let {
		source,
		isOwner = false,
		onCopied,
		onRemove,
		onSaved
	}: {
		source: PaperSourceView;
		isOwner?: boolean;
		onCopied?: (message: string) => void;
		onRemove?: (source: PaperSourceView) => void;
		onSaved?: () => void | Promise<void>;
	} = $props();

	let page = $state('');
	let editingNotes = $state(false);
	let notesDraft = $state('');
	let notesPending = $state(false);

	const pageOpts = $derived({ page: page.trim() || undefined });

	const footnote = $derived(
		source.kind === 'book'
			? formatFootnote(source.citation, pageOpts)
			: formatEssayFootnote(source.essay, source.volume, pageOpts)
	);
	const shortForm = $derived(
		source.kind === 'book'
			? formatFootnote(source.citation, { ...pageOpts, shortForm: 'short' })
			: formatEssayFootnote(source.essay, source.volume, { ...pageOpts, shortForm: 'short' })
	);
	const bibliography = $derived(
		source.kind === 'book'
			? formatBibliography(source.citation)
			: formatEssayBibliography(source.essay, source.volume)
	);

	const title = $derived(paperSourceTitle(source));
	const href = $derived(
		source.kind === 'book'
			? `/library/books/${source.citation.id}`
			: `/library/books/${source.parentBookId}#essay-${source.essayId}`
	);
	const notOwned = $derived(source.kind === 'book' ? !source.owned : !source.parentOwned);

	async function copy(formatted: CitationFormatted, label: string) {
		if (!formatted.plain) {
			onCopied?.(`No ${label.toLowerCase()} for this source`);
			return;
		}
		try {
			await copyCitationToClipboard(formatted);
			onCopied?.(`${label} copied`);
		} catch (e) {
			onCopied?.(e instanceof Error ? e.message : 'Copy failed');
		}
	}

	function startEditNotes() {
		notesDraft = source.notes ?? '';
		editingNotes = true;
	}

	const notesEnhance: SubmitFunction = () => {
		notesPending = true;
		return async ({ result, update }) => {
			notesPending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				editingNotes = false;
				await onSaved?.();
			}
		};
	};
</script>

<li class="rounded-lg border border-border px-3 py-2.5">
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<p class="text-sm font-medium break-words">
				<a href={href} class="hover:underline">{title}</a>
			</p>
			<p class="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
				{#if source.authorsLabel}
					<span>{source.authorsLabel}</span>
					<span aria-hidden="true">·</span>
				{/if}
				{#if source.kind === 'essay'}
					<span>in <span class="italic">{source.volume.title ?? '(untitled)'}</span></span>
					<span aria-hidden="true">·</span>
				{/if}
				<Badge variant="outline" class="px-1.5 py-0 text-[10px] uppercase tracking-wide">
					{source.kind === 'book' ? 'Book' : 'Essay'}
				</Badge>
				{#if notOwned}
					<Badge variant="secondary" class="px-1.5 py-0 text-[10px]">Not owned</Badge>
				{/if}
			</p>
		</div>
		{#if isOwner}
			<div class="flex shrink-0 gap-1">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Edit research note"
					onclick={startEditNotes}
				>
					<NotebookPen class="size-3.5" />
				</Button>
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					class="text-destructive"
					aria-label="Remove source"
					onclick={() => onRemove?.(source)}
				>
					<Trash2 class="size-3.5" />
				</Button>
			</div>
		{/if}
	</div>

	<div class="mt-2 flex flex-wrap items-center gap-1.5">
		<Input
			type="text"
			inputmode="numeric"
			bind:value={page}
			placeholder="page"
			aria-label="Page for footnote"
			class="h-8 w-20 text-xs"
		/>
		<div class="inline-flex overflow-hidden rounded-md border border-border">
			<button
				type="button"
				class="px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
				onclick={() => copy(footnote, 'Footnote')}
			>
				Footnote
			</button>
			<button
				type="button"
				class="border-l border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
				onclick={() => copy(shortForm, 'Short form')}
			>
				Short
			</button>
			<button
				type="button"
				class="border-l border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
				onclick={() => copy(bibliography, 'Bibliography')}
			>
				Bib
			</button>
		</div>
	</div>

	{#if editingNotes}
		<form
			method="POST"
			action="?/updatePaperSourceNotes"
			use:enhance={notesEnhance}
			class="mt-2 space-y-2"
		>
			<input type="hidden" name="source_id" value={source.sourceId} />
			<textarea
				name="notes"
				bind:value={notesDraft}
				rows={3}
				placeholder="Paper-specific research note (argument, key pages, where it fits)…"
				class="flex min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			></textarea>
			<div class="flex gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					hotkey="Escape"
					label="Cancel"
					onclick={() => (editingNotes = false)}
				/>
				<Button
					type="submit"
					size="sm"
					hotkey="s"
					label={notesPending ? 'Saving…' : 'Save note'}
					disabled={notesPending}
				/>
			</div>
		</form>
	{:else if source.notes}
		<p class="mt-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs whitespace-pre-wrap text-muted-foreground">
			{source.notes}
		</p>
	{/if}
</li>

<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { copyCitationToClipboard, type CitationFormatted } from '$lib/library/turabian';
	import {
		paperSourceTitle,
		type PaperGroupView,
		type PaperSourceView
	} from '$lib/classwork/paper-sources';
	import {
		studySourceBibliography,
		studySourceFootnote,
		studySourceShortForm
	} from '$lib/studies/source-citation';
	import { nextStudyUsage, STUDY_USAGE_LABELS } from '$lib/studies/source-usage';
	import { untrack } from 'svelte';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let {
		source,
		groups = [],
		isOwner = false,
		onCopied,
		onRemove,
		onRemoveFromSet,
		originSetId = null,
		footnotePage = '',
		onSaved
	}: {
		source: PaperSourceView;
		/** Live research groups — when non-empty, owners get a group selector. */
		groups?: PaperGroupView[];
		isOwner?: boolean;
		/** Set whose name matches this source's research group. */
		originSetId?: string | null;
		/** Tightest overlapping passage-section pages. The user can type over it. */
		footnotePage?: string;
		onCopied?: (message: string) => void;
		onRemove?: (source: PaperSourceView) => void;
		onRemoveFromSet?: (source: PaperSourceView, setId: string) => void;
		onSaved?: () => void | Promise<void>;
	} = $props();

	let page = $state(untrack(() => footnotePage));
	let pageTouched = $state(false);

	$effect(() => {
		const seed = footnotePage;
		if (pageTouched) return;
		untrack(() => {
			page = seed;
		});
	});
	let editingNotes = $state(false);
	let notesDraft = $state('');
	let notesPending = $state(false);
	let groupFormEl = $state<HTMLFormElement | null>(null);
	let groupPending = $state(false);
	let usagePending = $state(false);

	const pageOpts = $derived({ page: page.trim() || undefined });

	const footnote = $derived(studySourceFootnote(source, pageOpts.page));
	const shortForm = $derived(studySourceShortForm(source, pageOpts.page));
	const bibliography = $derived(studySourceBibliography(source));

	const title = $derived(paperSourceTitle(source));
	const href = $derived(
		source.kind === 'book'
			? `/library/books/${source.citation.id}`
			: source.kind === 'essay'
				? `/library/books/${source.parentBookId}#essay-${source.essayId}`
				: null
	);
	const notOwned = $derived(
		source.kind === 'book' ? !source.owned : source.kind === 'essay' ? !source.parentOwned : false
	);

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

	const groupEnhance: SubmitFunction = () => {
		groupPending = true;
		return async ({ result, update }) => {
			groupPending = false;
			await update({ reset: false });
			if (result.type === 'success') await onSaved?.();
		};
	};

	const usageEnhance: SubmitFunction = () => {
		usagePending = true;
		return async ({ result, update }) => {
			usagePending = false;
			await update({ reset: false });
			if (result.type === 'success') await onSaved?.();
		};
	};
</script>

<li class="rounded-lg border border-border px-3 py-2.5">
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<p class="text-sm font-medium break-words">
				{#if href}
					<a href={href} class="hover:underline">{title}</a>
				{:else}
					{title}
				{/if}
			</p>
			<div class="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
				{#if source.authorsLabel}
					<span>{source.authorsLabel}</span>
					<span aria-hidden="true">·</span>
				{/if}
				{#if source.kind === 'essay'}
					<span>in <span class="italic">{source.volume.title ?? '(untitled)'}</span></span>
					<span aria-hidden="true">·</span>
				{:else if source.kind === 'article'}
					<span class="italic">{source.article.journal_title}</span>
					<span aria-hidden="true">·</span>
				{/if}
				<Badge variant="outline" class="px-1.5 py-0 text-[10px] uppercase tracking-wide">
					{source.kind === 'book' ? 'Book' : source.kind === 'essay' ? 'Essay' : 'Article'}
				</Badge>
				{#if notOwned}
					<Badge variant="secondary" class="px-1.5 py-0 text-[10px]">Not owned</Badge>
				{/if}
				{#if isOwner}
					<form method="POST" action="?/setPaperSourceUsage" use:enhance={usageEnhance}>
						<input type="hidden" name="source_id" value={source.sourceId} />
						<input type="hidden" name="usage" value={nextStudyUsage(source.usage)} />
						<button
							type="submit"
							class="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted/70 hover:text-foreground disabled:opacity-50"
							disabled={usagePending}
							aria-label={`Usage ${STUDY_USAGE_LABELS[source.usage]}. Next: ${STUDY_USAGE_LABELS[nextStudyUsage(source.usage)]}`}
						>
							{STUDY_USAGE_LABELS[source.usage]}
						</button>
					</form>
				{:else}
					<span class="text-[10px] font-medium uppercase tracking-wide">{STUDY_USAGE_LABELS[source.usage]}</span>
				{/if}
			</div>
		</div>
		{#if isOwner}
			<div class="flex shrink-0 items-center gap-1">
				{#if originSetId}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="h-8 px-2 text-xs text-muted-foreground"
						aria-label="Remove from set"
						onclick={() => onRemoveFromSet?.(source, originSetId)}
					>
						From set
					</Button>
				{/if}
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
					aria-label="Remove from study"
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
			inputmode="text"
			bind:value={page}
			placeholder="page"
			aria-label="Page for footnote"
			class="h-8 w-28 text-xs"
			oninput={() => (pageTouched = true)}
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
		{#if isOwner && groups.length > 0}
			<form
				bind:this={groupFormEl}
				method="POST"
				action="?/setPaperSourceGroup"
				use:enhance={groupEnhance}
				class="ml-auto"
			>
				<input type="hidden" name="source_id" value={source.sourceId} />
				<select
					name="group_id"
					value={source.groupId ?? ''}
					disabled={groupPending}
					aria-label="Research group"
					class="h-8 max-w-40 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
					onchange={() => groupFormEl?.requestSubmit()}
				>
					<option value="">Ungrouped</option>
					{#each groups as g (g.id)}
						<option value={g.id}>{g.name}</option>
					{/each}
				</select>
			</form>
		{/if}
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

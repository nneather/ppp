<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { copyCitationToClipboard } from '$lib/library/turabian';
	import { studySourceFootnote } from '$lib/studies/source-citation';
	import type { PaperSourceView } from '$lib/studies/paper-sources';
	import type { StudyNoteView } from '$lib/studies/study-note';

	let {
		note,
		shortName = null,
		source = null,
		isOwner = false,
		showSource = true,
		attachChoices = [],
		onChanged,
		onCopied
	}: {
		note: StudyNoteView;
		shortName?: string | null;
		source?: PaperSourceView | null;
		isOwner?: boolean;
		showSource?: boolean;
		attachChoices?: { sourceId: string; label: string }[];
		onChanged?: () => void | Promise<void>;
		onCopied?: (message: string) => void;
	} = $props();

	let editing = $state(false);
	let body = $state('');
	let page = $state('');
	let pending = $state(false);
	let deleteOpen = $state(false);
	let citeFormEl = $state<HTMLFormElement | null>(null);
	let deleteFormEl = $state<HTMLFormElement | null>(null);
	let attachFormEl = $state<HTMLFormElement | null>(null);

	const saved: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false, invalidateAll: false });
			if (result.type === 'success') {
				editing = false;
				deleteOpen = false;
				await onChanged?.();
			}
		};
	};

	async function cite() {
		if (!source) return;
		try {
			await copyCitationToClipboard(studySourceFootnote(source, note.page ?? undefined));
			onCopied?.('Footnote copied');
			citeFormEl?.requestSubmit();
		} catch (e) {
			onCopied?.(e instanceof Error ? e.message : 'Copy failed');
		}
	}
</script>

<li class="rounded-lg border border-border px-3 py-2.5">
	{#if showSource || note.page || note.passageDisplay}
		<p class="text-xs text-muted-foreground">
			{#if showSource}{shortName ?? 'Unattached'}{/if}
			{#if note.page}
				{#if showSource}<span aria-hidden="true"> · </span>{/if}{note.page}
			{/if}
			{#if note.passageDisplay}
				<span aria-hidden="true"> · </span>{note.passageDisplay}
			{/if}
		</p>
	{/if}

	{#if editing}
		<form method="POST" action="?/updateStudyNote" use:enhance={saved} class="mt-1 space-y-2">
			<input type="hidden" name="note_id" value={note.id} />
			<input type="hidden" name="page" value={page} />
			<input type="hidden" name="passage_display" value={note.passageDisplay ?? ''} />
			<input type="hidden" name="bible_book" value={note.bibleBook ?? ''} />
			<input type="hidden" name="chapter" value={note.chapter ?? ''} />
			<input type="hidden" name="verse_start" value={note.verseStart ?? ''} />
			<input type="hidden" name="verse_end" value={note.verseEnd ?? ''} />
			<textarea
				name="body"
				bind:value={body}
				rows="3"
				class="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			></textarea>
			<div class="flex gap-2">
				<Button type="button" variant="outline" size="sm" hotkey="Escape" label="Cancel" onclick={() => (editing = false)} />
				<Button type="submit" size="sm" variant="outline" label={pending ? 'Saving…' : 'Save'} disabled={pending || !body.trim()} />
			</div>
		</form>
	{:else}
		<p class="mt-0.5 text-sm whitespace-pre-wrap">{note.body}</p>
	{/if}

	{#if isOwner && !editing}
		<div class="mt-2 flex flex-wrap items-center gap-1.5">
			{#if source}
				<button type="button" class="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted/80" onclick={cite}>
					Cite
				</button>
			{/if}
			<button
				type="button"
				class="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground"
				onclick={() => {
					body = note.body;
					page = note.page ?? '';
					editing = true;
				}}
			>
				Edit
			</button>
			<button
				type="button"
				class="rounded-md px-2 py-1 text-xs text-destructive hover:bg-muted/80"
				onclick={() => (deleteOpen = true)}
			>
				Delete
			</button>
			{#if !note.sourceId && attachChoices.length > 0}
				<form method="POST" action="?/attachStudyNoteSource" use:enhance={saved} bind:this={attachFormEl}>
					<input type="hidden" name="note_id" value={note.id} />
					<select
						name="source_id"
						aria-label="Attach note to a source"
						class="h-7 max-w-48 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground"
						onchange={() => attachFormEl?.requestSubmit()}
					>
						<option value="">Attach to…</option>
						{#each attachChoices as choice (choice.sourceId)}
							<option value={choice.sourceId}>{choice.label}</option>
						{/each}
					</select>
				</form>
			{/if}
		</div>
	{/if}
</li>

<form method="POST" action="?/markSourceCited" use:enhance={saved} bind:this={citeFormEl} class="hidden">
	<input type="hidden" name="source_id" value={source?.sourceId ?? ''} />
</form>
<form method="POST" action="?/softDeleteStudyNote" use:enhance={saved} bind:this={deleteFormEl} class="hidden">
	<input type="hidden" name="note_id" value={note.id} />
</form>
{#if deleteOpen}
	<ConfirmDialog
		bind:open={deleteOpen}
		title="Delete note?"
		description="This removes the note from the study. The source stays attached."
		confirmLabel="Delete"
		pending={pending}
		onConfirm={() => deleteFormEl?.requestSubmit()}
	/>
{/if}

<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { tick, untrack } from 'svelte';
	import StudyNoteRow from '$lib/components/study-note-row.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		captureSourceFromView,
		captureSourcesFromView,
		interpretNoteCapture,
		type InterpretedNote
	} from '$lib/studies/note-capture';
	import { paperSourceTitle, type PaperSourceView } from '$lib/studies/paper-sources';
	import { loadReadingNow, readingNowPage, saveReadingNow } from '$lib/studies/reading-now';
	import type { StudyNoteView } from '$lib/studies/study-note';

	let {
		parentKind,
		parentId,
		sources,
		notes,
		isOwner,
		primaryBibleBook = null,
		readingSourceId = $bindable<string | null>(null),
		invalidateKey: _invalidateKey,
		form,
		onChanged
	}: {
		parentKind: 'paper' | 'sermon';
		parentId: string;
		sources: PaperSourceView[];
		notes: StudyNoteView[];
		isOwner: boolean;
		primaryBibleBook?: string | null;
		readingSourceId?: string | null;
		invalidateKey: string;
		form: { kind?: string; message?: string; success?: boolean } | null;
		onChanged?: () => void | Promise<void>;
	} = $props();

	let line = $state('');
	let pending = $state(false);
	let hydratedFor = $state<string | null>(null);
	let pages = $state<Record<string, string>>({});
	let ambiguity = $state<InterpretedNote | null>(null);
	let copyToast = $state<string | null>(null);
	let formEl = $state<HTMLFormElement | null>(null);

	let sourceId = $state('');
	let page = $state('');
	let body = $state('');
	let passageDisplay = $state('');
	let bibleBook = $state('');
	let chapter = $state('');
	let verseStart = $state('');
	let verseEnd = $state('');

	const parentField = $derived(parentKind === 'paper' ? 'paper_id' : 'sermon_id');
	const captureSources = $derived(sources.flatMap((source) => captureSourcesFromView(source)));
	const sticky = $derived(captureSources.find((source) => source.sourceId === readingSourceId) ?? null);
	const prefilledPage = $derived(readingNowPage({ sourceId: readingSourceId, pages }, readingSourceId));
	const errorMessage = $derived(
		form && form.success !== true && form.kind === 'createStudyNote' ? (form.message ?? null) : null
	);
	const attachChoices = $derived(
		sources.map((source) => {
			const last = captureSourceFromView(source)?.lastName;
			const title = paperSourceTitle(source);
			return { sourceId: source.sourceId, label: last ? `${last} — ${title}` : title };
		})
	);

	function shortName(sourceId: string | null): string | null {
		if (!sourceId) return null;
		return captureSources.find((source) => source.sourceId === sourceId)?.lastName ?? null;
	}

	function sourceFor(id: string | null): PaperSourceView | null {
		if (!id) return null;
		return sources.find((source) => source.sourceId === id) ?? null;
	}

	$effect(() => {
		const id = parentId;
		const loaded = loadReadingNow(id);
		untrack(() => {
			pages = loaded.pages;
			readingSourceId = loaded.sourceId;
			hydratedFor = id;
		});
	});

	$effect(() => {
		const id = parentId;
		if (hydratedFor !== id) return;
		const sourceIdNow = readingSourceId;
		const pagesNow = pages;
		untrack(() => saveReadingNow(id, { sourceId: sourceIdNow, pages: pagesNow }));
	});

	function fill(note: InterpretedNote, forcedSourceId?: string) {
		const resolved =
			forcedSourceId ?? (note.source.kind === 'matched' ? note.source.sourceId : '');
		sourceId = resolved;
		page = note.page ?? '';
		body = note.body;
		passageDisplay = note.anchor?.passageDisplay ?? '';
		bibleBook = note.anchor?.bibleBook ?? '';
		chapter = note.anchor?.chapter != null ? String(note.anchor.chapter) : '';
		verseStart = note.anchor?.verseStart != null ? String(note.anchor.verseStart) : '';
		verseEnd = note.anchor?.verseEnd != null ? String(note.anchor.verseEnd) : '';
		if (resolved) {
			readingSourceId = resolved;
			if (note.page) pages = { ...pages, [resolved]: note.page };
		}
	}

	async function submitLine(forcedSourceId?: string) {
		const note = interpretNoteCapture(line, {
			sources: captureSources,
			stickySourceId: readingSourceId,
			prefilledPage,
			primaryBibleBook
		});
		if (!note) return;
		if (note.source.kind === 'ambiguous' && !forcedSourceId) {
			ambiguity = note;
			return;
		}
		ambiguity = null;
		fill(note, forcedSourceId);
		await tick();
		formEl?.requestSubmit();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.shiftKey) return;
		event.preventDefault();
		submitLine();
	}

	const onSubmit: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false, invalidateAll: false });
			if (result.type === 'success') {
				line = '';
				ambiguity = null;
				await onChanged?.();
			}
		};
	};

	function flash(message: string) {
		copyToast = message;
		setTimeout(() => {
			if (copyToast === message) copyToast = null;
		}, 2500);
	}
</script>

<section class="mt-6">
	<div class="flex items-baseline justify-between gap-3">
		<h2 class="text-sm font-semibold">Notes</h2>
		{#if copyToast}
			<p class="text-xs text-muted-foreground" role="status">{copyToast}</p>
		{/if}
	</div>

	{#if isOwner}
		<form method="POST" action="?/createStudyNote" use:enhance={onSubmit} bind:this={formEl} class="mt-3">
			<input type="hidden" name={parentField} value={parentId} />
			<input type="hidden" name="source_id" value={sourceId} />
			<input type="hidden" name="page" value={page} />
			<input type="hidden" name="body" value={body} />
			<input type="hidden" name="passage_display" value={passageDisplay} />
			<input type="hidden" name="bible_book" value={bibleBook} />
			<input type="hidden" name="chapter" value={chapter} />
			<input type="hidden" name="verse_start" value={verseStart} />
			<input type="hidden" name="verse_end" value={verseEnd} />

			{#if sticky}
				<p class="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					<span>Reading {sticky.lastName}{prefilledPage ? ` · p. ${prefilledPage}` : ''}</span>
					<button type="button" class="underline underline-offset-2 hover:text-foreground" onclick={() => (readingSourceId = null)}>
						Clear
					</button>
				</p>
			{/if}

			<label class="sr-only" for="study-note-line">Note</label>
			<textarea
				id="study-note-line"
				bind:value={line}
				rows="2"
				placeholder={sticky ? '215 — what this page says' : 'Towner 215 — or a loose note'}
				enterkeyhint="send"
				autocomplete="off"
				class="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				onkeydown={onKeydown}
			></textarea>
			<p class="mt-1 text-xs text-muted-foreground">
				Enter saves. A name and page at the front pick the source. <span class="font-medium">@2:12</span> anchors the passage.
			</p>

			{#if ambiguity && ambiguity.source.kind === 'ambiguous'}
				<div class="mt-2 flex flex-wrap gap-1.5">
					{#each ambiguity.source.sourceIds as id (id)}
						<button
							type="button"
							class="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted/80"
							onclick={() => submitLine(id)}
						>
							{attachChoices.find((choice) => choice.sourceId === id)?.label ?? 'Source'}
						</button>
					{/each}
				</div>
			{/if}

			{#if errorMessage}
				<p class="mt-2 text-sm text-destructive" role="alert">{errorMessage}</p>
			{/if}

			<div class="mt-2">
				<Button
					type="button"
					hotkey="s"
					label={pending ? 'Saving…' : 'Save note'}
					disabled={pending || !line.trim()}
					onclick={() => submitLine()}
				/>
			</div>
		</form>
	{/if}

	{#if notes.length === 0}
		<p class="mt-4 text-sm text-muted-foreground">
			Notes land here. Tap Reading on a source, then type a page and a line.
		</p>
	{:else}
		<ul class="mt-4 space-y-2">
			{#each notes as note (note.id)}
				<StudyNoteRow
					{note}
					shortName={shortName(note.sourceId)}
					source={sourceFor(note.sourceId)}
					{isOwner}
					{attachChoices}
					onChanged={onChanged}
					onCopied={flash}
				/>
			{/each}
		</ul>
	{/if}
</section>

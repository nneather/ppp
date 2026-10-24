<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Sheet from '$lib/components/ui/sheet';
	import { fetchCrossrefPrefill } from '$lib/studies/crossref';
	import { fetchOpenLibraryPrefill } from '$lib/library/open-library-prefill';

	let {
		open = $bindable(false),
		parentKind,
		parentId,
		onSaved
	}: {
		open?: boolean;
		parentKind: 'paper' | 'sermon';
		parentId: string;
		onSaved?: () => void | Promise<void>;
	} = $props();

	type Mode = 'article' | 'book' | 'title';

	let mode = $state<Mode>('article');
	let pending = $state(false);
	let looking = $state(false);
	let errorMessage = $state<string | null>(null);
	let doi = $state('');
	let isbn = $state('');
	let title = $state('');
	let journalTitle = $state('');
	let authors = $state('');
	let year = $state('');
	let volume = $state('');
	let issue = $state('');
	let pageStart = $state('');
	let pageEnd = $state('');

	const parentField = $derived(parentKind === 'paper' ? 'paper_id' : 'sermon_id');
	const action = $derived(mode === 'article' ? '?/createJournalArticleSource' : '?/createNotOwnedSource');

	function clearFields() {
		doi = '';
		isbn = '';
		title = '';
		journalTitle = '';
		authors = '';
		year = '';
		volume = '';
		issue = '';
		pageStart = '';
		pageEnd = '';
		errorMessage = null;
	}

	async function lookupDoi() {
		looking = true;
		errorMessage = null;
		try {
			const prefill = await fetchCrossrefPrefill(doi);
			doi = prefill.doi;
			title = prefill.title;
			journalTitle = prefill.journalTitle;
			authors = prefill.authors;
			year = prefill.year ? String(prefill.year) : '';
			volume = prefill.volume ?? '';
			issue = prefill.issue ?? '';
			pageStart = prefill.pageStart ?? '';
			pageEnd = prefill.pageEnd ?? '';
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Crossref lookup failed.';
		} finally {
			looking = false;
		}
	}

	async function lookupIsbn() {
		looking = true;
		errorMessage = null;
		try {
			const prefill = await fetchOpenLibraryPrefill(isbn);
			isbn = prefill.isbn;
			title = prefill.title ?? '';
			authors = prefill.authorTyped ?? '';
			year = prefill.year ? String(prefill.year) : '';
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Open Library lookup failed.';
		} finally {
			looking = false;
		}
	}

	const onSubmit: SubmitFunction = () => {
		pending = true;
		errorMessage = null;
		return async ({ result }) => {
			pending = false;
			if (result.type === 'success') {
				const data = result.data as { success?: boolean; message?: string } | undefined;
				if (data?.success) {
					open = false;
					clearFields();
					await onSaved?.();
					return;
				}
				errorMessage = data?.message ?? 'Could not add the source.';
				return;
			}
			if (result.type === 'failure') {
				const data = result.data as { message?: string } | undefined;
				errorMessage = data?.message ?? 'Could not add the source.';
			}
		};
	};
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
		<Sheet.Header class="shrink-0 border-b border-border pb-4">
			<Sheet.Title>Add source</Sheet.Title>
			<Sheet.Description class="text-sm text-muted-foreground">
				Look up a DOI or ISBN, edit the fields, then add it as a candidate. A loose note can stay unattached.
			</Sheet.Description>
		</Sheet.Header>

		<form method="POST" {action} use:enhance={onSubmit} class="flex flex-1 flex-col gap-4 px-1 py-4">
			<input type="hidden" name={parentField} value={parentId} />
			{#if mode !== 'article'}
				<input type="hidden" name="isbn" value={isbn} />
			{/if}

			<div class="flex flex-wrap gap-1.5">
				{#each [{ id: 'article', label: 'Article' }, { id: 'book', label: 'Book' }, { id: 'title', label: 'Title' }] as choice (choice.id)}
					<button
						type="button"
						class="rounded-full border px-2.5 py-1 text-xs {mode === choice.id ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground'}"
						onclick={() => {
							mode = choice.id as Mode;
							errorMessage = null;
						}}
					>
						{choice.label}
					</button>
				{/each}
			</div>

			{#if errorMessage}
				<p class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
					{errorMessage}
				</p>
			{/if}

			{#if mode === 'article'}
				<div class="space-y-2">
					<Label for="add-doi">DOI</Label>
					<div class="flex gap-2">
						<Input id="add-doi" name="doi" bind:value={doi} placeholder="10.1177/…" />
						<Button type="button" variant="outline" label={looking ? 'Looking…' : 'Look up'} disabled={looking || !doi.trim()} onclick={lookupDoi} />
					</div>
				</div>
				<div class="space-y-2">
					<Label for="add-journal">Journal</Label>
					<Input id="add-journal" name="journal_title" bind:value={journalTitle} />
				</div>
			{:else if mode === 'book'}
				<div class="space-y-2">
					<Label for="add-isbn">ISBN</Label>
					<div class="flex gap-2">
						<Input id="add-isbn" bind:value={isbn} placeholder="978…" />
						<Button type="button" variant="outline" label={looking ? 'Looking…' : 'Look up'} disabled={looking || !isbn.trim()} onclick={lookupIsbn} />
					</div>
				</div>
			{/if}

			<div class="space-y-2">
				<Label for="add-title">Title</Label>
				<Input id="add-title" name="title" bind:value={title} />
			</div>
			<div class="space-y-2">
				<Label for="add-authors">{mode === 'article' ? 'Authors' : 'Author'}</Label>
				<Input id="add-authors" name={mode === 'article' ? 'authors' : 'author'} bind:value={authors} placeholder="Last, First" />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-2">
					<Label for="add-year">Year</Label>
					<Input id="add-year" name="year" bind:value={year} inputmode="numeric" />
				</div>
				{#if mode === 'article'}
					<div class="space-y-2">
						<Label for="add-volume">Volume</Label>
						<Input id="add-volume" name="volume" bind:value={volume} />
					</div>
					<div class="space-y-2">
						<Label for="add-issue">Issue</Label>
						<Input id="add-issue" name="issue" bind:value={issue} />
					</div>
					<div class="space-y-2">
						<Label for="add-page-start">First page</Label>
						<Input id="add-page-start" name="page_start" bind:value={pageStart} />
					</div>
					<div class="space-y-2">
						<Label for="add-page-end">Last page</Label>
						<Input id="add-page-end" name="page_end" bind:value={pageEnd} />
					</div>
				{/if}
			</div>

			<Button
				type="submit"
				variant="outline"
				label={pending ? 'Adding…' : 'Add to study'}
				disabled={pending || !title.trim() || (mode === 'article' && !journalTitle.trim())}
			/>
		</form>
	</Sheet.Content>
</Sheet.Root>

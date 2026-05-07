<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import FileUp from '@lucide/svelte/icons/file-up';
	import { enhance } from '$app/forms';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { HOTKEY } from '$lib/hotkeys/registry';
	import type { LibraryCsvPreviewError } from '$lib/library/server/books-csv';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	let formEl: HTMLFormElement | null = $state(null);
	let applySubmitHidden: HTMLButtonElement | null = $state(null);
	let confirmOpen = $state(false);
	let applyPending = $state(false);

	const previewOk = $derived(
		form != null && form.kind === 'previewLibraryCsv' && 'success' in form && form.success === true
	);

	const previewErrors = $derived.by((): LibraryCsvPreviewError[] => {
		if (
			form != null &&
			form.kind === 'previewLibraryCsv' &&
			'success' in form &&
			form.success === false &&
			'errors' in form &&
			Array.isArray(form.errors)
		) {
			return form.errors as LibraryCsvPreviewError[];
		}
		return [];
	});

	const applyErrors = $derived.by((): LibraryCsvPreviewError[] => {
		if (
			form != null &&
			form.kind === 'applyLibraryCsv' &&
			'errors' in form &&
			Array.isArray(form.errors)
		) {
			return form.errors as LibraryCsvPreviewError[];
		}
		return [];
	});

	function onApplyConfirm() {
		applyPending = true;
		confirmOpen = false;
		formEl?.requestSubmit(applySubmitHidden ?? undefined);
	}
</script>

<svelte:head>
	<title>Library CSV export / import — ppp</title>
</svelte:head>

<h2 class="text-lg font-semibold text-foreground">Mass-edit CSV</h2>
<p class="mt-2 text-sm text-muted-foreground">
	Owner-only export and reimport for offline edits. The <code class="text-xs">id</code> column is
	the join key; leave it blank to insert a new book. Reuse the exported
	<code class="text-xs">authors_json</code> to change authors; if you omit it on update, existing
	author links are unchanged. A <code class="text-xs">needs_review_note</code> starting with the
	DELETE ON IMPORT prefix soft-deletes that row on apply (see
	<code class="text-xs">books-csv.ts</code>). UTF-8 with BOM from Excel is fine on import.
</p>

<div class="mt-6 flex flex-wrap gap-3">
	<Button href="/settings/library/export/download" variant="outline" class="gap-2">
		<Download class="size-4" aria-hidden="true" /> Export all live books (CSV)
	</Button>
</div>

<form
	bind:this={formEl}
	method="POST"
	enctype="multipart/form-data"
	class="mt-8 flex max-w-xl flex-col gap-4"
	use:enhance={() => {
		return async ({ update }) => {
			applyPending = false;
			await update();
		};
	}}
>
	<div class="space-y-2">
		<Label for="csv-file">CSV file</Label>
		<input
			id="csv-file"
			name="csv_file"
			type="file"
			accept=".csv,text/csv"
			class="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
		/>
	</div>

	<div class="flex flex-wrap gap-2">
		<Button type="submit" formaction="?/previewLibraryCsv" variant="outline" class="gap-2">
			<FileUp class="size-4" aria-hidden="true" /> Preview import
		</Button>
		<Button
			type="button"
			variant="default"
			class="gap-2"
			hotkey={HOTKEY.update}
			label="Apply import"
			disabled={!previewOk || applyPending}
			onclick={() => (confirmOpen = true)}
		>
			Apply import
		</Button>
	</div>

	<button
		type="submit"
		bind:this={applySubmitHidden}
		class="sr-only"
		tabindex="-1"
		aria-hidden="true"
		name="confirmed"
		value="true"
		formaction="?/applyLibraryCsv"
	>
		Apply
	</button>
</form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Apply CSV import?"
	description="This writes to your library. Use the same CSV you just previewed. Imports stop on the first failing row."
	confirmLabel="Apply import"
	destructive
	pending={applyPending}
	onConfirm={onApplyConfirm}
/>

{#if form?.kind === 'previewLibraryCsv'}
	{#if 'success' in form && form.success}
		<p class="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
			Preview OK: <strong>{form.inserts}</strong> insert(s), <strong>{form.updates}</strong>
			update(s), <strong>{form.deletes}</strong> soft-delete(s),
			<strong>{form.total}</strong> total row(s). Use Apply import with the same file to write.
		</p>
	{:else if previewErrors.length > 0}
		<div class="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-3 text-sm">
			<p class="font-medium text-destructive">Validation failed</p>
			<ul
				class="mt-2 max-h-64 list-inside list-disc space-y-1 overflow-y-auto text-muted-foreground"
			>
				{#each previewErrors.slice(0, 80) as err (err.line + err.message)}
					<li>
						{#if err.line > 0}
							Line {err.line}:
						{/if}
						{err.message}
					</li>
				{/each}
				{#if previewErrors.length > 80}
					<li>… and {previewErrors.length - 80} more</li>
				{/if}
			</ul>
		</div>
	{/if}
{/if}

{#if form?.kind === 'applyLibraryCsv'}
	{#if 'success' in form && form.success}
		<p class="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
			Import finished: <strong>{form.inserted}</strong> inserted, <strong>{form.updated}</strong>
			updated,
			<strong>{form.deleted}</strong> soft-deleted.
		</p>
	{:else if 'message' in form}
		<div
			class="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-3 text-sm text-destructive"
		>
			<p class="font-medium">{form.message}</p>
			{#if applyErrors.length > 0}
				<ul class="mt-2 list-inside list-disc text-muted-foreground">
					{#each applyErrors as err (err.line + err.message)}
						<li>Line {err.line}: {err.message}</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
{/if}

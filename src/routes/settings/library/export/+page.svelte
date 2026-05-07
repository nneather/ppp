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
	let confirmOpen = $state(false);
	let applyPending = $state(false);
	let applyProgress = $state<{ done: number; total: number } | null>(null);
	type ApplyOutcome =
		| { kind: 'idle' }
		| {
				kind: 'success';
				inserted: number;
				updated: number;
				deleted: number;
		  }
		| { kind: 'http_error'; status: number; message: string }
		| { kind: 'prepare_errors'; errors: LibraryCsvPreviewError[] }
		| { kind: 'apply_error'; line: number; message: string };
	let applyOutcome = $state<ApplyOutcome>({ kind: 'idle' });

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

	const previewFormatLabel = $derived.by((): string | null => {
		if (
			form != null &&
			form.kind === 'previewLibraryCsv' &&
			'success' in form &&
			form.success === true &&
			'format' in form &&
			(form.format === 'tsv' || form.format === 'csv')
		) {
			return form.format === 'tsv' ? 'TSV' : 'CSV';
		}
		return null;
	});

	function resetApplyUi() {
		applyOutcome = { kind: 'idle' };
		applyProgress = null;
	}

	async function runApplyImport() {
		applyPending = true;
		confirmOpen = false;
		resetApplyUi();

		const input = document.getElementById('import-file') as HTMLInputElement | null;
		const file = input?.files?.[0];
		if (!file) {
			applyOutcome = {
				kind: 'http_error',
				status: 0,
				message: 'Choose a file to import, then preview again.'
			};
			applyPending = false;
			return;
		}

		const fd = new FormData();
		fd.set('csv_file', file);

		try {
			const res = await fetch('/settings/library/export/apply-stream', {
				method: 'POST',
				body: fd,
				credentials: 'include'
			});

			if (!res.ok) {
				const body = await res.text();
				const snippet = body.replace(/\s+/g, ' ').slice(0, 200);
				applyOutcome = {
					kind: 'http_error',
					status: res.status,
					message:
						snippet.length > 0
							? `Request failed (${res.status}): ${snippet}`
							: `Request failed (${res.status}).`
				};
				return;
			}

			const reader = res.body?.pipeThrough(new TextDecoderStream()).getReader();
			if (!reader) {
				applyOutcome = {
					kind: 'http_error',
					status: 0,
					message: 'No response body from server.'
				};
				return;
			}

			let buffer = '';

			function handleEvent(ev: Record<string, unknown>) {
				const type = ev.type;
				if (type === 'progress' && typeof ev.done === 'number' && typeof ev.total === 'number') {
					applyProgress = { done: ev.done, total: ev.total };
				} else if (type === 'error') {
					if (ev.phase === 'prepare' && Array.isArray(ev.errors)) {
						applyOutcome = { kind: 'prepare_errors', errors: ev.errors as LibraryCsvPreviewError[] };
					} else if (typeof ev.message === 'string') {
						applyOutcome = {
							kind: 'apply_error',
							line: typeof ev.line === 'number' ? ev.line : 0,
							message: ev.message
						};
					} else {
						applyOutcome = { kind: 'apply_error', line: 0, message: 'Import failed.' };
					}
				} else if (
					type === 'complete' &&
					typeof ev.inserted === 'number' &&
					typeof ev.updated === 'number' &&
					typeof ev.deleted === 'number'
				) {
					applyOutcome = {
						kind: 'success',
						inserted: ev.inserted,
						updated: ev.updated,
						deleted: ev.deleted
					};
				}
			}

			while (true) {
				const { done, value } = await reader.read();
				if (value) buffer += value;

				const parts = buffer.split('\n');
				if (!done) {
					buffer = parts.pop() ?? '';
				} else {
					buffer = '';
				}

				for (const line of parts) {
					const t = line.trim();
					if (t.length === 0) continue;
					try {
						handleEvent(JSON.parse(t) as Record<string, unknown>);
					} catch {
						/* skip malformed line */
					}
				}

				if (done) break;
			}
		} catch (e) {
			applyOutcome = {
				kind: 'http_error',
				status: 0,
				message: e instanceof Error ? e.message : 'Network error.'
			};
		} finally {
			applyPending = false;
		}
	}
</script>

<svelte:head>
	<title>Library TSV export / import — ppp</title>
</svelte:head>

<h2 class="text-lg font-semibold text-foreground">Mass-edit TSV</h2>
<p class="mt-2 text-sm text-muted-foreground">
	Owner-only export and reimport for offline edits. Export is <strong>tab-separated (TSV)</strong> with
	RFC&nbsp;4180-style quoting when a cell contains tabs or newlines; you can also import
	<strong>CSV</strong> (extension <code class="text-xs">.csv</code> or a header line with more commas
	than tabs). The <code class="text-xs">id</code> column is the join key; leave it blank to insert a new
	book. Reuse the exported <code class="text-xs">authors_json</code> to change authors; if you omit it on
	update, existing author links are unchanged. A <code class="text-xs">needs_review_note</code> starting
	with the DELETE ON IMPORT prefix soft-deletes that row on apply (see
	<code class="text-xs">books-csv.ts</code>). UTF-8 with BOM from Excel is fine on import.
</p>

<div class="mt-6 flex flex-wrap gap-3">
	<Button href="/settings/library/export/download" variant="outline" class="gap-2">
		<Download class="size-4" aria-hidden="true" /> Export all live books (TSV)
	</Button>
</div>

<form
	method="POST"
	enctype="multipart/form-data"
	class="mt-8 flex max-w-xl flex-col gap-4"
	use:enhance={() => {
		return async ({ update }) => {
			await update();
		};
	}}
>
	<div class="space-y-2">
		<Label for="import-file">Import file (TSV or CSV)</Label>
		<input
			id="import-file"
			name="csv_file"
			type="file"
			accept=".tsv,.csv,text/tab-separated-values,text/csv"
			onchange={resetApplyUi}
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
</form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Apply import?"
	description="This writes to your library. Use the same TSV or CSV you just previewed. Imports stop on the first failing row."
	confirmLabel="Apply import"
	destructive
	pending={applyPending}
	onConfirm={() => {
		void runApplyImport();
	}}
/>

{#if form?.kind === 'previewLibraryCsv'}
	{#if 'success' in form && form.success}
		<p class="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
			Preview OK{#if previewFormatLabel}
				(detected {previewFormatLabel}){/if}: <strong>{form.inserts}</strong> insert(s),
			<strong>{form.updates}</strong> update(s), <strong>{form.deletes}</strong> soft-delete(s),
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

{#if applyProgress != null && applyPending}
	<div class="mt-4 max-w-xl space-y-2">
		<label for="apply-progress" class="text-sm text-muted-foreground">
			Applying row {applyProgress.done} of {applyProgress.total}…
		</label>
		<progress
			id="apply-progress"
			class="h-2 w-full rounded-md"
			max={applyProgress.total}
			value={applyProgress.done}
		></progress>
	</div>
{/if}

{#if applyOutcome.kind === 'success'}
	<p class="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
		Import finished: <strong>{applyOutcome.inserted}</strong> inserted,
		<strong>{applyOutcome.updated}</strong> updated, <strong>{applyOutcome.deleted}</strong> soft-deleted.
	</p>
{:else if applyOutcome.kind === 'prepare_errors'}
	<div class="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-3 text-sm">
		<p class="font-medium text-destructive">Apply validation failed</p>
		<ul class="mt-2 max-h-64 list-inside list-disc space-y-1 overflow-y-auto text-muted-foreground">
			{#each applyOutcome.errors as err (err.line + err.message)}
				<li>
					{#if err.line > 0}
						Line {err.line}:
					{/if}
					{err.message}
				</li>
			{/each}
		</ul>
	</div>
{:else if applyOutcome.kind === 'apply_error'}
	<div
		class="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-3 text-sm text-destructive"
	>
		<p class="font-medium">Import stopped</p>
		<p class="mt-1 text-muted-foreground">
			{#if applyOutcome.line > 0}
				Line {applyOutcome.line}:
			{/if}
			{applyOutcome.message}
		</p>
	</div>
{:else if applyOutcome.kind === 'http_error'}
	<div
		class="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-3 text-sm text-destructive"
	>
		<p class="font-medium">Could not apply import</p>
		<p class="mt-1 text-muted-foreground">{applyOutcome.message}</p>
	</div>
{/if}

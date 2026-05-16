<script lang="ts">
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Download from '@lucide/svelte/icons/download';
	import FileUp from '@lucide/svelte/icons/file-up';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import { enhance } from '$app/forms';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { HOTKEY } from '$lib/hotkeys/registry';
	import type { LibraryCsvPreviewError } from '$lib/library/server/books-csv';
	import type { PageProps } from './$types';
	import { tick } from 'svelte';

	let { form }: PageProps = $props();
	let confirmOpen = $state(false);
	let applyPending = $state(false);
	let applyProgress = $state<{ done: number; total: number } | null>(null);
	let applyServerReady = $state(false);
	let previewPending = $state(false);
	let activityRegionEl: HTMLElement | null = $state(null);

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

	const applyProgressPercent = $derived.by(() => {
		if (applyProgress == null || applyProgress.total <= 0) return 0;
		return Math.round((applyProgress.done / applyProgress.total) * 100);
	});

	const applyStatusHeadline = $derived.by(() => {
		if (!applyPending) return '';
		if (!applyServerReady) return 'Connecting to server…';
		if (applyProgress == null) return 'Starting write to library…';
		return `Writing row ${applyProgress.done} of ${applyProgress.total}`;
	});

	function resetApplyUi() {
		applyOutcome = { kind: 'idle' };
		applyProgress = null;
		applyServerReady = false;
	}

	async function scrollActivityIntoView() {
		await tick();
		activityRegionEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
			await scrollActivityIntoView();
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
				if (type === 'prepare' && ev.ok === true) {
					applyServerReady = true;
				} else if (
					type === 'progress' &&
					typeof ev.done === 'number' &&
					typeof ev.total === 'number'
				) {
					applyProgress = { done: ev.done, total: ev.total };
					applyServerReady = true;
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
			applyServerReady = false;
			await scrollActivityIntoView();
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
			previewPending = true;
			try {
				await update();
				await scrollActivityIntoView();
			} finally {
				previewPending = false;
			}
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

	<div class="flex flex-wrap items-center gap-2">
		<Button
			type="submit"
			formaction="?/previewLibraryCsv"
			variant="outline"
			class="gap-2"
			disabled={previewPending}
			aria-busy={previewPending}
		>
			{#if previewPending}
				<Loader2 class="size-4 shrink-0 animate-spin" aria-hidden="true" />
				<span>Checking file…</span>
			{:else}
				<FileUp class="size-4 shrink-0" aria-hidden="true" />
				<span>Preview import</span>
			{/if}
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
	{#if previewOk && !applyPending}
		<p class="text-xs text-muted-foreground" role="status">
			Preview passed — you can apply the same file, or choose another file to preview again.
		</p>
	{/if}
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

<section
	bind:this={activityRegionEl}
	id="import-activity"
	class="mt-6 max-w-2xl scroll-mt-8 space-y-4"
	aria-label="Import activity and results"
>
	<span class="sr-only" aria-live="polite" aria-atomic="true">
		{#if previewPending}
			Checking import file.
		{:else if form?.kind === 'previewLibraryCsv' && 'success' in form && form.success}
			Preview succeeded. {form.inserts} inserts, {form.updates} updates, {form.deletes} deletes,
			{form.total} total rows.
		{:else if previewErrors.length > 0}
			Preview failed with {previewErrors.length} validation message{previewErrors.length === 1 ? '' : 's'}.
		{:else if applyPending}
			{applyStatusHeadline}
		{:else if applyOutcome.kind === 'success'}
			Import finished. {applyOutcome.inserted} inserted, {applyOutcome.updated} updated,
			{applyOutcome.deleted} deleted.
		{:else if applyOutcome.kind !== 'idle'}
			Import did not complete. See details below.
		{/if}
	</span>

	{#if form?.kind === 'previewLibraryCsv'}
		{#if 'success' in form && form.success}
			<div
				class="flex gap-3 rounded-lg border-2 border-foreground/15 bg-muted/50 px-4 py-3 text-sm text-foreground shadow-sm"
				role="status"
			>
				<CircleCheck
					class="mt-0.5 size-5 shrink-0 text-foreground"
					strokeWidth={2}
					aria-hidden="true"
				/>
				<div class="min-w-0">
					<p class="font-semibold leading-tight">Preview complete</p>
					<p class="mt-1.5 leading-relaxed text-muted-foreground">
						{#if previewFormatLabel}
							Detected <span class="font-medium text-foreground">{previewFormatLabel}</span>.
						{/if}
						<strong class="text-foreground">{form.inserts}</strong> insert(s),
						<strong class="text-foreground">{form.updates}</strong> update(s),
						<strong class="text-foreground">{form.deletes}</strong> soft-delete(s),
						<strong class="text-foreground">{form.total}</strong> total row(s). Use
						<span class="font-medium text-foreground">Apply import</span> with the same file to write
						changes.
					</p>
				</div>
			</div>
		{:else if previewErrors.length > 0}
			<div
				class="flex gap-3 rounded-lg border-2 border-destructive/50 bg-destructive/5 px-4 py-3 text-sm"
				role="alert"
			>
				<AlertTriangle class="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
				<div class="min-w-0">
					<p class="font-semibold text-destructive">Preview blocked</p>
					<p class="mt-1 text-muted-foreground">Fix the rows below, then run Preview again.</p>
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
			</div>
		{/if}
	{/if}

	{#if applyPending}
		<div
			class="rounded-lg border-2 border-foreground/25 bg-card px-4 py-4 shadow-sm"
			role="status"
			aria-busy="true"
			aria-live="polite"
		>
			<div class="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
				<Loader2 class="size-4 shrink-0 animate-spin" aria-hidden="true" />
				<span>{applyStatusHeadline}</span>
			</div>
			{#if applyProgress != null && applyProgress.total > 0}
				{@const pct = applyProgressPercent}
				<div class="mt-3 space-y-2">
					<div class="flex flex-wrap items-end justify-between gap-2 text-sm">
						<span class="text-muted-foreground">Progress (by row)</span>
						<span class="font-mono text-base font-semibold tabular-nums text-foreground">
							{applyProgress.done} / {applyProgress.total}
							<span class="text-muted-foreground">({pct}%)</span>
						</span>
					</div>
					<div
						class="mt-1 w-full overflow-hidden rounded-md border-2 border-foreground bg-muted"
						role="progressbar"
						aria-valuenow={applyProgress.done}
						aria-valuemin={0}
						aria-valuemax={applyProgress.total}
						aria-valuetext={`${applyProgress.done} of ${applyProgress.total} rows written (${pct} percent)`}
						aria-label="Import row progress"
					>
						<svg
							viewBox="0 0 100 10"
							preserveAspectRatio="none"
							class="block h-5 w-full"
							aria-hidden="true"
						>
							<rect width="100" height="10" class="fill-muted" />
							<rect width={pct} height="10" class="fill-foreground/30" />
							{#if pct > 0}
								<line
									x1={pct}
									y1="0"
									x2={pct}
									y2="10"
									class="stroke-foreground"
									stroke-width="1.25"
									vector-effect="non-scaling-stroke"
								/>
							{/if}
						</svg>
					</div>
					<p class="text-xs text-muted-foreground">
						Progress is shown by the numbers above, the length of the filled segment, and a vertical
						mark at the filled edge (not by color alone).
					</p>
				</div>
			{:else}
				<div
					class="mt-3 h-5 w-full overflow-hidden rounded-md border-2 border-dashed border-foreground/40 bg-muted"
					role="progressbar"
					aria-valuetext={applyStatusHeadline}
					aria-label="Import starting"
				>
					<div
						class="h-full w-1/3 animate-pulse bg-foreground/15 bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--color-foreground)_35%,transparent)_0px,color-mix(in_oklab,var(--color-foreground)_35%,transparent)_3px,transparent_3px,transparent_7px)]"
					></div>
				</div>
			{/if}
		</div>
	{/if}

	{#if applyOutcome.kind === 'success'}
		<div
			class="flex gap-3 rounded-lg border-2 border-foreground/15 bg-muted/50 px-4 py-3 text-sm text-foreground shadow-sm"
			role="status"
		>
			<CircleCheck class="mt-0.5 size-5 shrink-0 text-foreground" strokeWidth={2} aria-hidden="true" />
			<div>
				<p class="font-semibold leading-tight">Import finished</p>
				<p class="mt-1.5 text-muted-foreground">
					<strong class="text-foreground">{applyOutcome.inserted}</strong> inserted,
					<strong class="text-foreground">{applyOutcome.updated}</strong> updated,
					<strong class="text-foreground">{applyOutcome.deleted}</strong> soft-deleted. Your library
					lists will reflect these changes after you navigate away or refresh.
				</p>
			</div>
		</div>
	{:else if applyOutcome.kind === 'prepare_errors'}
		<div class="flex gap-3 rounded-lg border-2 border-destructive/50 bg-destructive/5 px-4 py-3 text-sm" role="alert">
			<AlertTriangle class="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
			<div class="min-w-0">
				<p class="font-semibold text-destructive">Apply blocked (validation)</p>
				<p class="mt-1 text-muted-foreground">
					The file changed or no longer matches preview. Fix the issues below, then Preview again
					before applying.
				</p>
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
		</div>
	{:else if applyOutcome.kind === 'apply_error'}
		<div class="flex gap-3 rounded-lg border-2 border-destructive/50 bg-destructive/5 px-4 py-3 text-sm" role="alert">
			<AlertTriangle class="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
			<div>
				<p class="font-semibold text-destructive">Import stopped</p>
				<p class="mt-1 text-muted-foreground">
					{#if applyOutcome.line > 0}
						<span class="font-mono text-foreground">Line {applyOutcome.line}</span>:
					{/if}
					{applyOutcome.message}
				</p>
				<p class="mt-2 text-xs text-muted-foreground">
					Earlier rows may already have been written. Fix this row (or restore from backup), then run
					a smaller import or continue from a corrected file.
				</p>
			</div>
		</div>
	{:else if applyOutcome.kind === 'http_error'}
		<div class="flex gap-3 rounded-lg border-2 border-destructive/50 bg-destructive/5 px-4 py-3 text-sm" role="alert">
			<AlertTriangle class="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
			<div>
				<p class="font-semibold text-destructive">Could not run import</p>
				<p class="mt-1 text-muted-foreground">{applyOutcome.message}</p>
			</div>
		</div>
	{/if}
</section>

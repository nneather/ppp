<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import FileUp from '@lucide/svelte/icons/file-up';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import { enhance } from '$app/forms';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import type { PageProps } from './$types';
	import type { SubmitFunction } from '@sveltejs/kit';

	/** Soft cap — Goodreads exports with long reviews can be large; keep under Vercel body limits. */
	const MAX_CSV_BYTES = 8 * 1024 * 1024;

	let { form }: PageProps = $props();

	let overwriteExisting = $state(false);
	let fillEmptyNotes = $state(false);
	let previewPending = $state(false);
	let applyPending = $state(false);
	let confirmOpen = $state(false);
	let applyFormEl = $state<HTMLFormElement | null>(null);
	let applyFileInputEl = $state<HTMLInputElement | null>(null);
	let fileError = $state<string | null>(null);
	/** File must not be deeply proxied — `$state(File)` can beachball the main thread. */
	let selectedFile = $state.raw<File | null>(null);
	let selectedFileLabel = $state<string | null>(null);

	const previewOk = $derived(
		form != null && form.kind === 'previewGoodreads' && 'success' in form && form.success === true
	);

	const previewFailMessage = $derived.by((): string | null => {
		if (form != null && form.kind === 'previewGoodreads' && 'message' in form && form.message) {
			return String(form.message);
		}
		return null;
	});

	const applyOk = $derived(
		form != null && form.kind === 'applyGoodreads' && 'success' in form && form.success === true
	);

	const applyFailMessage = $derived.by((): string | null => {
		if (form != null && form.kind === 'applyGoodreads' && 'message' in form && form.message) {
			return String(form.message);
		}
		return null;
	});

	const previewEnhance: SubmitFunction = ({ formData, cancel }) => {
		const file = selectedFile;
		if (!file) {
			cancel();
			fileError = 'Choose a Goodreads export CSV first.';
			return;
		}
		if (file.size > MAX_CSV_BYTES) {
			cancel();
			fileError = `File is too large (${Math.ceil(file.size / (1024 * 1024))} MB). Max ${MAX_CSV_BYTES / (1024 * 1024)} MB.`;
			return;
		}
		formData.set('csv_file', file);
		previewPending = true;
		fileError = null;
		return async ({ update }) => {
			try {
				await update({ reset: false });
			} finally {
				previewPending = false;
			}
		};
	};

	const applyEnhance: SubmitFunction = ({ formData, cancel }) => {
		const file = selectedFile;
		if (!file) {
			cancel();
			fileError = 'Choose a Goodreads export CSV first.';
			return;
		}
		formData.set('csv_file', file);
		applyPending = true;
		return async ({ update }) => {
			try {
				await update({ reset: false });
			} finally {
				applyPending = false;
				confirmOpen = false;
			}
		};
	};

	function onFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		fileError = null;
		if (!file) {
			selectedFile = null;
			selectedFileLabel = null;
			return;
		}
		if (file.size > MAX_CSV_BYTES) {
			selectedFile = null;
			selectedFileLabel = null;
			input.value = '';
			fileError = `File is too large (${Math.ceil(file.size / (1024 * 1024))} MB). Max ${MAX_CSV_BYTES / (1024 * 1024)} MB.`;
			return;
		}
		selectedFile = file;
		selectedFileLabel = `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
	}

	function confirmApply() {
		if (!applyFormEl || !selectedFile) return;
		// Ensure the apply form's file field is populated for progressive enhancement + no-JS fallback.
		if (applyFileInputEl) {
			const dt = new DataTransfer();
			dt.items.add(selectedFile);
			applyFileInputEl.files = dt.files;
		}
		applyFormEl.requestSubmit();
	}
</script>

<svelte:head>
	<title>Goodreads ratings — Library settings — ppp</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<section class="rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5">
		<h2 class="text-base font-semibold">Import ratings from Goodreads</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			Goodreads no longer has a public API. Export your library as CSV on desktop (My Books →
			Tools → Import and export → Export Library), then preview here. Matching is by ISBN only
			(ISBN-10/13 twins). Unrated Goodreads rows are skipped. Existing ppp ratings are left
			alone unless you opt to overwrite.
		</p>

		<!-- File picker outside the form so Choose File cannot submit / proxy through form state. -->
		<div class="mt-4 space-y-2">
			<Label for="gr-csv">Goodreads CSV</Label>
			<input
				id="gr-csv"
				type="file"
				accept=".csv,text/csv,text/plain"
				class="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium"
				onchange={onFileChange}
			/>
			{#if selectedFileLabel}
				<p class="text-xs text-muted-foreground">Selected: {selectedFileLabel}</p>
			{/if}
			{#if fileError}
				<p class="text-sm text-destructive">{fileError}</p>
			{/if}
		</div>

		<form
			method="POST"
			action="?/previewGoodreads"
			enctype="multipart/form-data"
			use:enhance={previewEnhance}
			class="mt-4 flex flex-col gap-4"
		>
			<label class="flex items-start gap-2 text-sm">
				<input
					type="checkbox"
					name="overwrite_existing"
					value="true"
					bind:checked={overwriteExisting}
					class="mt-0.5 size-4"
				/>
				<span>
					<span class="font-medium">Overwrite existing ratings</span>
					<span class="block text-muted-foreground">
						Default skips books that already have a 1–5 rating in ppp.
					</span>
				</span>
			</label>

			<label class="flex items-start gap-2 text-sm">
				<input
					type="checkbox"
					name="fill_empty_notes"
					value="true"
					bind:checked={fillEmptyNotes}
					class="mt-0.5 size-4"
				/>
				<span>
					<span class="font-medium">Fill empty personal notes</span>
					<span class="block text-muted-foreground">
						Copies My Review / Private Notes only when personal notes are blank.
					</span>
				</span>
			</label>

			{#if previewFailMessage}
				<p class="text-sm text-destructive">{previewFailMessage}</p>
			{/if}

			<Button
				type="submit"
				variant="outline"
				class="gap-2 self-start"
				disabled={previewPending || selectedFile == null}
				aria-busy={previewPending}
			>
				{#if previewPending}
					<Loader2 class="size-4 shrink-0 animate-spin" aria-hidden="true" />
					Previewing…
				{:else}
					<FileUp class="size-4 shrink-0" aria-hidden="true" />
					Preview matches
				{/if}
			</Button>
		</form>
	</section>

	{#if previewOk && form && form.kind === 'previewGoodreads' && form.success}
		<section class="rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5">
			<h2 class="text-base font-semibold">Preview</h2>
			<p class="mt-1 text-sm text-muted-foreground">
				{form.rowCount} Goodreads rows · {form.applyCount} will update · {form.skipExisting}
				already rated · {form.unmatched} unmatched (rated) · {form.unrated} unrated skipped
			</p>

			{#if form.unmatchedSample.length > 0}
				<div class="mt-4">
					<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Unmatched sample (rated, no ISBN hit)
					</p>
					<ul class="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
						{#each form.unmatchedSample as row (row.line)}
							<li class="text-muted-foreground">
								<span class="text-foreground">{row.title || '(untitled)'}</span>
								{#if row.author}
									— {row.author}
								{/if}
								{#if row.rating}
									· {row.rating}/5
								{/if}
								{#if row.isbn}
									· ISBN {row.isbn}
								{:else}
									· no ISBN
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if form.applyCount > 0 && selectedFile}
				<form
					method="POST"
					action="?/applyGoodreads"
					enctype="multipart/form-data"
					use:enhance={applyEnhance}
					bind:this={applyFormEl}
					class="mt-4"
				>
					<input
						type="file"
						name="csv_file"
						accept=".csv,text/csv,text/plain"
						class="hidden"
						bind:this={applyFileInputEl}
					/>
					{#if overwriteExisting}
						<input type="hidden" name="overwrite_existing" value="true" />
					{/if}
					{#if fillEmptyNotes}
						<input type="hidden" name="fill_empty_notes" value="true" />
					{/if}
					<Button
						type="button"
						class="gap-2"
						disabled={applyPending}
						hotkey="s"
						onclick={() => (confirmOpen = true)}
						label={applyPending ? 'Applying…' : `Apply ${form.applyCount} ratings`}
					/>
				</form>

				<ConfirmDialog
					bind:open={confirmOpen}
					title="Apply Goodreads ratings?"
					description={`This will write ratings on ${form.applyCount} matching books${
						fillEmptyNotes ? ' and fill empty personal notes where present' : ''
					}.`}
					confirmLabel="Apply ratings"
					pending={applyPending}
					onConfirm={confirmApply}
				/>
			{:else if form.applyCount === 0}
				<p class="mt-4 text-sm text-muted-foreground">
					Nothing to apply with the current options. Check overwrite, or add ISBNs to unmatched
					books.
				</p>
			{/if}
		</section>
	{/if}

	{#if applyOk && form && form.kind === 'applyGoodreads' && form.success}
		<section
			class="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm"
		>
			<CircleCheck class="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
			<div>
				<p class="font-medium text-foreground">
					Updated {form.updated} book{form.updated === 1 ? '' : 's'}.
				</p>
				<p class="mt-1 text-muted-foreground">
					Skipped existing: {form.skippedExisting} · Unmatched: {form.unmatched} · Unrated
					rows: {form.unrated}
				</p>
			</div>
		</section>
	{/if}

	{#if applyFailMessage}
		<p class="text-sm text-destructive">{applyFailMessage}</p>
	{/if}
</div>

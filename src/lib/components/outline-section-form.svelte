<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { OutlineSectionRow } from '$lib/types/library';

	type FormMessage = { message?: string } | null | undefined;

	let {
		bookId,
		existing = null,
		mode = 'single',
		formMessage = null,
		onSaved,
		onCancel
	}: {
		bookId: string;
		existing?: OutlineSectionRow | null;
		mode?: 'single' | 'paste';
		formMessage?: FormMessage;
		onSaved?: () => void;
		onCancel?: () => void;
	} = $props();

	const isEdit = $derived(!!existing && mode === 'single');

	let locator = $state('');
	let label = $state('');
	let pageStart = $state('');
	let pageEnd = $state('');
	let sortOrder = $state('0');
	let tsv = $state('');
	let pending = $state(false);

	$effect(() => {
		const row = existing;
		locator = row?.locator ?? '';
		label = row?.label ?? '';
		pageStart = row?.page_start != null ? String(row.page_start) : '';
		pageEnd = row?.page_end != null ? String(row.page_end) : '';
		sortOrder = row?.sort_order != null ? String(row.sort_order) : '0';
	});

	const submit: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				const data = result.data as { success?: boolean } | undefined;
				if (data?.success) onSaved?.();
			}
		};
	};
</script>

{#if mode === 'paste'}
	<form
		method="POST"
		action="?/pasteOutlineSections"
		use:enhance={submit}
		class="space-y-3 rounded-lg border border-border bg-muted/20 p-3"
	>
		<input type="hidden" name="book_id" value={bookId} />
		<div>
			<Label for="outline-tsv" class="text-xs uppercase tracking-wide text-muted-foreground">
				Paste TOC (TSV)
			</Label>
			<p class="mt-1 text-xs text-muted-foreground">
				One row per line: <code class="text-[11px]">locator&#9;label&#9;pages</code> or
				<code class="text-[11px]">label&#9;pages</code>. Pages like
				<code class="text-[11px]">610-630</code> or <code class="text-[11px]">136</code>.
			</p>
			<textarea
				id="outline-tsv"
				name="tsv"
				bind:value={tsv}
				rows="8"
				required
				placeholder={"XV.17\tFull Assurance\t610-630\nRepentance\t136"}
				class="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
			></textarea>
		</div>
		{#if formMessage?.message}
			<p class="text-sm text-destructive">{formMessage.message}</p>
		{/if}
		<div class="flex flex-wrap gap-2">
			<Button type="submit" hotkey="s" label={pending ? 'Importing…' : 'Import rows'} disabled={pending} />
			{#if onCancel}
				<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={() => onCancel?.()} />
			{/if}
		</div>
	</form>
{:else}
	<form
		method="POST"
		action={isEdit ? '?/updateOutlineSection' : '?/createOutlineSection'}
		use:enhance={submit}
		class="space-y-3 rounded-lg border border-border bg-muted/20 p-3"
	>
		<input type="hidden" name="book_id" value={bookId} />
		{#if isEdit && existing}
			<input type="hidden" name="section_id" value={existing.id} />
		{/if}

		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<Label for="outline-locator" class="text-xs uppercase tracking-wide text-muted-foreground">
					Locator <span class="normal-case tracking-normal text-muted-foreground/80">(optional)</span>
				</Label>
				<Input
					id="outline-locator"
					name="locator"
					bind:value={locator}
					placeholder="XV.17"
					class="mt-1 h-10"
				/>
			</div>
			<div>
				<Label for="outline-sort" class="text-xs uppercase tracking-wide text-muted-foreground">
					Sort
				</Label>
				<Input
					id="outline-sort"
					name="sort_order"
					type="number"
					inputmode="numeric"
					bind:value={sortOrder}
					class="mt-1 h-10 tabular-nums"
				/>
			</div>
		</div>

		<div>
			<Label for="outline-label" class="text-xs uppercase tracking-wide text-muted-foreground">
				Label
			</Label>
			<Input
				id="outline-label"
				name="label"
				bind:value={label}
				placeholder="Full Assurance"
				required
				class="mt-1 h-10"
			/>
		</div>

		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<Label for="outline-page-start" class="text-xs uppercase tracking-wide text-muted-foreground">
					Page start
				</Label>
				<Input
					id="outline-page-start"
					name="page_start"
					type="number"
					inputmode="numeric"
					min="1"
					bind:value={pageStart}
					required
					class="mt-1 h-10 tabular-nums"
				/>
			</div>
			<div>
				<Label for="outline-page-end" class="text-xs uppercase tracking-wide text-muted-foreground">
					Page end
				</Label>
				<Input
					id="outline-page-end"
					name="page_end"
					type="number"
					inputmode="numeric"
					min="1"
					bind:value={pageEnd}
					placeholder="same as start"
					class="mt-1 h-10 tabular-nums"
				/>
			</div>
		</div>

		{#if formMessage?.message}
			<p class="text-sm text-destructive">{formMessage.message}</p>
		{/if}

		<div class="flex flex-wrap gap-2">
			<Button
				type="submit"
				hotkey={isEdit ? 'u' : 's'}
				label={pending ? (isEdit ? 'Updating…' : 'Saving…') : isEdit ? 'Update section' : 'Save section'}
				disabled={pending}
			/>
			{#if onCancel}
				<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={() => onCancel?.()} />
			{/if}
		</div>
	</form>
{/if}

<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { PassageSectionRow } from '$lib/types/library';

	type FormMessage = { message?: string } | null | undefined;

	let {
		bookId,
		bibleBookNames,
		existing = null,
		formMessage = null,
		onSaved,
		onCancel
	}: {
		bookId: string;
		bibleBookNames: string[];
		existing?: PassageSectionRow | null;
		formMessage?: FormMessage;
		onSaved?: (sectionId: string) => void;
		onCancel?: () => void;
	} = $props();

	const isEdit = $derived(!!existing);

	let label = $state('');
	let bibleBook = $state('');
	let chapterStart = $state('');
	let verseStart = $state('');
	let chapterEnd = $state('');
	let verseEnd = $state('');
	let pageStart = $state('');
	let pageEnd = $state('');
	let pending = $state(false);

	$effect(() => {
		const row = existing;
		label = row?.label ?? '';
		bibleBook = row?.bible_book ?? '';
		chapterStart = row?.chapter_start != null ? String(row.chapter_start) : '';
		verseStart = row?.verse_start != null ? String(row.verse_start) : '';
		chapterEnd = row?.chapter_end != null ? String(row.chapter_end) : '';
		verseEnd = row?.verse_end != null ? String(row.verse_end) : '';
		pageStart = row?.page_start ?? '';
		pageEnd = row?.page_end ?? '';
	});

	const submit: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				const data = result.data as { sectionId?: string; success?: boolean } | undefined;
				if (data?.success && data.sectionId) onSaved?.(data.sectionId);
			}
		};
	};
</script>

<form
	method="POST"
	action={isEdit ? '?/updatePassageSection' : '?/createPassageSection'}
	use:enhance={submit}
	class="space-y-3 rounded-lg border border-border bg-muted/20 p-3"
>
	<input type="hidden" name="book_id" value={bookId} />
	{#if isEdit && existing}
		<input type="hidden" name="section_id" value={existing.id} />
	{/if}

	<div>
		<Label for="section-label" class="text-xs uppercase tracking-wide text-muted-foreground">
			Label <span class="normal-case tracking-normal text-muted-foreground/80">(optional)</span>
		</Label>
		<Input
			id="section-label"
			name="label"
			bind:value={label}
			placeholder="Sermon on the Mount"
			class="mt-1 h-10"
		/>
	</div>

	<div>
		<Label for="section-bible-book" class="text-xs uppercase tracking-wide text-muted-foreground">
			Bible book
		</Label>
		<select
			id="section-bible-book"
			name="bible_book"
			bind:value={bibleBook}
			required
			class="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
		>
			<option value="" disabled>— Select —</option>
			{#each bibleBookNames as name (name)}
				<option value={name}>{name}</option>
			{/each}
		</select>
	</div>

	<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
		<div>
			<Label for="section-cs" class="text-xs uppercase tracking-wide text-muted-foreground"
				>Ch start</Label
			>
			<Input
				id="section-cs"
				name="chapter_start"
				type="number"
				inputmode="numeric"
				min="1"
				bind:value={chapterStart}
				class="mt-1 h-10 tabular-nums"
			/>
		</div>
		<div>
			<Label for="section-vs" class="text-xs uppercase tracking-wide text-muted-foreground"
				>V start</Label
			>
			<Input
				id="section-vs"
				name="verse_start"
				type="number"
				inputmode="numeric"
				min="1"
				bind:value={verseStart}
				class="mt-1 h-10 tabular-nums"
			/>
		</div>
		<div>
			<Label for="section-ce" class="text-xs uppercase tracking-wide text-muted-foreground"
				>Ch end</Label
			>
			<Input
				id="section-ce"
				name="chapter_end"
				type="number"
				inputmode="numeric"
				min="1"
				bind:value={chapterEnd}
				class="mt-1 h-10 tabular-nums"
			/>
		</div>
		<div>
			<Label for="section-ve" class="text-xs uppercase tracking-wide text-muted-foreground"
				>V end</Label
			>
			<Input
				id="section-ve"
				name="verse_end"
				type="number"
				inputmode="numeric"
				min="1"
				bind:value={verseEnd}
				class="mt-1 h-10 tabular-nums"
			/>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-2">
		<div>
			<Label for="section-ps" class="text-xs uppercase tracking-wide text-muted-foreground"
				>Page start</Label
			>
			<Input
				id="section-ps"
				name="page_start"
				bind:value={pageStart}
				required
				class="mt-1 h-10"
			/>
		</div>
		<div>
			<Label for="section-pe" class="text-xs uppercase tracking-wide text-muted-foreground"
				>Page end</Label
			>
			<Input id="section-pe" name="page_end" bind:value={pageEnd} class="mt-1 h-10" />
		</div>
	</div>

	{#if formMessage?.message}
		<p class="text-sm text-destructive">{formMessage.message}</p>
	{/if}

	<div class="flex flex-wrap justify-end gap-2">
		{#if onCancel}
			<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={onCancel} />
		{/if}
		<Button
			type="submit"
			hotkey={isEdit ? 'u' : 's'}
			label={pending ? (isEdit ? 'Updating…' : 'Saving…') : isEdit ? 'Update section' : 'Save section'}
			disabled={pending}
		/>
	</div>
</form>

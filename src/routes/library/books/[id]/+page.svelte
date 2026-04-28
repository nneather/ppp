<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import {
		AUTHOR_ROLE_LABELS,
		LANGUAGE_LABELS,
		READING_STATUSES,
		READING_STATUS_LABELS
	} from '$lib/types/library';
	import type { ReadingStatus } from '$lib/types/library';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let deletePending = $state(false);
	let statusOptimistic = $state<ReadingStatus | null>(null);

	const effectiveStatus = $derived<ReadingStatus>(
		statusOptimistic ?? data.book.reading_status
	);

	const statusSubmit: SubmitFunction = ({ formData }) => {
		const next = formData.get('reading_status');
		if (typeof next === 'string') {
			statusOptimistic = next as ReadingStatus;
		}
		return async ({ update }) => {
			await update({ reset: false });
			statusOptimistic = null;
		};
	};

	function statusToneClasses(s: ReadingStatus): string {
		switch (s) {
			case 'in_progress':
				return 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-200';
			case 'read':
				return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
			case 'reference':
				return 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-200';
			case 'n_a':
				return 'border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-200';
			default:
				return 'border-border bg-muted text-muted-foreground';
		}
	}

	// Detail-page delete: server action returns redirect(303, '/library?deleted=...')
	// after a successful soft-delete, which use:enhance follows automatically.
	// The list page renders the 10s undo toast.
	const deleteEnhance: SubmitFunction = () => {
		deletePending = true;
		return async ({ update }) => {
			await update({ reset: false });
			deletePending = false;
		};
	};

	function fmtYearChunk(): string {
		const parts: string[] = [];
		if (data.book.publisher_location) parts.push(data.book.publisher_location);
		if (data.book.publisher) parts.push(data.book.publisher);
		const head = parts.join(': ');
		const yearStr = data.book.year != null ? String(data.book.year) : '';
		return [head, yearStr].filter((s) => s.length > 0).join(', ');
	}
</script>

<svelte:head>
	<title>{data.book.title ?? '(untitled)'} — Library — ppp</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
	<a href="/library" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
		<ArrowLeft class="size-4" /> Library
	</a>

	<header class="mt-4 flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2 text-muted-foreground">
				<BookOpen class="size-5" />
				{#if data.book.genre}
					<span class="text-xs uppercase tracking-wide">{data.book.genre}</span>
				{/if}
				{#if data.book.needs_review}
					<span
						class="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200"
					>
						<AlertCircle class="size-3" /> Needs review
					</span>
				{/if}
			</div>
			<h1 class="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
				{#if data.book.title}
					{data.book.title}
				{:else}
					<span class="italic text-muted-foreground">(untitled book)</span>
				{/if}
				{#if data.book.volume_number}<span class="text-muted-foreground">, vol. {data.book.volume_number}</span>{/if}
			</h1>
			{#if data.book.subtitle}
				<p class="mt-1 text-base text-muted-foreground">{data.book.subtitle}</p>
			{/if}
			{#if data.book.authors.length > 0}
				<p class="mt-2 text-sm text-foreground">
					{#each data.book.authors as a, i (a.person_id + a.role)}
						<span>
							{a.person_label}
							{#if a.role !== 'author'}
								<span class="text-muted-foreground">({AUTHOR_ROLE_LABELS[a.role]})</span>
							{/if}
						</span>{#if i < data.book.authors.length - 1},
						{/if}
					{/each}
				</p>
			{/if}
		</div>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" href={`/library/books/${data.book.id}/edit`}>
				<Pencil class="size-4" /> Edit
			</Button>
			<form method="POST" action="?/softDeleteBook" use:enhance={deleteEnhance} class="contents">
				<input type="hidden" name="id" value={data.book.id} />
				<Button type="submit" variant="destructive" disabled={deletePending}>
					<Trash2 class="size-4" /> {deletePending ? 'Deleting…' : 'Delete'}
				</Button>
			</form>
		</div>
	</header>

	{#if data.book.needs_review_note}
		<p class="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
			<strong class="font-semibold">Review note:</strong> {data.book.needs_review_note}
		</p>
	{/if}

	<div class="mt-6 grid gap-6 md:grid-cols-3">
		<dl class="md:col-span-2 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
			<dt class="font-medium text-muted-foreground">Publication</dt>
			<dd>{fmtYearChunk() || '—'}</dd>

			{#if data.book.edition}
				<dt class="font-medium text-muted-foreground">Edition</dt>
				<dd>{data.book.edition}</dd>
			{/if}

			{#if data.book.total_volumes}
				<dt class="font-medium text-muted-foreground">Total volumes</dt>
				<dd>{data.book.total_volumes}</dd>
			{/if}

			{#if data.book.original_year || data.book.reprint_year || data.book.reprint_publisher || data.book.reprint_location}
				<dt class="font-medium text-muted-foreground">Reprint</dt>
				<dd>
					{#if data.book.original_year}orig. {data.book.original_year}; {/if}
					{[data.book.reprint_location, data.book.reprint_publisher, data.book.reprint_year]
						.filter((s): s is string | number => s != null && String(s).length > 0)
						.join(', ')}
				</dd>
			{/if}

			{#if data.book.page_count}
				<dt class="font-medium text-muted-foreground">Pages</dt>
				<dd>{data.book.page_count}</dd>
			{/if}

			<dt class="font-medium text-muted-foreground">Primary category</dt>
			<dd>
				{#if data.book.primary_category_name}
					{data.book.primary_category_name}
				{:else}
					<span class="text-muted-foreground italic">(uncategorized)</span>
				{/if}
			</dd>

			{#if data.book.category_ids.length > (data.book.primary_category_id ? 1 : 0)}
				<dt class="font-medium text-muted-foreground">Other categories</dt>
				<dd>
					{data.categories
						.filter(
							(c) =>
								data.book.category_ids.includes(c.id) &&
								c.id !== data.book.primary_category_id
						)
						.map((c) => c.name)
						.join(', ') || '—'}
				</dd>
			{/if}

			{#if data.book.series_name}
				<dt class="font-medium text-muted-foreground">Series</dt>
				<dd>
					{data.book.series_abbreviation
						? `${data.book.series_abbreviation} — ${data.book.series_name}`
						: data.book.series_name}
				</dd>
			{/if}

			<dt class="font-medium text-muted-foreground">Language</dt>
			<dd>{LANGUAGE_LABELS[data.book.language]}</dd>

			{#if data.book.isbn}
				<dt class="font-medium text-muted-foreground">ISBN</dt>
				<dd class="font-mono text-xs">{data.book.isbn}</dd>
			{/if}
			{#if data.book.barcode}
				<dt class="font-medium text-muted-foreground">Barcode</dt>
				<dd class="font-mono text-xs">{data.book.barcode}</dd>
			{/if}
			{#if data.book.shelving_location}
				<dt class="font-medium text-muted-foreground">Shelf</dt>
				<dd>{data.book.shelving_location}</dd>
			{/if}
			{#if data.book.borrowed_to}
				<dt class="font-medium text-muted-foreground">On loan to</dt>
				<dd>{data.book.borrowed_to}</dd>
			{/if}
		</dl>

		<aside class="flex flex-col gap-3">
			<div class="rounded-xl border border-border bg-card p-4 text-card-foreground">
				<div class="text-xs uppercase tracking-wide text-muted-foreground">Reading status</div>
				<form
					method="POST"
					action="?/updateReadingStatus"
					use:enhance={statusSubmit}
					class="mt-2"
				>
					<input type="hidden" name="id" value={data.book.id} />
					<select
						name="reading_status"
						value={effectiveStatus}
						onchange={(e) => (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()}
						class={`w-full rounded-md border bg-background px-2 py-1.5 text-sm ${statusToneClasses(effectiveStatus)}`}
						aria-label="Reading status"
					>
						{#each READING_STATUSES as s (s)}
							<option value={s}>{READING_STATUS_LABELS[s]}</option>
						{/each}
					</select>
				</form>
				{#if data.book.rating}
					<p class="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Rating</p>
					<p class="text-lg font-semibold">{data.book.rating} / 5</p>
				{/if}
			</div>

			{#if data.book.personal_notes}
				<div class="rounded-xl border border-border bg-card p-4 text-card-foreground">
					<div class="text-xs uppercase tracking-wide text-muted-foreground">Personal notes</div>
					<p class="mt-2 whitespace-pre-wrap text-sm">{data.book.personal_notes}</p>
				</div>
			{/if}
		</aside>
	</div>
</div>

<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import BookFormSheet from '$lib/components/book-form-sheet.svelte';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Plus from '@lucide/svelte/icons/plus';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import { READING_STATUS_LABELS } from '$lib/types/library';
	import type { ReadingStatus } from '$lib/types/library';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let createSheetOpen = $state(false);

	const formMessage = $derived.by(() => {
		const f = form as { kind?: string; message?: string } | null;
		if (!f) return null;
		if (f.kind === 'createBook') return f;
		return null;
	});

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

	async function onSaved(bookId: string) {
		await invalidateAll();
		goto(`/library/books/${bookId}`);
	}
</script>

<svelte:head>
	<title>Library — ppp</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
	<header class="flex flex-wrap items-center gap-3">
		<div class="flex items-center gap-2 text-muted-foreground">
			<BookOpen class="size-6" />
			<h1 class="text-2xl font-semibold tracking-tight text-foreground">Library</h1>
		</div>
		<span class="text-sm text-muted-foreground">
			{data.books.length} book{data.books.length === 1 ? '' : 's'}
		</span>
		<div class="ml-auto">
			<Button type="button" onclick={() => (createSheetOpen = true)} class="gap-2">
				<Plus class="size-4" /> Add book
			</Button>
		</div>
	</header>

	{#if data.recentlyDeletedId}
		<p class="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
			Book deleted. <a href="/library" class="underline">Dismiss</a>
		</p>
	{/if}

	{#if data.books.length === 0}
		<div class="mt-10 rounded-xl border border-dashed border-border p-8 text-center">
			<BookOpen class="mx-auto size-8 text-muted-foreground" />
			<p class="mt-3 text-sm text-muted-foreground">No books yet. Add one to get started.</p>
			<Button class="mt-4" onclick={() => (createSheetOpen = true)}>
				<Plus class="size-4" /> Add book
			</Button>
		</div>
	{:else}
		<!-- Mobile cards -->
		<ul class="mt-6 flex flex-col gap-3 md:hidden">
			{#each data.books as b (b.id)}
				<li>
					<a
						href={`/library/books/${b.id}`}
						class="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 text-card-foreground transition-colors hover:border-ring/50"
					>
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<p class="truncate text-base font-medium leading-snug">
									{b.title}{#if b.volume_number}, vol. {b.volume_number}{/if}
								</p>
								{#if b.subtitle}
									<p class="truncate text-sm text-muted-foreground">{b.subtitle}</p>
								{/if}
								{#if b.authors_label}
									<p class="mt-0.5 truncate text-xs text-muted-foreground">{b.authors_label}</p>
								{/if}
							</div>
							{#if b.needs_review}
								<span
									class="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200"
								>
									<AlertCircle class="size-3" /> Review
								</span>
							{/if}
						</div>
						<div class="flex flex-wrap items-center gap-1.5 text-[11px]">
							<span class="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
								{b.genre}
							</span>
							{#if b.primary_category_name}
								<span class="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
									{b.primary_category_name}
								</span>
							{/if}
							{#if b.series_abbreviation}
								<span class="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
									{b.series_abbreviation}
								</span>
							{/if}
							<span class={`rounded-full border px-2 py-0.5 ${statusToneClasses(b.reading_status)}`}>
								{READING_STATUS_LABELS[b.reading_status]}
							</span>
						</div>
					</a>
				</li>
			{/each}
		</ul>

		<!-- Desktop table -->
		<div class="mt-6 hidden overflow-x-auto rounded-xl border border-border md:block">
			<table class="min-w-full divide-y divide-border text-sm">
				<thead class="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
					<tr>
						<th class="px-4 py-2">Title</th>
						<th class="px-4 py-2">Authors</th>
						<th class="px-4 py-2">Genre</th>
						<th class="px-4 py-2">Series</th>
						<th class="px-4 py-2">Status</th>
						<th class="px-4 py-2 text-right">Flags</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each data.books as b (b.id)}
						<tr class="hover:bg-muted/20">
							<td class="px-4 py-2.5">
								<a href={`/library/books/${b.id}`} class="block">
									<span class="font-medium">{b.title}</span>
									{#if b.volume_number}<span class="text-muted-foreground">, vol. {b.volume_number}</span>{/if}
									{#if b.subtitle}
										<p class="text-xs text-muted-foreground">{b.subtitle}</p>
									{/if}
								</a>
							</td>
							<td class="px-4 py-2.5 text-muted-foreground">{b.authors_label ?? '—'}</td>
							<td class="px-4 py-2.5 text-muted-foreground">{b.genre}</td>
							<td class="px-4 py-2.5 text-muted-foreground">{b.series_abbreviation ?? '—'}</td>
							<td class="px-4 py-2.5">
								<span class={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${statusToneClasses(b.reading_status)}`}>
									{READING_STATUS_LABELS[b.reading_status]}
								</span>
							</td>
							<td class="px-4 py-2.5 text-right">
								{#if b.needs_review}
									<span
										class="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200"
									>
										<AlertCircle class="size-3" /> Review
									</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<BookFormSheet
	bind:open={createSheetOpen}
	mode="create"
	book={null}
	people={data.people}
	personBookCounts={data.personBookCounts}
	categories={data.categories}
	series={data.series}
	{formMessage}
	{onSaved}
/>

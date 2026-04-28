<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Plus from '@lucide/svelte/icons/plus';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { READING_STATUSES, READING_STATUS_LABELS } from '$lib/types/library';
	import type { ReadingStatus } from '$lib/types/library';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// 10s undo toast for soft-deletes coming back from the detail-page redirect.
	let undoToastVisible = $state(false);
	let undoToastBookId = $state<string | null>(null);
	let undoTimer = $state<number | null>(null);
	let undoPending = $state(false);
	/** Track which deleted-id we've already shown the toast for so we don't
	 * reopen it after a manual dismiss. */
	let toastShownForId = $state<string | null>(null);

	$effect(() => {
		if (!browser) return;
		const id = data.recentlyDeletedId;
		if (!id) return;
		if (toastShownForId === id) return;
		toastShownForId = id;
		undoToastBookId = id;
		undoToastVisible = true;
		if (undoTimer != null) clearTimeout(undoTimer);
		undoTimer = window.setTimeout(() => {
			closeToastAndStripQuery();
		}, 10_000);
	});

	function closeToastAndStripQuery() {
		undoToastVisible = false;
		undoToastBookId = null;
		if (undoTimer != null) {
			clearTimeout(undoTimer);
			undoTimer = null;
		}
		if (browser) {
			const url = new URL(window.location.href);
			url.searchParams.delete('deleted');
			goto(url.pathname + (url.search || ''), { replaceState: true, keepFocus: true });
		}
	}

	const undoEnhance: SubmitFunction = () => {
		undoPending = true;
		return async ({ result, update }) => {
			undoPending = false;
			if (undoTimer != null) {
				clearTimeout(undoTimer);
				undoTimer = null;
			}
			await update({ reset: false });
			if (result.type === 'success') {
				undoToastVisible = false;
				const restoredId = undoToastBookId;
				undoToastBookId = null;
				await invalidateAll();
				if (browser && restoredId) {
					goto(`/library/books/${restoredId}`);
				}
			}
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

	/** Optimistic patch so the badge tone updates instantly without a full reload. */
	let statusOptimistic = $state<Record<string, ReadingStatus>>({});
	function effectiveStatus(b: { id: string; reading_status: ReadingStatus }): ReadingStatus {
		return statusOptimistic[b.id] ?? b.reading_status;
	}

	function statusSubmit(bookId: string): SubmitFunction {
		return ({ formData }) => {
			const next = formData.get('reading_status');
			if (typeof next === 'string') {
				statusOptimistic = { ...statusOptimistic, [bookId]: next as ReadingStatus };
			}
			return async ({ update }) => {
				await update({ reset: false });
			};
		};
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
			<Button href="/library/books/new" class="gap-2">
				<Plus class="size-4" /> Add book
			</Button>
		</div>
	</header>

	{#if data.books.length === 0}
		<div class="mt-10 rounded-xl border border-dashed border-border p-8 text-center">
			<BookOpen class="mx-auto size-8 text-muted-foreground" />
			<p class="mt-3 text-sm text-muted-foreground">No books yet. Add one to get started.</p>
			<Button href="/library/books/new" class="mt-4">
				<Plus class="size-4" /> Add book
			</Button>
		</div>
	{:else}
		<!-- Mobile cards -->
		<ul class="mt-6 flex flex-col gap-3 md:hidden">
			{#each data.books as b (b.id)}
				<li class="rounded-xl border border-border bg-card p-4 text-card-foreground transition-colors hover:border-ring/50">
					<a href={`/library/books/${b.id}`} class="flex flex-col gap-1.5">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<p class="truncate text-base font-medium leading-snug">
									{#if b.title}{b.title}{:else}<span class="italic text-muted-foreground">(untitled)</span>{/if}{#if b.volume_number}, vol. {b.volume_number}{/if}
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
							{#if b.genre}
								<span class="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
									{b.genre}
								</span>
							{/if}
							{#if b.primary_category_name}
								<span class="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
									{b.primary_category_name}
								</span>
							{/if}
							{#if b.series_abbreviation}
								<span
									class="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground"
									title={b.series_name ?? undefined}
								>
									{b.series_abbreviation}
								</span>
							{/if}
						</div>
					</a>
					<form
						method="POST"
						action="?/updateReadingStatus"
						use:enhance={statusSubmit(b.id)}
						class="mt-3"
					>
						<input type="hidden" name="id" value={b.id} />
						<select
							name="reading_status"
							value={effectiveStatus(b)}
							onchange={(e) => (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()}
							class={`w-full rounded-md border bg-background px-2 py-1.5 text-xs ${statusToneClasses(effectiveStatus(b))}`}
							aria-label="Reading status"
						>
							{#each READING_STATUSES as s (s)}
								<option value={s}>{READING_STATUS_LABELS[s]}</option>
							{/each}
						</select>
					</form>
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
									{#if b.title}
										<span class="font-medium">{b.title}</span>
									{:else}
										<span class="italic text-muted-foreground">(untitled)</span>
									{/if}
									{#if b.volume_number}<span class="text-muted-foreground">, vol. {b.volume_number}</span>{/if}
									{#if b.subtitle}
										<p class="text-xs text-muted-foreground">{b.subtitle}</p>
									{/if}
								</a>
							</td>
							<td class="px-4 py-2.5 text-muted-foreground">{b.authors_label ?? '—'}</td>
							<td class="px-4 py-2.5 text-muted-foreground">{b.genre ?? '—'}</td>
							<td
								class="px-4 py-2.5 text-muted-foreground"
								title={b.series_name ?? undefined}
							>
								{b.series_abbreviation ?? '—'}
							</td>
							<td class="px-4 py-2.5">
								<form
									method="POST"
									action="?/updateReadingStatus"
									use:enhance={statusSubmit(b.id)}
								>
									<input type="hidden" name="id" value={b.id} />
									<select
										name="reading_status"
										value={effectiveStatus(b)}
										onchange={(e) => (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()}
										class={`rounded-md border bg-background px-2 py-1 text-xs ${statusToneClasses(effectiveStatus(b))}`}
										aria-label="Reading status"
									>
										{#each READING_STATUSES as s (s)}
											<option value={s}>{READING_STATUS_LABELS[s]}</option>
										{/each}
									</select>
								</form>
							</td>
							<td class="px-4 py-2.5 text-right">
								{#if b.needs_review}
									<span
										class="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200"
										title="Review queue ships in a later session"
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

{#if undoToastVisible && undoToastBookId}
	<div
		class="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-full max-w-sm items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg md:bottom-6"
		role="status"
	>
		<Trash2 class="size-4 text-muted-foreground" />
		<span class="flex-1">Book deleted.</span>
		<form method="POST" action="?/undoSoftDeleteBook" use:enhance={undoEnhance}>
			<input type="hidden" name="id" value={undoToastBookId} />
			<Button type="submit" size="sm" variant="outline" disabled={undoPending} class="gap-1">
				<Undo2 class="size-3.5" /> {undoPending ? 'Undoing…' : 'Undo'}
			</Button>
		</form>
		<Button type="button" size="sm" variant="ghost" onclick={closeToastAndStripQuery}>
			Dismiss
		</Button>
	</div>
{/if}

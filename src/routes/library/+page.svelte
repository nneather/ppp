<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Sheet from '$lib/components/ui/sheet';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Plus from '@lucide/svelte/icons/plus';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import Search from '@lucide/svelte/icons/search';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import {
		GENRES,
		LANGUAGES,
		LANGUAGE_LABELS,
		READING_STATUSES,
		READING_STATUS_LABELS
	} from '$lib/types/library';
	import type { ReadingStatus, Language, BookListFilters } from '$lib/types/library';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// 10s undo toast for soft-deletes coming back from the detail-page redirect.
	let undoToastVisible = $state(false);
	let undoToastBookId = $state<string | null>(null);
	let undoTimer = $state<number | null>(null);
	let undoPending = $state(false);
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

	// -------------------------------------------------------------------------
	// Filters: URL-param-driven state.
	// `data.filters` is the parsed snapshot from +page.server.ts — render
	// against that for SSR-safety, mutate via goto() on toggle.
	// -------------------------------------------------------------------------

	const filters = $derived<BookListFilters>(data.filters);
	let mobileFilterOpen = $state(false);

	/** Local mirror of the keyword input so typing feels instant — debounce
	 * the URL update so we don't refetch on every keystroke. Initialized
	 * empty then hydrated by the effect below so the snapshot warning
	 * doesn't fire; the effect tracks `filters.q` for back/forward sync too. */
	let qInput = $state('');
	$effect(() => {
		qInput = filters.q ?? '';
	});

	let qDebounce: number | null = null;
	function onQInput(e: Event & { currentTarget: HTMLInputElement }) {
		qInput = e.currentTarget.value;
		if (!browser) return;
		if (qDebounce != null) clearTimeout(qDebounce);
		qDebounce = window.setTimeout(() => {
			pushFilters({ ...filters, q: qInput.trim() || undefined });
		}, 200);
	}

	/** Build the next URL from a filter object and navigate. Empty arrays /
	 * empty strings drop the param entirely so back/forward gives a clean URL. */
	function pushFilters(next: BookListFilters) {
		if (!browser) return;
		const url = new URL(page.url);
		const params = url.searchParams;
		// Preserve unrelated params (`deleted` on toast redirect).
		const keep = new URLSearchParams();
		for (const [k, v] of params.entries()) {
			if (k === 'deleted') keep.set(k, v);
		}
		const setMulti = (key: string, vals: readonly string[] | undefined) => {
			if (!vals || vals.length === 0) return;
			for (const v of vals) keep.append(key, v);
		};
		setMulti('genre', next.genre);
		setMulti('category_id', next.category_id);
		setMulti('series_id', next.series_id);
		setMulti('language', next.language);
		setMulti('reading_status', next.reading_status);
		if (next.needs_review === true) keep.set('needs_review', 'true');
		if (next.q && next.q.length > 0) keep.set('q', next.q);
		const search = keep.toString();
		const target = url.pathname + (search ? `?${search}` : '');
		goto(target, { replaceState: false, keepFocus: true, noScroll: true });
	}

	function toggleArrayFilter<K extends keyof BookListFilters>(
		key: K,
		value: string
	) {
		const current = (filters[key] as string[] | undefined) ?? [];
		const has = current.includes(value);
		const nextArr = has ? current.filter((v) => v !== value) : [...current, value];
		pushFilters({ ...filters, [key]: nextArr.length === 0 ? undefined : nextArr });
	}

	function toggleNeedsReview() {
		pushFilters({ ...filters, needs_review: filters.needs_review ? undefined : true });
	}

	function clearAll() {
		qInput = '';
		pushFilters({});
	}

	const hasAnyFilter = $derived(
		Boolean(
			(filters.genre?.length ?? 0) > 0 ||
				(filters.category_id?.length ?? 0) > 0 ||
				(filters.series_id?.length ?? 0) > 0 ||
				(filters.language?.length ?? 0) > 0 ||
				(filters.reading_status?.length ?? 0) > 0 ||
				filters.needs_review === true ||
				(filters.q && filters.q.length > 0)
		)
	);

	const activeFilterCount = $derived(
		(filters.genre?.length ?? 0) +
			(filters.category_id?.length ?? 0) +
			(filters.series_id?.length ?? 0) +
			(filters.language?.length ?? 0) +
			(filters.reading_status?.length ?? 0) +
			(filters.needs_review === true ? 1 : 0)
	);

	function chipBaseClasses(active: boolean): string {
		return active
			? 'border-primary bg-primary text-primary-foreground'
			: 'border-border bg-background text-foreground hover:bg-muted';
	}

	function categoryName(id: string): string {
		return data.categories.find((c) => c.id === id)?.name ?? id;
	}
	function seriesLabel(id: string): string {
		const s = data.series.find((s) => s.id === id);
		if (!s) return id;
		return s.abbreviation ? `${s.abbreviation} — ${s.name}` : s.name;
	}
</script>

{#snippet filterBody()}
	<div class="flex flex-col gap-5">
		<section>
			<h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Genre</h3>
			<div class="flex flex-wrap gap-1.5">
				{#each GENRES as g (g)}
					{@const active = filters.genre?.includes(g) ?? false}
					<button
						type="button"
						class={`rounded-full border px-2.5 py-1 text-xs transition-colors ${chipBaseClasses(active)}`}
						onclick={() => toggleArrayFilter('genre', g)}
						aria-pressed={active}
					>
						{g}
					</button>
				{/each}
			</div>
		</section>

		<section>
			<h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</h3>
			<div class="flex flex-wrap gap-1.5">
				{#each data.categories as c (c.id)}
					{@const active = filters.category_id?.includes(c.id) ?? false}
					<button
						type="button"
						class={`rounded-full border px-2.5 py-1 text-xs transition-colors ${chipBaseClasses(active)}`}
						onclick={() => toggleArrayFilter('category_id', c.id)}
						aria-pressed={active}
					>
						{c.name}
					</button>
				{/each}
			</div>
		</section>

		{#if data.series.length > 0}
			<section>
				<h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Series</h3>
				<div class="flex flex-wrap gap-1.5">
					{#each data.series as s (s.id)}
						{@const active = filters.series_id?.includes(s.id) ?? false}
						<button
							type="button"
							class={`rounded-full border px-2.5 py-1 text-xs transition-colors ${chipBaseClasses(active)}`}
							onclick={() => toggleArrayFilter('series_id', s.id)}
							aria-pressed={active}
							title={s.name}
						>
							{s.abbreviation ?? s.name}
						</button>
					{/each}
				</div>
			</section>
		{/if}

		<section>
			<h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Language</h3>
			<div class="flex flex-wrap gap-1.5">
				{#each LANGUAGES as l (l)}
					{@const active = filters.language?.includes(l as Language) ?? false}
					<button
						type="button"
						class={`rounded-full border px-2.5 py-1 text-xs transition-colors ${chipBaseClasses(active)}`}
						onclick={() => toggleArrayFilter('language', l)}
						aria-pressed={active}
					>
						{LANGUAGE_LABELS[l as Language]}
					</button>
				{/each}
			</div>
		</section>

		<section>
			<h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reading status</h3>
			<div class="flex flex-wrap gap-1.5">
				{#each READING_STATUSES as s (s)}
					{@const active = filters.reading_status?.includes(s as ReadingStatus) ?? false}
					<button
						type="button"
						class={`rounded-full border px-2.5 py-1 text-xs transition-colors ${chipBaseClasses(active)}`}
						onclick={() => toggleArrayFilter('reading_status', s)}
						aria-pressed={active}
					>
						{READING_STATUS_LABELS[s as ReadingStatus]}
					</button>
				{/each}
			</div>
		</section>

		<section>
			<h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Flags</h3>
			<button
				type="button"
				class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${chipBaseClasses(filters.needs_review === true)}`}
				onclick={toggleNeedsReview}
				aria-pressed={filters.needs_review === true}
			>
				<AlertCircle class="size-3.5" /> Needs review
			</button>
		</section>
	</div>
{/snippet}

<svelte:head>
	<title>Library — ppp</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
	<header class="flex flex-wrap items-center gap-3">
		<div class="flex items-center gap-2 text-muted-foreground">
			<BookOpen class="size-6" />
			<h1 class="text-2xl font-semibold tracking-tight text-foreground">Library</h1>
		</div>
		<span class="text-sm text-muted-foreground">
			Showing {data.books.length} of {data.totalCount}
		</span>
		<div class="ml-auto flex items-center gap-2">
			{#if filters.needs_review === true && data.books.length > 0}
				<Button variant="outline" href="/library/review" class="gap-2">
					<ClipboardCheck class="size-4" /> Drain queue ({data.books.length})
				</Button>
			{:else}
				<Button variant="outline" href="/library/search-passage">
					<Search class="size-4" /> Search passage
				</Button>
			{/if}
			<Button href="/library/books/new" class="gap-2" hotkey="b">
				<Plus class="size-4" /> <HotkeyLabel label="New book" mnemonic="b" />
			</Button>
		</div>
	</header>

	<!-- Search + mobile filter trigger row -->
	<div class="mt-4 flex flex-wrap items-center gap-2">
		<div class="relative flex-1 min-w-[14rem]">
			<Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				placeholder="Search title, subtitle, or author last name…"
				value={qInput}
				oninput={onQInput}
				class="pl-9"
				aria-label="Search books"
			/>
		</div>
		<Button
			type="button"
			variant="outline"
			class="md:hidden"
			onclick={() => (mobileFilterOpen = true)}
		>
			<SlidersHorizontal class="size-4" />
			Filters
			{#if activeFilterCount > 0}
				<span class="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
					{activeFilterCount}
				</span>
			{/if}
		</Button>
	</div>

	<!-- Active-filter chip rail + clear-all -->
	{#if hasAnyFilter}
		<div class="mt-3 flex flex-wrap items-center gap-1.5">
			{#each filters.genre ?? [] as g (g)}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/15"
					onclick={() => toggleArrayFilter('genre', g)}
				>
					{g} <X class="size-3" />
				</button>
			{/each}
			{#each filters.category_id ?? [] as id (id)}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/15"
					onclick={() => toggleArrayFilter('category_id', id)}
				>
					{categoryName(id)} <X class="size-3" />
				</button>
			{/each}
			{#each filters.series_id ?? [] as id (id)}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/15"
					onclick={() => toggleArrayFilter('series_id', id)}
				>
					{seriesLabel(id)} <X class="size-3" />
				</button>
			{/each}
			{#each filters.language ?? [] as l (l)}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/15"
					onclick={() => toggleArrayFilter('language', l)}
				>
					{LANGUAGE_LABELS[l]} <X class="size-3" />
				</button>
			{/each}
			{#each filters.reading_status ?? [] as s (s)}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/15"
					onclick={() => toggleArrayFilter('reading_status', s)}
				>
					{READING_STATUS_LABELS[s]} <X class="size-3" />
				</button>
			{/each}
			{#if filters.needs_review === true}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-amber-500/60 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-200 transition-colors hover:bg-amber-500/15"
					onclick={toggleNeedsReview}
				>
					<AlertCircle class="size-3" /> Needs review <X class="size-3" />
				</button>
			{/if}
			{#if filters.q}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground transition-colors hover:bg-muted/70"
					onclick={() => {
						qInput = '';
						pushFilters({ ...filters, q: undefined });
					}}
				>
					“{filters.q}” <X class="size-3" />
				</button>
			{/if}
			<button
				type="button"
				class="ml-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
				onclick={clearAll}
			>
				Clear all
			</button>
		</div>
	{/if}

	<div class="mt-6 grid gap-6 md:grid-cols-[16rem_1fr]">
		<!-- Desktop facet panel -->
		<aside class="hidden md:block">
			<div class="sticky top-6 rounded-xl border border-border bg-card p-4 text-card-foreground">
				{@render filterBody()}
			</div>
		</aside>

		<!-- Results -->
		<div class="min-w-0">
			{#if data.books.length === 0 && data.totalCount === 0}
				<div class="rounded-xl border border-dashed border-border p-8 text-center">
					<BookOpen class="mx-auto size-8 text-muted-foreground" />
					<p class="mt-3 text-sm text-muted-foreground">No books yet. Add one to get started.</p>
					<Button href="/library/books/new" class="mt-4">
						<Plus class="size-4" /> Add book
					</Button>
				</div>
			{:else if data.books.length === 0}
				<div class="rounded-xl border border-dashed border-border p-8 text-center">
					<Search class="mx-auto size-8 text-muted-foreground" />
					<p class="mt-3 text-sm text-muted-foreground">
						No books match these filters.
					</p>
					<Button variant="outline" class="mt-4" onclick={clearAll}>
						Clear filters
					</Button>
				</div>
			{:else}
				<!-- Mobile cards -->
				<ul class="flex flex-col gap-3 md:hidden">
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
				<div class="hidden overflow-x-auto rounded-xl border border-border md:block">
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
	</div>
</div>

<!-- Mobile filter sheet (hidden on desktop) -->
<Sheet.Root bind:open={mobileFilterOpen}>
	<Sheet.Content side="bottom" class="max-h-[85vh] overflow-y-auto px-4 pt-3 pb-6">
		<Sheet.Header class="px-0 pt-0 pb-3">
			<Sheet.Title>Filters</Sheet.Title>
			<Sheet.Description class="text-muted-foreground text-xs">
				AND between sections, OR within. Tap to toggle.
			</Sheet.Description>
		</Sheet.Header>
		{@render filterBody()}
		<Sheet.Footer class="mt-4 flex-row justify-between gap-2 border-0 p-0 sm:flex-row">
			<Button
				type="button"
				variant="ghost"
				onclick={clearAll}
				disabled={!hasAnyFilter}
			>
				Clear all
			</Button>
			<Button type="button" onclick={() => (mobileFilterOpen = false)} hotkey="Escape" label="Done" />
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>

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

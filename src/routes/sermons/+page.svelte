<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import PageHeader from '$lib/components/page-header.svelte';
	import SermonFormSheet from '$lib/components/sermon-form-sheet.svelte';
	import SermonsViewToggle from '$lib/components/sermons-view-toggle.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import {
		CONTEXT_TYPES,
		CONTEXT_TYPE_LABELS,
		CONTEXT_TYPE_SHORT,
		CONTEXT_TYPE_BADGE_CLASSES,
		CONTEXT_TYPE_FILTER_ACTIVE_CLASSES,
		type ContextType,
		type SermonListRow,
		type SermonVenueRow
	} from '$lib/types/sermons';
	import { cn } from '$lib/utils';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type FormShape = {
		kind?: string;
		message?: string;
		success?: boolean;
		sermonId?: string;
	};
	const f = $derived((form ?? null) as FormShape | null);

	let venues = $state<SermonVenueRow[]>([]);
	$effect(() => {
		venues = data.venues;
	});

	let sheetOpen = $state(false);
	let sheetMode = $state<'create' | 'edit'>('create');
	let editing = $state<SermonListRow | null>(null);

	let deleteOpen = $state(false);
	let deleteTarget = $state<SermonListRow | null>(null);
	let deletePending = $state(false);
	let deleteFormEl = $state<HTMLFormElement | null>(null);

	const sheetError = $derived.by(() => {
		if (!f || f.success === true) return null;
		if (f.kind === 'createSermon' || f.kind === 'updateSermon') return f.message ?? null;
		return null;
	});

	function openCreate() {
		sheetMode = 'create';
		editing = null;
		sheetOpen = true;
	}

	function openEdit(s: SermonListRow) {
		sheetMode = 'edit';
		editing = s;
		sheetOpen = true;
	}

	function askDelete(s: SermonListRow) {
		deleteTarget = s;
		deleteOpen = true;
	}

	function submitDelete() {
		if (!deleteTarget || !deleteFormEl) return;
		const idInput = deleteFormEl.querySelector(
			'input[name="sermon_id"]'
		) as HTMLInputElement | null;
		if (!idInput) return;
		idInput.value = deleteTarget.id;
		deleteFormEl.requestSubmit();
	}

	const deleteEnhance: SubmitFunction = () => {
		deletePending = true;
		return async ({ result, update }) => {
			deletePending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				deleteOpen = false;
				deleteTarget = null;
				await invalidate('app:sermons:list');
			}
		};
	};

	async function onSaved() {
		await invalidate('app:sermons:list');
	}

	function pushFilters(next: {
		year?: number | null;
		context?: ContextType | null;
		venueId?: string | null;
		bibleBook?: string | null;
	}) {
		const params = new URLSearchParams();
		const year = next.year !== undefined ? next.year : data.filters.year;
		const context = next.context !== undefined ? next.context : data.filters.context;
		const venueId = next.venueId !== undefined ? next.venueId : data.filters.venueId;
		const bibleBook = next.bibleBook !== undefined ? next.bibleBook : data.filters.bibleBook;
		if (year != null) params.set('year', String(year));
		if (context) params.set('context', context);
		if (venueId) params.set('venue', venueId);
		if (bibleBook) params.set('bible_book', bibleBook);
		const qs = params.toString();
		void goto(`/sermons${qs ? `?${qs}` : ''}`, { keepFocus: true, noScroll: true });
	}

	function formatDate(ymd: string): string {
		const [y, m, d] = ymd.split('-').map((x) => Number.parseInt(x, 10));
		if (!y || !m || !d) return ymd;
		return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
			timeZone: 'UTC',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Sermons — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 pb-tabbar">
	<PageHeader title="Sermons" subtitle="Sermons you have preached — draft with a date, fill in later.">
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				<SermonsViewToggle active="list" />
				{#if data.isOwner}
					<Button type="button" class="gap-2" hotkey="b" onclick={openCreate}>
						<Plus class="size-4" />
						<HotkeyLabel label="New sermon" mnemonic="b" />
					</Button>
				{/if}
			</div>
		{/snippet}
	</PageHeader>

	{#if data.loadError}
		<p class="mt-4 text-sm text-destructive" role="alert">{data.loadError}</p>
	{/if}

	{#if data.filters.bibleBook}
		<div
			class="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
		>
			<span class="text-muted-foreground">Bible book:</span>
			<span class="font-medium">{data.filters.bibleBook}</span>
			<button
				type="button"
				class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
				onclick={() => pushFilters({ bibleBook: null })}
			>
				<X class="size-3" />
				Clear
			</button>
			<a
				href="/sermons/by-book"
				class="text-xs text-muted-foreground underline-offset-2 hover:underline"
			>
				Back to by-book
			</a>
		</div>
	{/if}

	<div class="mt-4 flex flex-wrap gap-2">
		<button
			type="button"
			class={cn(
				'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
				data.filters.year == null
					? 'border-foreground bg-foreground text-background'
					: 'border-border text-muted-foreground hover:bg-muted/80'
			)}
			onclick={() => pushFilters({ year: null })}
		>
			All years
		</button>
		{#each data.years as y (y)}
			<button
				type="button"
				class={cn(
					'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
					data.filters.year === y
						? 'border-foreground bg-foreground text-background'
						: 'border-border text-muted-foreground hover:bg-muted/80'
				)}
				onclick={() => pushFilters({ year: y })}
			>
				{y}
			</button>
		{/each}
	</div>

	<div class="mt-2 flex flex-wrap gap-2">
		<button
			type="button"
			class={cn(
				'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
				data.filters.context == null
					? 'border-foreground bg-foreground text-background'
					: 'border-border text-muted-foreground hover:bg-muted/80'
			)}
			onclick={() => pushFilters({ context: null })}
		>
			All contexts
		</button>
		{#each CONTEXT_TYPES as ct (ct)}
			<button
				type="button"
				class={cn(
					'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
					data.filters.context === ct
						? CONTEXT_TYPE_FILTER_ACTIVE_CLASSES[ct]
						: cn(CONTEXT_TYPE_BADGE_CLASSES[ct], 'hover:opacity-90')
				)}
				onclick={() => pushFilters({ context: ct })}
			>
				{CONTEXT_TYPE_SHORT[ct]} · {CONTEXT_TYPE_LABELS[ct]}
			</button>
		{/each}
	</div>

	{#if venues.length}
		<div class="mt-2 flex flex-wrap gap-2">
			<button
				type="button"
				class={cn(
					'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
					data.filters.venueId == null
						? 'border-foreground bg-foreground text-background'
						: 'border-border text-muted-foreground hover:bg-muted/80'
				)}
				onclick={() => pushFilters({ venueId: null })}
			>
				All venues
			</button>
			{#each venues as v (v.id)}
				<button
					type="button"
					class={cn(
						'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
						data.filters.venueId === v.id
							? 'border-foreground bg-foreground text-background'
							: 'border-border text-muted-foreground hover:bg-muted/80'
					)}
					onclick={() => pushFilters({ venueId: v.id })}
				>
					{v.name}
				</button>
			{/each}
		</div>
	{/if}

	<p class="mt-4 text-sm text-muted-foreground">
		{data.sermons.length} sermon{data.sermons.length === 1 ? '' : 's'}
		{#if data.isOwner}
			·
			<a href="/settings/sermons/venues" class="underline-offset-2 hover:underline">Manage venues</a>
		{/if}
	</p>

	<ul class="mt-4 space-y-2">
		{#each data.sermons as s (s.id)}
			<li class="rounded-lg border border-border bg-card p-3 text-card-foreground">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
							<time datetime={s.preached_on}>{formatDate(s.preached_on)}</time>
							{#if s.context_type}
								<span
									class={cn(
										'rounded border px-1.5 py-0.5 font-medium',
										CONTEXT_TYPE_BADGE_CLASSES[s.context_type]
									)}
									title={CONTEXT_TYPE_LABELS[s.context_type]}
								>
									{CONTEXT_TYPE_SHORT[s.context_type]}
								</span>
							{/if}
							{#if s.venue_name}
								<span class="truncate">{s.venue_name}</span>
							{/if}
						</div>
						<p class="mt-1 text-sm font-medium tracking-tight">
							{s.passage_display?.trim() || 'Passage TBD'}
						</p>
						{#if s.topic?.trim()}
							<p class="mt-0.5 text-sm text-muted-foreground">{s.topic.trim()}</p>
						{/if}
						{#if s.notes}
							<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.notes}</p>
						{/if}
					</div>
					<div class="flex shrink-0 items-center gap-1">
						{#if s.library_search_href}
							<Button
								variant="ghost"
								size="icon-sm"
								href={s.library_search_href}
								aria-label="Find in library"
								title="Find in library"
							>
								<BookOpen class="size-4" />
							</Button>
						{/if}
						{#if data.isOwner}
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Edit sermon"
								onclick={() => openEdit(s)}
							>
								<Pencil class="size-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								class="text-destructive"
								aria-label="Delete sermon"
								onclick={() => askDelete(s)}
							>
								<Trash2 class="size-4" />
							</Button>
						{/if}
					</div>
				</div>
			</li>
		{:else}
			<li class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
				No sermons match these filters.
				{#if data.isOwner}
					<button type="button" class="ml-1 underline-offset-2 hover:underline" onclick={openCreate}>
						Add one
					</button>
				{/if}
			</li>
		{/each}
	</ul>
</div>

{#if data.isOwner}
	<SermonFormSheet
		bind:open={sheetOpen}
		bind:venues
		mode={sheetMode}
		sermon={editing}
		errorMessage={sheetError}
		{onSaved}
	/>

	<form
		bind:this={deleteFormEl}
		method="POST"
		action="?/softDeleteSermon"
		class="hidden"
		use:enhance={deleteEnhance}
	>
		<input type="hidden" name="sermon_id" value="" />
	</form>

	<ConfirmDialog
		bind:open={deleteOpen}
		title="Delete sermon?"
		description={deleteTarget
			? `Remove “${deleteTarget.passage_display?.trim() || deleteTarget.topic?.trim() || formatDate(deleteTarget.preached_on)}” from the list? You can restore from the audit log.`
			: ''}
		confirmLabel={deletePending ? 'Deleting…' : 'Delete'}
		onConfirm={submitDelete}
	/>
{/if}

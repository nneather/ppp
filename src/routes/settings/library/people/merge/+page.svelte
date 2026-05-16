<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { invalidateAll, invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { onMount } from 'svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import type { PageProps } from './$types';
	import type { MergeSuggestionPair } from './+page.server';

	let { data, form }: PageProps = $props();

	const LS_DISMISS = 'ppp.library.mergeDismissedPairs';

	type FormShape = { kind?: string; message?: string; success?: boolean };
	const f = $derived((form ?? null) as FormShape | null);
	const mergeErr = $derived(
		f?.kind === 'mergePeople' && f.success !== true ? (f.message ?? null) : null
	);

	function displayNameFor(id: string): string {
		return data.allPeople.find((p) => p.id === id)?.display_name ?? `#${id.slice(0, 8)}`;
	}

	let dismissed = $state<Set<string>>(new Set());

	onMount(() => {
		if (!browser) return;
		try {
			const raw = localStorage.getItem(LS_DISMISS);
			if (!raw) return;
			const arr = JSON.parse(raw) as unknown;
			if (!Array.isArray(arr)) return;
			dismissed = new Set(arr.filter((x): x is string => typeof x === 'string'));
		} catch {
			/* ignore */
		}
	});

	function persistDismissed() {
		if (!browser) return;
		localStorage.setItem(LS_DISMISS, JSON.stringify([...dismissed]));
	}

	function dismissPair(pairKey: string) {
		dismissed = new Set([...dismissed, pairKey]);
		persistDismissed();
	}

	const visibleSuggestions = $derived(
		(data.suggestionPairs ?? []).filter((p: MergeSuggestionPair) => !dismissed.has(p.pairKey))
	);

	let mergeFormEl = $state<HTMLFormElement | null>(null);
	let mergePending = $state(false);

	const mergeEnhance: SubmitFunction = () => {
		mergePending = true;
		const canonAtStart = pendingCanonical;
		const mergedAtStart = pendingMergedAway;
		return async ({ result, update }) => {
			mergePending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				confirmOpen = false;
				if (canonAtStart && mergedAtStart) {
					const pk =
						canonAtStart < mergedAtStart
							? `${canonAtStart}|${mergedAtStart}`
							: `${mergedAtStart}|${canonAtStart}`;
					dismissed = new Set([...dismissed, pk]);
					persistDismissed();
				}
				pendingCanonical = null;
				pendingMergedAway = null;
				manualCanonicalId = '';
				manualMergedAwayId = '';
				await invalidateAll();
				await invalidate('app:library:people').catch(() => {});
				await invalidate('app:library:facets').catch(() => {});
			}
		};
	};

	let confirmOpen = $state(false);
	let pendingCanonical = $state<string | null>(null);
	let pendingMergedAway = $state<string | null>(null);

	function askMerge(canonicalId: string, mergedAwayId: string) {
		pendingCanonical = canonicalId;
		pendingMergedAway = mergedAwayId;
		confirmOpen = true;
	}

	function submitMergeFromConfirm() {
		if (!pendingCanonical || !pendingMergedAway || !mergeFormEl) return;
		const c = mergeFormEl.querySelector(
			'input[name="p_canonical"]'
		) as HTMLInputElement | null;
		const m = mergeFormEl.querySelector(
			'input[name="p_merged_away"]'
		) as HTMLInputElement | null;
		if (!c || !m) return;
		c.value = pendingCanonical;
		m.value = pendingMergedAway;
		mergeFormEl.requestSubmit();
	}

	let manualCanonicalId = $state('');
	let manualMergedAwayId = $state('');

	const manualReady = $derived(
		Boolean(manualCanonicalId && manualMergedAwayId && manualCanonicalId !== manualMergedAwayId)
	);

	function submitManualMerge() {
		if (!manualReady) return;
		askMerge(manualCanonicalId, manualMergedAwayId);
	}
</script>

<svelte:head>
	<title>Merge people — Library settings — ppp</title>
</svelte:head>

{#if data.loadError}
	<p class="text-sm text-destructive" role="alert">{data.loadError}</p>
{:else}
	<p class="text-sm text-muted-foreground">
		Suggested pairs use the same name match as author dedup (last name + first initial + middle rule). Dismiss
		hides a pair on this browser only. Merging is permanent and not audit-revertible for the removed person.
	</p>

	{#if data.bookCountError}
		<p
			class="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
			role="status"
		>
			<AlertCircle class="mt-0.5 size-4 shrink-0" />
			<span>Book counts could not be loaded ({data.bookCountError}). Counts may show as zero.</span>
		</p>
	{/if}

	{#if data.listTruncated}
		<p class="mt-3 text-xs text-amber-700 dark:text-amber-200" role="status">
			Only the first 500 people were scanned for suggestions — refine data or use the People list search if
			needed.
		</p>
	{/if}

	<section class="mt-8 space-y-3">
		<h2 class="text-lg font-semibold text-foreground">Suggested merges</h2>
		{#if visibleSuggestions.length === 0}
			<p class="text-sm text-muted-foreground">No open suggestions. Try the manual merge below.</p>
		{:else}
			<ul class="space-y-3">
				{#each visibleSuggestions as pair (pair.pairKey)}
					<li class="rounded-xl border border-border p-4">
						<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div class="min-w-0 text-sm">
								<p class="font-medium text-foreground">
									<span>{pair.left.display_name}</span>
									<span class="text-muted-foreground"> · </span>
									<span>{pair.right.display_name}</span>
								</p>
								<p class="mt-1 text-xs text-muted-foreground">
									{pair.left.book_count} book(s) · {pair.right.book_count} book(s)
								</p>
							</div>
							<div class="flex flex-wrap gap-2">
								<Button type="button" variant="outline" size="sm" onclick={() => dismissPair(pair.pairKey)}>
									Dismiss
								</Button>
								<Button
									type="button"
									variant="secondary"
									size="sm"
									onclick={() => askMerge(pair.left.id, pair.right.id)}
								>
									Keep left, merge right
								</Button>
								<Button
									type="button"
									variant="secondary"
									size="sm"
									onclick={() => askMerge(pair.right.id, pair.left.id)}
								>
									Keep right, merge left
								</Button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="mt-10 space-y-4">
		<h2 class="text-lg font-semibold text-foreground">Manual merge</h2>
		<p class="text-sm text-muted-foreground">
			Choose who to keep and who to remove. All book and essay author links move to the person you keep.
		</p>
		<div class="grid max-w-xl gap-4">
			<div class="space-y-2">
				<Label for="manual-keep">Keep (canonical)</Label>
				<select
					id="manual-keep"
					bind:value={manualCanonicalId}
					class="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
				>
					<option value="">— Select —</option>
					{#each data.allPeople as p (p.id)}
						<option value={p.id}>{p.display_name}</option>
					{/each}
				</select>
			</div>
			<div class="space-y-2">
				<Label for="manual-remove">Remove (merged into canonical)</Label>
				<select
					id="manual-remove"
					bind:value={manualMergedAwayId}
					class="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
				>
					<option value="">— Select —</option>
					{#each data.allPeople as p (p.id)}
						<option value={p.id}>{p.display_name}</option>
					{/each}
				</select>
			</div>
			<Button
				type="button"
				variant="destructive"
				hotkey="d"
				label="Review merge…"
				disabled={!manualReady}
				onclick={submitManualMerge}
			/>
		</div>
	</section>
{/if}

<form
	bind:this={mergeFormEl}
	method="POST"
	action="?/mergePeople"
	class="hidden"
	use:enhance={mergeEnhance}
>
	<input type="hidden" name="p_canonical" value="" />
	<input type="hidden" name="p_merged_away" value="" />
</form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Merge permanently?"
	description={pendingCanonical && pendingMergedAway
		? `Keep “${displayNameFor(pendingCanonical)}” and remove “${displayNameFor(pendingMergedAway)}”. This cannot be undone from the audit log.`
		: ''}
	destructive
	confirmLabel={mergePending ? 'Merging…' : 'Merge'}
	pending={mergePending}
	onConfirm={submitMergeFromConfirm}
/>

{#if mergeErr}
	<p class="mt-4 text-sm text-destructive" role="alert">{mergeErr}</p>
{/if}

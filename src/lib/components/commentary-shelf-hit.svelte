<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import BookRatingScale from '$lib/components/book-rating-scale.svelte';
	import { Button } from '$lib/components/ui/button';
	import { formatHitRate } from '$lib/studies/hit-rate';
	import type { ByBookShelfHit } from '$lib/types/sermons';
	import Star from '@lucide/svelte/icons/star';

	let {
		hit,
		isOwner,
		attached = false,
		parentField = null,
		parentId = null,
		locallyDismissed = false,
		onAttached,
		onDismissLocal,
		onRestoreLocal
	}: {
		hit: ByBookShelfHit;
		isOwner: boolean;
		/** Sermon shelf only. By book omits the parent and shows Dismiss by default. */
		attached?: boolean;
		parentField?: 'paper_id' | 'sermon_id' | null;
		parentId?: string | null;
		locallyDismissed?: boolean;
		onAttached?: () => void | Promise<void>;
		onDismissLocal?: () => void;
		onRestoreLocal?: () => void;
	} = $props();

	let ratingPending = $state(false);
	let shelfPending = $state(false);
	let attachPending = $state(false);
	let ratingForm = $state<HTMLFormElement | null>(null);
	let ratingInput = $state<HTMLInputElement | null>(null);
	let shownRating = $state<number | null>(null);

	$effect(() => {
		shownRating = hit.rating;
	});

	const canAttach = $derived(Boolean(parentField && parentId));
	const rowKey = $derived(hit.essayId ?? hit.bookId);
	/**
	 * Phone width cannot hold title, series, stars, and two buttons on one line.
	 * The series abbreviation is what you scan; the title stays the desktop lead.
	 */
	const mobilePrimary = $derived(hit.seriesLabel ?? hit.title);
	const mobileSecondary = $derived.by(() => {
		if (!hit.seriesLabel) return hit.authorShort;
		const parts = [hit.authorShort, hit.title !== hit.seriesLabel ? hit.title : null].filter(
			(part): part is string => Boolean(part)
		);
		return parts.length > 0 ? parts.join(' · ') : null;
	});

	function ratingLabel(rating: number | null): string {
		if (rating == null) return '—';
		return `${rating}★`;
	}

	function onRate(next: number | null) {
		shownRating = next;
		if (!ratingInput || !ratingForm) return;
		ratingInput.value = next == null ? '' : String(next);
		ratingForm.requestSubmit();
	}

	const ratingEnhance: SubmitFunction = () => {
		ratingPending = true;
		// Sermon shelf stays put. Stars already show the new rating.
		// The rated-high order is applied the next time the shelf loads.
		const stayPut = canAttach;
		return async ({ result, update }) => {
			ratingPending = false;
			await update({ invalidateAll: !stayPut, reset: false });
			if (result.type !== 'success') shownRating = hit.rating;
		};
	};

	const shelfEnhance: SubmitFunction = () => {
		shelfPending = true;
		return async ({ update }) => {
			shelfPending = false;
			await update({ invalidateAll: true, reset: false });
		};
	};

	const attachEnhance: SubmitFunction = () => {
		attachPending = true;
		return async ({ result, update }) => {
			attachPending = false;
			await update({ invalidateAll: false, reset: false });
			if (result.type === 'success') await onAttached?.();
		};
	};
</script>

<div class="flex flex-col gap-1.5 py-1 md:flex-row md:items-start md:gap-2 md:py-0">
	<a
		href={hit.href}
		class="flex min-w-0 flex-1 items-start gap-3 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted/60 md:py-1.5"
	>
		<span class="min-w-0 flex-1">
			<span class="block truncate font-medium tracking-tight md:hidden" title={mobilePrimary}>
				{mobilePrimary}
			</span>
			<span class="hidden truncate font-medium tracking-tight md:block">{hit.title}</span>
			{#if mobileSecondary}
				<span
					class="mt-0.5 block truncate text-xs text-muted-foreground md:hidden"
					title={mobileSecondary}
				>
					{mobileSecondary}
				</span>
			{/if}
			{#if hit.authorShort}
				<span class="mt-0.5 hidden truncate text-xs text-muted-foreground md:block">
					{hit.authorShort}
				</span>
			{/if}
		</span>
		<span
			class="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs text-muted-foreground tabular-nums"
			aria-label={[
				hit.seriesLabel ? `Series ${hit.seriesLabel}` : null,
				shownRating != null ? `Rated ${shownRating} stars` : 'Unrated',
				hit.hitRate ? `Hit rate ${formatHitRate(hit.hitRate)}` : null
			]
				.filter(Boolean)
				.join(', ')}
		>
			{#if hit.seriesLabel}
				<span class="hidden max-w-[7.5rem] truncate font-medium md:inline" title={hit.seriesLabel}>
					{hit.seriesLabel}
				</span>
			{/if}
			{#if !isOwner}
				<span class="inline-flex items-center gap-0.5">
					{#if hit.rating != null}
						<Star
							class="size-3 fill-amber-500 text-amber-600 dark:text-amber-400"
							aria-hidden="true"
						/>
					{/if}
					{ratingLabel(hit.rating)}
				</span>
			{/if}
			{#if hit.hitRate}
				<span
					class="font-medium text-foreground"
					title="Consulted or cited in expository studies on this book since the commentary was acquired"
				>
					{formatHitRate(hit.hitRate)}
				</span>
			{/if}
		</span>
	</a>
	{#if isOwner}
		<!-- `md:contents` puts stars and actions back on the desktop row. -->
		<div class="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 md:contents">
			<form
				bind:this={ratingForm}
				method="POST"
				action="?/setCommentaryRating"
				use:enhance={ratingEnhance}
				class="shrink-0 md:pt-1"
			>
				{#each hit.memberBookIds as bookId (bookId)}
					<input type="hidden" name="book_id" value={bookId} />
				{/each}
				<input bind:this={ratingInput} type="hidden" name="rating" value={shownRating ?? ''} />
				<BookRatingScale
					variant="compact"
					name={null}
					id={`commentary-rating-${rowKey}`}
					value={shownRating}
					disabled={ratingPending}
					onchange={onRate}
				/>
			</form>
			<div
				class="grid min-w-0 flex-1 grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-1 md:flex md:w-36 md:flex-none md:flex-col md:pt-1"
			>
				{#if canAttach}
					{#if attached}
						<span
							class="inline-flex h-7 w-full items-center justify-center rounded-md border border-border px-2 text-xs text-muted-foreground"
						>
							Attached
						</span>
					{:else}
						<form
							method="POST"
							action="?/addPaperSource"
							use:enhance={attachEnhance}
							class="min-w-0 md:w-full"
						>
							<input type="hidden" name={parentField} value={parentId} />
							{#if hit.kind === 'essay' && hit.essayId}
								<input type="hidden" name="essay_id" value={hit.essayId} />
							{:else}
								<input type="hidden" name="book_id" value={hit.bookId} />
							{/if}
							<Button
								type="submit"
								variant="outline"
								size="sm"
								class="w-full"
								label="Attach"
								disabled={attachPending}
							/>
						</form>
					{/if}
				{/if}
				{#if onDismissLocal && !hit.shelfDismissed}
					{#if locallyDismissed}
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="w-full"
							label="Restore"
							onclick={onRestoreLocal}
						/>
					{:else}
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="w-full"
							label="Dismiss"
							onclick={onDismissLocal}
						/>
					{/if}
				{:else if !canAttach}
					<form
						method="POST"
						action="?/setCommentaryShelf"
						use:enhance={shelfEnhance}
						class="min-w-0 md:w-full"
					>
						{#if hit.kind === 'essay'}
							{#each hit.memberEssayIds as essayId (essayId)}
								<input type="hidden" name="essay_id" value={essayId} />
							{/each}
						{:else}
							{#each hit.memberBookIds as bookId (bookId)}
								<input type="hidden" name="book_id" value={bookId} />
							{/each}
						{/if}
						<input
							type="hidden"
							name="shelf_dismissed"
							value={hit.shelfDismissed ? 'false' : 'true'}
						/>
						<Button
							type="submit"
							variant="outline"
							size="sm"
							class="h-auto w-full px-2 py-1 text-center leading-tight whitespace-normal"
							label={hit.shelfDismissed ? 'Use by default' : 'Dismiss by default'}
							disabled={shelfPending}
						/>
					</form>
				{/if}
			</div>
		</div>
	{/if}
</div>

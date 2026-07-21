<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		dismissKey,
		loadDismissedKeys,
		restoreKey,
		saveDismissedKeys
	} from '$lib/library/not-owned-dismiss';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import type { PageProps } from './$types';
	import type { NotOwnedSettingsRow } from './+page.server';

	let { data, form }: PageProps = $props();

	type FormShape = {
		kind?: string;
		message?: string;
		success?: boolean;
		queueKey?: string;
		bookId?: string;
		alreadyExisted?: boolean;
	};
	const f = $derived((form ?? null) as FormShape | null);

	let pendingKey = $state<string | null>(null);
	let dismissed = $state<Set<string>>(new Set());
	let createdOpen = $state(false);
	let dismissedOpen = $state(false);

	onMount(() => {
		if (!browser) return;
		dismissed = loadDismissedKeys();
	});

	function persistDismissed(next: Set<string>) {
		dismissed = next;
		if (browser) saveDismissedKeys(next);
	}

	function onDismiss(key: string) {
		persistDismissed(dismissKey(dismissed, key));
	}

	function onRestore(key: string) {
		persistDismissed(restoreKey(dismissed, key));
	}

	const pendingRows = $derived(
		data.rows.filter((r) => !r.existingBookId && !dismissed.has(r.key))
	);
	const createdRows = $derived(data.rows.filter((r) => r.existingBookId != null));
	const dismissedRows = $derived(
		data.rows.filter((r) => !r.existingBookId && dismissed.has(r.key))
	);

	const createEnhance: SubmitFunction = ({ formData }) => {
		pendingKey = String(formData.get('queue_key') ?? '');
		return async ({ result, update }) => {
			pendingKey = null;
			await update({ reset: false });
			if (result.type === 'success') {
				await invalidate('app:library:not-owned').catch(() => {});
			}
		};
	};
</script>

{#snippet rowMeta(row: NotOwnedSettingsRow)}
	<div class="min-w-0">
		<div class="font-medium leading-snug">{row.title}</div>
		<div class="mt-0.5 text-sm text-muted-foreground">
			{#if row.author}{row.author}{/if}
			{#if row.rating != null}
				{#if row.author} · {/if}★ {row.rating}
			{/if}
			{#if row.notes}
				<span class="block text-xs">{row.notes}</span>
			{/if}
		</div>
	</div>
{/snippet}

<div class="space-y-4">
	<div>
		<h2 class="text-lg font-semibold tracking-tight">Not owned (research stubs)</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			Pending inbox from the curated Goodreads queue. Create a stub or choose Don’t create —
			handled rows leave this list. Stubs stay hidden from the library until you mark them owned.
			Never invents ISBN.
		</p>
	</div>

	{#if data.loadError}
		<p class="flex items-start gap-2 text-sm text-destructive" role="alert">
			<AlertCircle class="mt-0.5 size-4 shrink-0" />
			{data.loadError}
		</p>
	{/if}

	{#if f?.kind === 'createNotOwnedStub' && f.message && !f.success}
		<p class="flex items-start gap-2 text-sm text-destructive" role="alert">
			<AlertCircle class="mt-0.5 size-4 shrink-0" />
			{f.message}
		</p>
	{/if}

	{#if f?.kind === 'createNotOwnedStub' && f.success && f.bookId}
		<p class="text-sm text-muted-foreground" role="status">
			{f.alreadyExisted ? 'Already created' : 'Stub created'} —
			<a class="text-primary underline-offset-2 hover:underline" href={`/library/books/${f.bookId}`}
				>open book</a
			>
		</p>
	{/if}

	<section class="space-y-2">
		<h3 class="text-sm font-semibold text-foreground">
			Pending
			<span class="font-normal text-muted-foreground">({pendingRows.length})</span>
		</h3>
		{#if pendingRows.length === 0}
			<p class="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
				Inbox clear — nothing left to create.
			</p>
		{:else}
			<ul class="divide-y divide-border rounded-lg border border-border">
				{#each pendingRows as row (row.key)}
					<li
						class="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
					>
						{@render rowMeta(row)}
						<div class="flex shrink-0 flex-wrap gap-2">
							<form method="POST" action="?/createStub" use:enhance={createEnhance}>
								<input type="hidden" name="queue_key" value={row.key} />
								<Button
									type="submit"
									variant="outline"
									size="sm"
									class="h-9"
									disabled={pendingKey === row.key}
								>
									{pendingKey === row.key ? 'Creating…' : 'Create stub'}
								</Button>
							</form>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								class="h-9 text-muted-foreground"
								onclick={() => onDismiss(row.key)}
							>
								Don’t create
							</Button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if createdRows.length > 0}
		<section class="rounded-lg border border-border">
			<button
				type="button"
				class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium"
				onclick={() => (createdOpen = !createdOpen)}
				aria-expanded={createdOpen}
			>
				<span>
					Created
					<span class="font-normal text-muted-foreground">({createdRows.length})</span>
				</span>
				<ChevronDown
					class={`size-4 shrink-0 text-muted-foreground transition-transform ${createdOpen ? 'rotate-180' : ''}`}
				/>
			</button>
			{#if createdOpen}
				<ul class="divide-y divide-border border-t border-border">
					{#each createdRows as row (row.key)}
						<li
							class="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
						>
							{@render rowMeta(row)}
							{#if row.existingBookId}
								<Button
									href={`/library/books/${row.existingBookId}`}
									variant="outline"
									size="sm"
									class="h-9 shrink-0"
								>
									Open stub
								</Button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	{#if dismissedRows.length > 0}
		<section class="rounded-lg border border-border">
			<button
				type="button"
				class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium"
				onclick={() => (dismissedOpen = !dismissedOpen)}
				aria-expanded={dismissedOpen}
			>
				<span>
					Dismissed
					<span class="font-normal text-muted-foreground">({dismissedRows.length})</span>
				</span>
				<ChevronDown
					class={`size-4 shrink-0 text-muted-foreground transition-transform ${dismissedOpen ? 'rotate-180' : ''}`}
				/>
			</button>
			{#if dismissedOpen}
				<ul class="divide-y divide-border border-t border-border">
					{#each dismissedRows as row (row.key)}
						<li
							class="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
						>
							{@render rowMeta(row)}
							<Button
								type="button"
								variant="outline"
								size="sm"
								class="h-9 shrink-0"
								onclick={() => onRestore(row.key)}
							>
								Restore
							</Button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>

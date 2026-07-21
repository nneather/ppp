<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import type { PageProps } from './$types';

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

<div class="space-y-4">
	<div>
		<h2 class="text-lg font-semibold tracking-tight">Not owned (research stubs)</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			Create minimal stubs from the curated Goodreads queue. Stubs stay hidden from the library
			list until you mark them owned. Never invents ISBN.
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

	<ul class="divide-y divide-border rounded-lg border border-border">
		{#each data.rows as row (row.key)}
			<li class="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
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
				<div class="shrink-0">
					{#if row.existingBookId}
						<Button
							href={`/library/books/${row.existingBookId}`}
							variant="outline"
							size="sm"
							class="h-9"
						>
							Open stub
						</Button>
					{:else}
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
					{/if}
				</div>
			</li>
		{/each}
	</ul>
</div>

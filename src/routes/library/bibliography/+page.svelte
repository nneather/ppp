<script lang="ts">
	import { browser } from '$app/environment';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Copy from '@lucide/svelte/icons/copy';
	import { Button } from '$lib/components/ui/button';
	import { copyCitationToClipboard } from '$lib/library/turabian/clipboard';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let toast = $state<string | null>(null);
	let copying = $state(false);

	function flash(message: string) {
		toast = message;
		setTimeout(() => {
			toast = null;
		}, 2500);
	}

	async function copyBibliography() {
		if (!browser) return;
		copying = true;
		try {
			await copyCitationToClipboard(data.compiled);
			flash(`Copied bibliography (${data.books.length} books).`);
		} catch {
			flash('Clipboard unavailable.');
		} finally {
			copying = false;
		}
	}
</script>

<svelte:head>
	<title>Bibliography — Library — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6">
	<a
		href="/library"
		class="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> Library
	</a>

	<header class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Bibliography</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{data.books.length} {data.books.length === 1 ? 'book' : 'books'}, sorted by first author last
				name.
			</p>
		</div>
		<Button type="button" disabled={copying || data.books.length === 0} onclick={() => void copyBibliography()}>
			<Copy class="size-4" />
			{copying ? 'Copying…' : 'Copy bibliography'}
		</Button>
	</header>

	{#if data.books.length === 0}
		<p class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
			No books selected. Choose books on the <a href="/library" class="text-primary underline">library list</a>
			and tap <span class="font-medium">Build bibliography</span>.
		</p>
	{:else}
		<pre
			class="whitespace-pre-wrap break-words rounded-xl border border-border bg-card p-4 font-mono text-sm leading-relaxed"
			>{data.compiled.plain}</pre
		>
	{/if}

	{#if toast}
		<p
			class="bottom-tabbar fixed left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-lg"
			role="status"
		>
			{toast}
		</p>
	{/if}
</div>

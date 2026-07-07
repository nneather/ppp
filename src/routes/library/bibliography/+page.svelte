<script lang="ts">
	import { browser } from '$app/environment';
	import Copy from '@lucide/svelte/icons/copy';
	import Download from '@lucide/svelte/icons/download';
	import { Button } from '$lib/components/ui/button';
	import PageHeader from '$lib/components/page-header.svelte';
	import { copyCitationToClipboard } from '$lib/library/turabian/clipboard';
	import { parseCitationHtmlSegments } from '$lib/library/turabian/html-segments';
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

{#snippet bibliographyMeta()}
	<p class="text-sm text-muted-foreground">
		{data.books.length} {data.books.length === 1 ? 'book' : 'books'}, sorted by first author last name.
	</p>
{/snippet}

{#snippet bibliographyActions()}
	<Button
		type="button"
		class="max-md:min-h-11"
		disabled={copying || data.books.length === 0}
		onclick={() => void copyBibliography()}
	>
		<Copy class="size-4" />
		{copying ? 'Copying…' : 'Copy bibliography'}
	</Button>
	<Button
		variant="secondary"
		class="max-md:min-h-11"
		href={`/library/bibliography/download?ids=${data.ids.join(',')}`}
		disabled={data.books.length === 0}
		data-sveltekit-reload
	>
		<Download class="size-4" />
		Download .docx
	</Button>
{/snippet}

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6">
	<PageHeader
		back={{ href: '/library', label: 'Library' }}
		title="Bibliography"
		meta={bibliographyMeta}
		actions={bibliographyActions}
		class="mb-6"
	/>

	{#if data.books.length === 0}
		<p class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
			No books selected. Choose books on the <a href="/library" class="text-primary underline">library list</a>
			and tap <span class="font-medium">Build bibliography</span>.
		</p>
	{:else}
		<div
			class="flex flex-col gap-4 whitespace-pre-wrap break-words rounded-xl border border-border bg-card p-4 font-mono text-sm leading-relaxed"
		>
			{#each data.entries as entry, i (i)}
				<p>
					{#each parseCitationHtmlSegments(entry.html || entry.plain) as seg, j (`${i}-${j}`)}
						{#if seg.italic}<em class="italic">{seg.text}</em>{:else}{seg.text}{/if}
					{/each}
				</p>
			{/each}
		</div>
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

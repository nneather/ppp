<script lang="ts">
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import { copyCitationToClipboard } from '$lib/library/turabian/clipboard';
	import { parseCitationHtmlSegments } from '$lib/library/turabian/html-segments';
	import type { CitationFormatted } from '$lib/library/turabian';
	import Copy from '@lucide/svelte/icons/copy';

	type Props = {
		label: string;
		citation: CitationFormatted;
		onCopied?: (message: string) => void;
	};

	let { label, citation, onCopied }: Props = $props();

	let copying = $state(false);

	const segments = $derived(parseCitationHtmlSegments(citation.html || citation.plain));

	async function copy() {
		if (!browser) return;
		copying = true;
		try {
			await copyCitationToClipboard(citation);
			onCopied?.(`Copied ${label}.`);
		} catch {
			onCopied?.('Clipboard unavailable.');
		} finally {
			copying = false;
		}
	}
</script>

<div class="rounded-lg border border-border bg-muted/30 p-3">
	<div class="mb-2 flex items-center justify-between gap-2">
		<span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="h-8 gap-1 text-xs"
			disabled={copying || !citation.plain}
			onclick={() => void copy()}
		>
			<Copy class="size-3.5" />
			{copying ? 'Copying…' : 'Copy'}
		</Button>
	</div>
	<p
		class="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground"
	>
		{#if segments.length === 0}
			—
		{:else}
			{#each segments as seg, i (i)}
				{#if seg.italic}<em class="italic">{seg.text}</em>{:else}{seg.text}{/if}
			{/each}
		{/if}
	</p>
</div>

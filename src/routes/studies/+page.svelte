<script lang="ts">
	import PageHeader from '$lib/components/page-header.svelte';
	import { PAPER_STATUS_LABELS } from '$lib/types/classwork';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Studies — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 pb-tabbar">
	<PageHeader
		title="Studies"
		subtitle="Papers and sermons, with the resource sets that feed them."
	/>

	{#if data.loadError}
		<p class="mt-4 text-sm text-destructive" role="alert">{data.loadError}</p>
	{/if}

	<section class="mt-6">
		<h2 class="text-sm font-medium">Active papers</h2>
		{#if data.papers.length === 0}
			<p class="mt-2 text-sm text-muted-foreground">
				No papers in progress. <a class="underline-offset-2 hover:underline" href="/studies/papers">Open papers</a>.
			</p>
		{:else}
			<ul class="mt-2 divide-y divide-border rounded-lg border border-border">
				{#each data.papers as paper (paper.id)}
					<li>
						<a class="flex items-baseline justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/50" href={`/studies/papers/${paper.id}`}>
							<span class="min-w-0 truncate font-medium">{paper.title}</span>
							<span class="shrink-0 text-xs text-muted-foreground">{PAPER_STATUS_LABELS[paper.status]}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="mt-8">
		<h2 class="text-sm font-medium">Upcoming sermons</h2>
		{#if data.sermons.length === 0}
			<p class="mt-2 text-sm text-muted-foreground">
				Nothing dated from today forward.
				<a class="underline-offset-2 hover:underline" href="/studies/sermons">Open sermons</a>.
			</p>
		{:else}
			<ul class="mt-2 divide-y divide-border rounded-lg border border-border">
				{#each data.sermons as sermon (sermon.id)}
					<li class="px-3 py-2.5 text-sm">
						<p class="font-medium">{sermon.passage_display || sermon.topic || 'Untitled'}</p>
						<p class="text-xs text-muted-foreground">
							{sermon.preached_on}{sermon.venue_name ? ` · ${sermon.venue_name}` : ''}
						</p>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

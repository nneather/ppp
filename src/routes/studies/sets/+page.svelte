<script lang="ts">
	import PageHeader from '$lib/components/page-header.svelte';
	import type { ResourceSetListItem } from '$lib/studies/resource-sets';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const sections = $derived([
		{ title: 'Bible books', items: data.groups.bibleBooks },
		{ title: 'Language tools', items: data.groups.language },
		{ title: 'Custom', items: data.groups.custom }
	]);
</script>

{#snippet row(item: ResourceSetListItem)}
	<li>
		<a
			class="flex items-baseline justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/50"
			href={`/studies/sets/${item.id}`}
		>
			<span class="min-w-0 truncate font-medium">{item.name}</span>
			<span class="shrink-0 text-xs text-muted-foreground">
				{item.memberCount}
				{#if item.newCount > 0}
					<span class="ml-1 text-primary">{item.newCount} new</span>
				{/if}
			</span>
		</a>
	</li>
{/snippet}

<svelte:head>
	<title>Resource sets — Studies — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 pb-tabbar">
	<PageHeader title="Sets" subtitle="Rules keep these lists topped up. Excludes stick." />

	{#if data.loadError}
		<p class="mt-4 text-sm text-destructive" role="alert">{data.loadError}</p>
	{/if}

	{#each sections as section (section.title)}
		<section class="mt-6">
			<h2 class="text-sm font-medium">{section.title}</h2>
			{#if section.items.length === 0}
				<p class="mt-2 text-sm text-muted-foreground">None yet.</p>
			{:else}
				<ul class="mt-2 divide-y divide-border rounded-lg border border-border">
					{#each section.items as item (item.id)}
						{@render row(item)}
					{/each}
				</ul>
			{/if}
		</section>
	{/each}
</div>

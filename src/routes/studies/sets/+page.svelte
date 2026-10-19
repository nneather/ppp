<script lang="ts">
	import PageHeader from '$lib/components/page-header.svelte';
	import ResourceSetBrowser from '$lib/components/resource-set-browser.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Resource sets — Studies — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 pb-tabbar">
	<PageHeader
		title="Sets"
		subtitle="Each Bible book already carries its commentaries. Other sections can take a new set."
	/>

	{#if data.loadError}
		<p class="mt-4 text-sm text-destructive" role="alert">{data.loadError}</p>
	{/if}

	<ResourceSetBrowser sections={data.sections} isOwner={data.isOwner} {form} />
</div>

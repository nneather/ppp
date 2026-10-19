<script lang="ts">
	import PageHeader from '$lib/components/page-header.svelte';
	import ResourceSetReview from '$lib/components/resource-set-review.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.set.name} — Sets — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 pb-tabbar">
	<PageHeader title={data.set.name} back={{ href: '/studies/sets', label: 'Sets' }} />

	{#if data.loadError}
		<p class="mt-4 text-sm text-destructive" role="alert">{data.loadError}</p>
	{/if}

	{#if data.set.defaultFor.length > 0}
		<p class="mt-3 text-xs text-muted-foreground">
			Default for {data.set.defaultFor.join(', ')}.
		</p>
	{/if}

	<ResourceSetReview
		setId={data.set.id}
		rules={data.set.rules}
		included={data.set.included}
		excluded={data.set.excluded}
		isOwner={data.isOwner}
	/>
</div>

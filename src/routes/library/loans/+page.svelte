<script lang="ts">
	import BookLoanCard from '$lib/components/book-loan-card.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Books out — Library — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
	<PageHeader back={{ href: '/library', label: 'Library' }} title="Books out" />
	<BookLoanCard loans={data.loans} isOwner={data.isOwner} {form} />
</div>

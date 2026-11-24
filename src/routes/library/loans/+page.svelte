<script lang="ts">
	import { page } from '$app/state';
	import BookLoanCard from '$lib/components/book-loan-card.svelte';
	import LoanCheckoutSheet from '$lib/components/loan-checkout-sheet.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Button } from '$lib/components/ui/button';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let checkoutOpen = $state(false);

	const checkoutError = $derived(
		form?.kind === 'checkoutBook' && form.success !== true ? (form.message ?? null) : null
	);

	$effect(() => {
		if (data.isOwner && page.url.searchParams.get('checkout') === '1') checkoutOpen = true;
	});
</script>

<svelte:head>
	<title>Books out — Library — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
	<PageHeader back={{ href: '/library', label: 'Library' }} title="Books out" />
	{#if data.isOwner}
		<div class="mt-4">
			<Button type="button" variant="outline" onclick={() => (checkoutOpen = true)}>Check out</Button>
		</div>
	{/if}
	<BookLoanCard loans={data.loans} isOwner={data.isOwner} {form} />
</div>

{#if data.isOwner}
	<LoanCheckoutSheet bind:open={checkoutOpen} errorMessage={checkoutError} />
{/if}

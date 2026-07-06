<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';

	const status = $derived(page.status);
	const title = $derived(
		status === 404
			? 'Page not found'
			: status === 403
				? 'Not allowed'
				: status === 401
					? 'Sign in required'
					: 'Something went wrong'
	);
	const message = $derived(
		page.error?.message ??
			(status === 404
				? 'The page you were looking for does not exist or has moved.'
				: 'An unexpected error occurred.')
	);
</script>

<svelte:head>
	<title>{status} — ppp</title>
</svelte:head>

<div
	class="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center"
>
	<p class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Error {status}</p>
	<h1 class="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
	<p class="mt-3 text-sm text-muted-foreground">{message}</p>
	<div class="mt-6 flex flex-wrap items-center justify-center gap-3">
		<Button href="/dashboard">Go to dashboard</Button>
	</div>
</div>

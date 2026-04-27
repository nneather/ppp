<script lang="ts">
	import { GENRES } from '$lib/types/library';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import BookOpen from '@lucide/svelte/icons/book-open';
</script>

<svelte:head>
	<title>Library genres — Settings — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
	<a
		href="/settings"
		class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> Settings
	</a>

	<header class="mt-4 flex items-center gap-2 text-muted-foreground">
		<BookOpen class="size-5" />
		<h1 class="text-2xl font-semibold tracking-tight text-foreground">Library genres</h1>
	</header>
	<p class="mt-1 text-sm text-muted-foreground">
		Closed list defined in <code class="rounded bg-muted px-1.5 py-0.5 text-xs">src/lib/types/library.ts</code>.
		Read-only — edits require a code change so forms stay in sync.
	</p>

	<ul class="mt-6 grid gap-2 sm:grid-cols-2">
		{#each GENRES as g (g)}
			<li
				class="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-card-foreground"
			>
				{g}
			</li>
		{/each}
	</ul>

	<p class="mt-6 text-xs text-muted-foreground">
		{GENRES.length} genres. Schema CHECK is open TEXT; the form is the only enforcement layer.
	</p>
</div>

<script lang="ts">
	import { GENRES } from '$lib/types/library';
</script>

<svelte:head>
	<title>Library genres — Settings — ppp</title>
</svelte:head>

<p class="text-sm text-muted-foreground">
	Defined in <code class="rounded bg-muted px-1.5 py-0.5 text-xs">src/lib/types/library.ts</code>
	— edits require a code change so forms stay in sync.
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
	{GENRES.length} genres. Postgres enforces the same list via
	<code class="rounded bg-muted px-1 py-0.5 text-xs">books_genre_check</code>
	(see migration <code class="rounded bg-muted px-1 py-0.5 text-xs">20260507190000</code>).
</p>

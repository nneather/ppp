<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Library categories — Settings — ppp</title>
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
		<h1 class="text-2xl font-semibold tracking-tight text-foreground">Library categories</h1>
	</header>
	<p class="mt-1 text-sm text-muted-foreground">
		Static seed defined in <code class="rounded bg-muted px-1.5 py-0.5 text-xs">supabase/seed/library_seed.sql</code>.
		Read-only — categories are physical shelving classifications and rarely change.
	</p>

	{#if data.categories.length === 0}
		<p class="mt-8 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
			No categories loaded. Run <code>supabase/seed/library_seed.sql</code> against prod.
		</p>
	{:else}
		<div class="mt-6 overflow-hidden rounded-xl border border-border">
			<table class="min-w-full divide-y divide-border text-sm">
				<thead
					class="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground"
				>
					<tr>
						<th class="px-4 py-2">Sort</th>
						<th class="px-4 py-2">Name</th>
						<th class="px-4 py-2">Slug</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each data.categories as c (c.id)}
						<tr>
							<td class="px-4 py-2 tabular-nums text-muted-foreground">{c.sort_order}</td>
							<td class="px-4 py-2 font-medium">{c.name}</td>
							<td class="px-4 py-2 font-mono text-xs text-muted-foreground">{c.slug}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Library categories — Settings — ppp</title>
</svelte:head>

<p class="text-sm text-muted-foreground">
	Static seed in <code class="rounded bg-muted px-1.5 py-0.5 text-xs">supabase/seed/library_seed.sql</code>.
	Categories are physical shelving classifications.
</p>

{#if data.categories.length === 0}
	<p
		class="mt-8 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
	>
		No categories loaded. Run <code>supabase/seed/library_seed.sql</code> against prod.
	</p>
{:else}
	<div class="mt-6 overflow-hidden rounded-xl border border-border">
		<table class="min-w-full divide-y divide-border text-sm">
			<thead class="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
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

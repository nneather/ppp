<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const total = $derived(data.ot.length + data.nt.length);
</script>

<svelte:head>
	<title>Bible books — Settings — ppp</title>
</svelte:head>

<p class="text-sm text-muted-foreground">
	66-book Protestant canon. Seed in <code class="rounded bg-muted px-1.5 py-0.5 text-xs"
		>supabase/seed/library_seed.sql</code>.
</p>

{#if total === 0}
	<p
		class="mt-8 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
	>
		No bible books loaded. Run <code>supabase/seed/library_seed.sql</code> against prod.
	</p>
{:else}
	<div class="mt-6 grid gap-6 md:grid-cols-2">
		<section>
			<h2 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Old Testament <span class="font-normal">({data.ot.length})</span>
			</h2>
			<ol class="mt-3 grid gap-1 text-sm">
				{#each data.ot as b (b.id)}
					<li class="flex items-baseline gap-2">
						<span class="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
							{b.sort_order}.
						</span>
						<span>{b.name}</span>
					</li>
				{/each}
			</ol>
		</section>

		<section>
			<h2 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				New Testament <span class="font-normal">({data.nt.length})</span>
			</h2>
			<ol class="mt-3 grid gap-1 text-sm">
				{#each data.nt as b (b.id)}
					<li class="flex items-baseline gap-2">
						<span class="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
							{b.sort_order}.
						</span>
						<span>{b.name}</span>
					</li>
				{/each}
			</ol>
		</section>
	</div>
{/if}

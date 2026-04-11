<script lang="ts">
	import Receipt from '@lucide/svelte/icons/receipt';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import FolderKanban from '@lucide/svelte/icons/folder-kanban';
	import { cn } from '$lib/utils';

	type Tile = {
		href: string;
		title: string;
		statLabel: string;
		icon: typeof Receipt;
	};

	const tiles: Tile[] = [
		{
			href: '/invoicing',
			title: 'Invoicing',
			statLabel: 'Unbilled entries',
			icon: Receipt
		},
		{
			href: '/library',
			title: 'Library',
			statLabel: 'Books',
			icon: BookOpen
		},
		{
			href: '/projects',
			title: 'Projects',
			statLabel: 'Active projects',
			icon: FolderKanban
		}
	];
</script>

<div class="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
	<section
		class="mb-8 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm md:p-5"
		aria-labelledby="project-status-heading"
	>
		<h2
			id="project-status-heading"
			class="mb-1 text-sm font-semibold tracking-tight text-foreground"
		>
			Project status
		</h2>
		<p class="text-sm text-muted-foreground">Active projects</p>
		<p class="mt-3 text-3xl font-semibold text-foreground tabular-nums" aria-live="polite">–</p>
	</section>

	<h2 class="sr-only text-foreground">Modules</h2>
	<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each tiles as { href, title, statLabel, icon: Icon } (href)}
			<li>
				<a
					{href}
					class={cn(
						'flex h-full flex-col rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-colors hover:border-ring/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
					)}
				>
					<div class="mb-4 flex items-center gap-2 text-muted-foreground">
						<Icon class="size-5 shrink-0" />
						<span class="text-base font-semibold tracking-tight text-foreground">{title}</span>
					</div>
					<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
						{statLabel}
					</p>
					<p class="mt-2 text-3xl font-semibold text-foreground tabular-nums">–</p>
				</a>
			</li>
		{/each}
	</ul>
</div>

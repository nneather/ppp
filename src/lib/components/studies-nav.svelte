<script lang="ts">
	import { page } from '$app/state';
	import { cn } from '$lib/utils';

	const tabs = [
		{ href: '/studies', label: 'Overview', current: (path: string) => path === '/studies' },
		{
			href: '/studies/papers',
			label: 'Papers',
			current: (path: string) => path.startsWith('/studies/papers')
		},
		{
			href: '/studies/sermons',
			label: 'Sermons',
			current: (path: string) => path.startsWith('/studies/sermons')
		},
		{
			href: '/studies/sets',
			label: 'Sets',
			current: (path: string) => path.startsWith('/studies/sets')
		},
		{
			href: '/studies/by-book',
			label: 'By book',
			current: (path: string) => path.startsWith('/studies/by-book')
		}
	] as const;

	const path = $derived(page.url.pathname);
</script>

<nav
	class="inline-flex flex-wrap gap-0.5 rounded-md border border-border p-0.5 text-xs font-medium"
	aria-label="Studies"
>
	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			class={cn(
				'rounded-sm px-3 py-1.5 transition-colors',
				tab.current(path)
					? 'bg-foreground text-background'
					: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
			)}
			aria-current={tab.current(path) ? 'page' : undefined}
		>
			{tab.label}
		</a>
	{/each}
</nav>

<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import { page } from '$app/state';
	import { cn } from '$lib/utils';

	let { children } = $props();

	type TabItem = { href: string; label: string };

	const tabs: TabItem[] = [
		{ href: '/settings/library/genres', label: 'Genres' },
		{ href: '/settings/library/categories', label: 'Categories' },
		{ href: '/settings/library/bible-books', label: 'Bible books' }
	];

	function tabActive(hrefPath: string): boolean {
		return page.url.pathname === hrefPath;
	}
</script>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
	<a
		href="/settings"
		class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> Settings
	</a>

	<header class="mt-4 flex items-start gap-2 text-muted-foreground">
		<BookOpen class="mt-0.5 size-5 shrink-0" />
		<div>
			<h1 class="text-2xl font-semibold tracking-tight text-foreground">Library settings</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Read-only reference data used by library forms — genres, shelving categories, and Bible book names.
			</p>
		</div>
	</header>

	<nav
		class="mt-6 flex gap-1 border-b border-border"
		aria-label="Library settings sections"
	>
		{#each tabs as { href, label } (href)}
			{@const active = tabActive(href)}
			<a
				{href}
				class={cn(
					'-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
					active
						? 'border-foreground text-foreground'
						: 'border-transparent text-muted-foreground hover:text-foreground'
				)}
				aria-current={active ? 'page' : undefined}
			>
				{label}
			</a>
		{/each}
	</nav>

	<div class="mt-6">
		{@render children()}
	</div>
</div>

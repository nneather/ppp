<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import { page } from '$app/state';
	import { cn } from '$lib/utils';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	type TabItem = { href: string; label: string };

	const tabs = $derived.by((): TabItem[] => {
		const t: TabItem[] = [
			{ href: '/settings/library', label: 'Overview' },
			{ href: '/settings/library/people', label: 'People' }
		];
		if (data.isOwner) {
			t.push({ href: '/settings/library/people/merge', label: 'Merge' });
			t.push({ href: '/settings/library/export', label: 'CSV export' });
		}
		t.push(
			{ href: '/settings/library/series', label: 'Series' },
			{ href: '/settings/library/ancient-texts', label: 'Ancient texts' }
		);
		t.push(
			{ href: '/settings/library/genres', label: 'Genres' },
			{ href: '/settings/library/categories', label: 'Categories' },
			{ href: '/settings/library/bible-books', label: 'Bible books' }
		);
		return t;
	});

	function tabActive(hrefPath: string): boolean {
		const path = page.url.pathname;
		if (hrefPath === '/settings/library') return path === '/settings/library';
		if (hrefPath === '/settings/library/export') {
			return path.startsWith('/settings/library/export');
		}
		if (hrefPath === '/settings/library/people/merge') {
			return path.startsWith('/settings/library/people/merge');
		}
		if (hrefPath === '/settings/library/people') {
			return path === '/settings/library/people';
		}
		if (hrefPath === '/settings/library/series') {
			return path === '/settings/library/series';
		}
		if (hrefPath === '/settings/library/ancient-texts') {
			return path === '/settings/library/ancient-texts';
		}
		return path === hrefPath;
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
				People can be merged or renamed; genres, categories, and Bible book names are read-only
				reference data for library forms.
			</p>
		</div>
	</header>

	<nav class="mt-6 flex gap-1 border-b border-border" aria-label="Library settings sections">
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

<script lang="ts">
	import BookOpen from '@lucide/svelte/icons/book-open';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type HubLink = { href: string; label: string; description: string };

	const links: HubLink[] = [
		{
			href: '/settings/library/people',
			label: 'People',
			description: 'Rename, remove, or merge duplicate authors linked to your books.'
		},
		{
			href: '/settings/library/series',
			label: 'Series',
			description: 'Rename series and abbreviations; remove unused series.'
		},
		{
			href: '/settings/library/ancient-texts',
			label: 'Ancient texts',
			description: 'Josephus, Philo, and other tagged corpora; merge duplicates.'
		},
		{
			href: '/settings/library/genres',
			label: 'Genres',
			description: 'Closed list used by book forms and filters.'
		},
		{
			href: '/settings/library/categories',
			label: 'Categories',
			description: 'Shelving categories from seed data.'
		},
		{
			href: '/settings/library/bible-books',
			label: 'Bible books',
			description: 'Canon names for scripture and coverage pickers.'
		}
	];
</script>

<svelte:head>
	<title>Library settings — ppp</title>
</svelte:head>

<p class="text-sm text-muted-foreground">
	Pick a section below or use the tabs above. People can be edited here; genre, category, and Bible book lists are
	reference-only unless you change them in the database.
</p>

{#if data.isOwner}
	<p class="mt-3">
		<a
			href="/settings/library/people/merge"
			class="text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
		>
			Merge duplicate people (suggestions)
		</a>
	</p>
{/if}

<ul class="mt-6 divide-y divide-border rounded-xl border border-border">
	{#each links as item (item.href)}
		<li>
			<a
				href={item.href}
				class="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/40 sm:items-center"
			>
				<BookOpen class="mt-0.5 size-5 shrink-0 text-muted-foreground sm:mt-0" />
				<div class="min-w-0 flex-1">
					<p class="font-medium text-foreground">{item.label}</p>
					<p class="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
				</div>
				<ChevronRight class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
			</a>
		</li>
	{/each}
</ul>

<p class="mt-6 text-center">
	<Button href="/library" variant="outline">Back to library</Button>
</p>

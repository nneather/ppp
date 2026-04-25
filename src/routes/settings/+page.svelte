<script lang="ts">
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import Receipt from '@lucide/svelte/icons/receipt';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import { cn } from '$lib/utils';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Card = {
		href: string;
		title: string;
		description: string;
		icon: typeof CircleUser;
		summary: string;
	};

	const cards = $derived.by((): Card[] => {
		const list: Card[] = [
			{
				href: '/settings/profile',
				title: 'Profile',
				description: 'Name and password',
				icon: CircleUser,
				summary: data.userEmail || 'Signed in'
			},
			{
				href: '/settings/invoicing',
				title: 'Invoicing',
				description: 'Clients, rates, and defaults',
				icon: Receipt,
				summary:
					data.clientCount != null
						? `${data.clientCount} client${data.clientCount === 1 ? '' : 's'}`
						: '—'
			}
		];
		if (data.isOwner) {
			list.push({
				href: '/settings/audit-log',
				title: 'Audit log',
				description: 'Every change across the app',
				icon: ScrollText,
				summary: 'Owner-only'
			});
		}
		return list;
	});
</script>

<svelte:head>
	<title>Settings — ppp</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
	<h1 class="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
	<p class="mt-1 text-sm text-muted-foreground">Manage your account and module preferences.</p>

	{#if data.settingsHubError}
		<p
			class="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
			role="alert"
		>
			{data.settingsHubError}
		</p>
	{/if}

	<ul class="mt-8 grid gap-4 sm:grid-cols-2">
		{#each cards as { href, title, description, icon: Icon, summary } (href)}
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
					<p class="text-sm text-muted-foreground">{description}</p>
					<p class="mt-3 text-sm font-medium text-foreground">{summary}</p>
				</a>
			</li>
		{/each}
	</ul>
</div>

<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils';
	import { createClient } from '$lib/supabase/client';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Receipt from '@lucide/svelte/icons/receipt';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import FolderKanban from '@lucide/svelte/icons/folder-kanban';
	import Settings from '@lucide/svelte/icons/settings';
	import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
	import PanelLeftOpen from '@lucide/svelte/icons/panel-left-open';
	import LogOut from '@lucide/svelte/icons/log-out';

	const STORAGE_KEY = 'ppp_nav_collapsed';

	let { children, data } = $props();

	let navCollapsed = $state(false);
	let prefsReady = $state(false);

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/invoicing', label: 'Invoicing', icon: Receipt },
		{ href: '/library', label: 'Library', icon: BookOpen },
		{ href: '/projects', label: 'Projects', icon: FolderKanban },
		{ href: '/settings', label: 'Settings', icon: Settings }
	] as const;

	const pathname = $derived(page.url.pathname);
	const isLogin = $derived(pathname === '/login');

	function isNavActive(href: string, path: string): boolean {
		if (href === '/dashboard') return path === '/dashboard';
		return path === href || path.startsWith(`${href}/`);
	}

	onMount(() => {
		if (!browser) return;
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored === 'true') navCollapsed = true;
			else if (stored === 'false') navCollapsed = false;
		} catch {
			/* ignore */
		}
		prefsReady = true;
	});

	$effect(() => {
		if (!browser || !prefsReady) return;
		try {
			localStorage.setItem(STORAGE_KEY, String(navCollapsed));
		} catch {
			/* ignore */
		}
	});

	async function handleSignOut() {
		const supabase = createClient();
		await supabase.auth.signOut();
		goto('/login');
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if isLogin}
	{@render children()}
{:else}
	<div class="min-h-dvh bg-background text-foreground md:flex">
		<!-- Desktop sidebar -->
		<aside
			class={cn(
				'hidden shrink-0 flex-col border-r border-border bg-card text-card-foreground transition-[width] duration-200 ease-out md:flex',
				navCollapsed ? 'w-[4.5rem]' : 'w-56'
			)}
		>
			<div class="flex h-14 items-center justify-between gap-2 border-b px-3">
				{#if navCollapsed}
					<span
						class="flex size-9 items-center justify-center text-xs font-semibold tracking-tight text-muted-foreground"
					>
						p
					</span>
				{:else}
					<span class="truncate pl-1 text-sm font-semibold tracking-tight">ppp</span>
				{/if}
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					class="shrink-0"
					onclick={() => (navCollapsed = !navCollapsed)}
					aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				>
					{#if navCollapsed}
						<PanelLeftOpen class="size-4" />
					{:else}
						<PanelLeftClose class="size-4" />
					{/if}
				</Button>
			</div>

			<nav class="flex flex-1 flex-col gap-0.5 p-2" aria-label="Main">
				{#each navItems as { href, label, icon: Icon } (href)}
					<a
						{href}
						class={cn(
							'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
							isNavActive(href, pathname)
								? 'bg-muted text-foreground'
								: 'text-muted-foreground hover:text-foreground',
							navCollapsed && 'justify-center px-0'
						)}
						aria-current={isNavActive(href, pathname) ? 'page' : undefined}
						title={navCollapsed ? label : undefined}
					>
						<Icon class="size-[1.125rem] shrink-0" />
						{#if !navCollapsed}
							<span class="truncate">{label}</span>
						{/if}
					</a>
				{/each}
			</nav>

			<Separator />

			<div class="flex flex-col gap-2 p-2">
				{#if !navCollapsed && data.user?.email}
					<p class="truncate px-1 text-xs text-muted-foreground" title={data.user.email}>
						{data.user.email}
					</p>
				{/if}
				<Button
					type="button"
					variant="outline"
					size="sm"
					class={cn('w-full gap-2', navCollapsed && 'size-9 p-0')}
					onclick={handleSignOut}
					title={navCollapsed ? 'Sign out' : undefined}
				>
					<LogOut class="size-4 shrink-0" />
					{#if !navCollapsed}
						<span>Sign out</span>
					{/if}
				</Button>
			</div>
		</aside>

		<!-- Main -->
		<div
			class="flex min-h-dvh min-w-0 flex-1 flex-col pb-tabbar md:pb-8"
		>
			<main class="flex-1">
				{@render children()}
			</main>
		</div>

		<!-- Mobile tab bar -->
		<nav
			class="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-card/95 pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))] pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-0.5 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden"
			aria-label="Main"
		>
			{#each navItems as { href, label, icon: Icon } (href)}
				<a
					{href}
					class={cn(
						'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[0.65rem] font-medium transition-colors hover:bg-muted/80',
						isNavActive(href, pathname)
							? 'text-foreground'
							: 'text-muted-foreground hover:text-foreground'
					)}
					aria-current={isNavActive(href, pathname) ? 'page' : undefined}
				>
					<Icon class="size-5 shrink-0" />
					<span class="max-w-full truncate px-0.5">{label}</span>
				</a>
			{/each}
		</nav>
	</div>
{/if}

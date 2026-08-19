<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { goto, preloadData } from '$app/navigation';
	import { navigating } from '$app/state';
	import NavModuleSkeleton from '$lib/components/nav-module-skeleton.svelte';
	import { cn } from '$lib/utils';
	import { createClient } from '$lib/supabase/client';
	import { Button } from '$lib/components/ui/button';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Receipt from '@lucide/svelte/icons/receipt';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import FolderKanban from '@lucide/svelte/icons/folder-kanban';
	import ListTodo from '@lucide/svelte/icons/list-todo';
	import Mic from '@lucide/svelte/icons/mic';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import Users from '@lucide/svelte/icons/users';
	import Settings from '@lucide/svelte/icons/settings';
	import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
	import PanelLeftOpen from '@lucide/svelte/icons/panel-left-open';
	import LogOut from '@lucide/svelte/icons/log-out';
	import geistLatinWoff2Url from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url';

	const NAV_STORAGE_KEY = 'ppp_nav_collapsed';
	const TASKS_STORAGE_KEY = 'ppp_tasks_collapsed';

	let { children, data } = $props();

	let navCollapsed = $state(false);
	let tasksCollapsed = $state(false);
	let prefsReady = $state(false);

	/** Full module list — desktop sidebar. */
	const desktopNavItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/tasks', label: 'Tasks', icon: ListTodo },
		{ href: '/classwork', label: 'Classwork', icon: GraduationCap },
		{ href: '/contacts', label: 'Contacts', icon: Users },
		{ href: '/sermons', label: 'Sermons', icon: Mic },
		{ href: '/invoicing', label: 'Invoicing', icon: Receipt },
		{ href: '/library', label: 'Library', icon: BookOpen },
		{ href: '/projects', label: 'Projects', icon: FolderKanban },
		{ href: '/settings', label: 'Settings', icon: Settings }
	] as const;

	/** Mobile tab bar — Sermons + Projects + Contacts stay desktop-sidebar only. */
	const mobileNavItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/tasks', label: 'Tasks', icon: ListTodo },
		{ href: '/invoicing', label: 'Invoicing', icon: Receipt },
		{ href: '/library', label: 'Library', icon: BookOpen },
		{ href: '/classwork', label: 'Classwork', icon: GraduationCap }
	] as const;

	const pathname = $derived(page.url.pathname);
	const isTasksPath = $derived(pathname === '/tasks' || pathname.startsWith('/tasks/'));
	let isDesktop = $state(false);
	const isLogin = $derived(pathname === '/login');
	const navTarget = $derived(navigating.to);

	function skeletonModule(
		path: string
	):
		| 'dashboard'
		| 'invoicing'
		| 'library'
		| 'projects'
		| 'sermons'
		| 'classwork'
		| 'contacts'
		| 'settings'
		| 'generic' {
		if (path.startsWith('/library')) return 'library';
		if (path.startsWith('/invoicing')) return 'invoicing';
		if (path.startsWith('/dashboard')) return 'dashboard';
		if (path.startsWith('/sermons')) return 'sermons';
		if (path.startsWith('/classwork')) return 'classwork';
		if (path.startsWith('/contacts')) return 'contacts';
		if (path.startsWith('/tasks')) return 'projects';
		if (path.startsWith('/projects')) return 'projects';
		if (path.startsWith('/settings')) return 'settings';
		return 'generic';
	}

	const showNavSkeleton = $derived(navTarget != null && !isLogin);

	const NAV_WATCHDOG_MS = 12_000;
	let navHang = $state(false);

	$effect(() => {
		if (!browser || !navTarget || isLogin) {
			navHang = false;
			return;
		}
		navHang = false;
		const timer = window.setTimeout(() => {
			navHang = true;
		}, NAV_WATCHDOG_MS);
		return () => {
			window.clearTimeout(timer);
			navHang = false;
		};
	});

	function retryNavDocument() {
		const href = navTarget?.url.href;
		if (href) window.location.assign(href);
	}

	function preloadNav(href: string) {
		void preloadData(href);
	}

	function isNavActive(href: string, path: string): boolean {
		if (href === '/dashboard') return path === '/dashboard';
		return path === href || path.startsWith(`${href}/`);
	}

	onMount(() => {
		if (!browser) return;
		document.querySelector('[data-ppp-boot]')?.remove();
		try {
			const storedNav = localStorage.getItem(NAV_STORAGE_KEY);
			if (storedNav === 'true') navCollapsed = true;
			else if (storedNav === 'false') navCollapsed = false;
			const storedTasks = localStorage.getItem(TASKS_STORAGE_KEY);
			if (storedTasks === 'true') tasksCollapsed = true;
			else if (storedTasks === 'false') tasksCollapsed = false;
		} catch {
			/* ignore */
		}
		prefsReady = true;

		const mq = window.matchMedia('(min-width: 768px)');
		const syncDesktop = () => {
			isDesktop = mq.matches;
		};
		syncDesktop();
		mq.addEventListener('change', syncDesktop);
		return () => mq.removeEventListener('change', syncDesktop);
	});

	$effect(() => {
		if (!browser || !prefsReady) return;
		try {
			localStorage.setItem(NAV_STORAGE_KEY, String(navCollapsed));
			localStorage.setItem(TASKS_STORAGE_KEY, String(tasksCollapsed));
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

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preload" href={geistLatinWoff2Url} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

{#if isLogin}
	{@render children()}
{:else}
	<div class="flex h-dvh max-h-dvh min-h-dvh overflow-hidden bg-background text-foreground md:flex">
		<!-- Desktop sidebar -->
		<aside
			class={cn(
				'hidden h-full min-h-0 shrink-0 flex-col border-r border-border bg-card text-card-foreground transition-[width] duration-200 ease-out md:flex',
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
				{#each desktopNavItems as { href, label, icon: Icon } (href)}
					<a
						{href}
						data-sveltekit-preload-data="hover"
						onpointerdown={() => preloadNav(href)}
						ontouchstart={() => preloadNav(href)}
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

			<hr class="border-border" />

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

		<!-- Main column: scrollable content + mobile tab bar footer (not position:fixed — iOS PWA) -->
		<div class="flex min-h-0 min-w-0 flex-1 flex-col">
			<main class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-4 md:pb-8">
				{#if showNavSkeleton && navTarget}
					<NavModuleSkeleton module={skeletonModule(navTarget.url.pathname)} />
				{:else}
					{@render children()}
				{/if}
			</main>

			<nav
				class="shrink-0 flex border-t border-border bg-card/95 pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))] pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-0.5 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden"
				aria-label="Main"
			>
				{#each mobileNavItems as { href, label, icon: Icon } (href)}
					<a
						{href}
						data-sveltekit-preload-data="hover"
						onpointerdown={() => preloadNav(href)}
						ontouchstart={() => preloadNav(href)}
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

		{#if !isTasksPath}
			<aside
				class={cn(
					'hidden h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-border bg-card text-card-foreground transition-[width] duration-200 ease-out md:flex',
					tasksCollapsed ? 'w-[4.5rem]' : 'w-96'
				)}
				aria-label="Now tasks"
			>
				{#if isDesktop}
					{#await import('$lib/components/desktop-task-rail.svelte') then { default: DesktopTaskRail }}
						<DesktopTaskRail bind:collapsed={tasksCollapsed} />
					{/await}
				{:else}
					<div class="border-b border-border px-3 py-2.5">
						<p class="text-sm font-semibold tracking-tight">Now</p>
					</div>
				{/if}
			</aside>
		{/if}
	</div>
{/if}

{#if navHang && navTarget}
	<div
		class="fixed inset-x-0 bottom-tabbar z-[55] mx-auto flex w-full max-w-md flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg md:bottom-6"
		role="alertdialog"
		aria-live="assertive"
	>
		<p class="text-center leading-snug">Still loading — tap to retry</p>
		<div class="flex justify-center">
			<Button type="button" variant="default" hotkey="u" onclick={retryNavDocument}>
				<HotkeyLabel label="Try again" mnemonic="u" />
			</Button>
		</div>
	</div>
{/if}

{#if browser}
	{#await import('$lib/components/PwaReloadToast.svelte') then { default: PwaReloadToast }}
		<PwaReloadToast />
	{/await}
{/if}

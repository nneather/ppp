<script lang="ts">
	import { browser } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { cn } from '$lib/utils';
	import HealthTrendBadge from '$lib/components/health-trend-badge.svelte';
	import { trendDirection } from '$lib/projects/filter';
	import type { LatestHealth, ProjectNode } from '$lib/types/projects';

	let {
		tree,
		latestHealth
	}: {
		tree: ProjectNode[];
		latestHealth: Record<string, LatestHealth>;
	} = $props();

	let collapsedIds = $state(new Set<string>());
	let initialCollapseDone = $state(false);

	function collectCollapsibleIds(nodes: ProjectNode[]): Set<string> {
		const ids = new Set<string>();
		function walk(ns: ProjectNode[]) {
			for (const n of ns) {
				if (n.children.length > 0) {
					ids.add(n.id);
					walk(n.children);
				}
			}
		}
		walk(nodes);
		return ids;
	}

	function toggleCollapsed(id: string) {
		const next = new Set(collapsedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		collapsedIds = next;
	}

	function collapseAllBranches() {
		collapsedIds = collectCollapsibleIds(tree);
	}

	// First paint on dashboard when tree is ready.
	$effect(() => {
		if (!browser || initialCollapseDone || tree.length === 0) return;
		if (page.url.pathname !== '/dashboard') return;
		untrack(() => {
			collapseAllBranches();
			initialCollapseDone = true;
		});
	});

	// Every navigation to dashboard — independent of /projects expand state.
	afterNavigate((nav) => {
		if (!browser || nav.to?.url.pathname !== '/dashboard') return;
		if (tree.length === 0) return;
		collapseAllBranches();
		initialCollapseDone = true;
	});

	function domainHref(name: string): string {
		return `/projects?domain=${encodeURIComponent(name)}`;
	}
</script>

{#snippet domainRows(nodes: ProjectNode[], isRoot = false)}
	{#each nodes as node (node.id)}
		{@const latest = latestHealth[node.id]}
		{@const health = latest?.health_status ?? null}
		{@const trend = trendDirection(latest)}
		{@const hasChildren = node.children.length > 0}
		{@const collapsed = collapsedIds.has(node.id)}
		<div class={cn('border-b border-border/60 last:border-b-0', !isRoot && 'pl-4 md:pl-6')}>
			<div class="flex min-w-0 items-center gap-2 px-3 py-2.5 md:px-4">
				{#if hasChildren}
					<button
						type="button"
						class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label={collapsed ? 'Expand' : 'Collapse'}
						aria-expanded={!collapsed}
						onclick={() => toggleCollapsed(node.id)}
					>
						<ChevronRight class={cn('size-4 transition-transform', !collapsed && 'rotate-90')} />
					</button>
				{:else}
					<span class="size-5 shrink-0" aria-hidden="true"></span>
				{/if}

				{#if isRoot}
					<a
						href={domainHref(node.name)}
						class={cn(
							'min-w-0 flex-1 truncate font-medium text-foreground hover:underline',
							'text-base md:text-lg'
						)}
					>
						{node.name}
					</a>
				{:else}
					<a
						href="/projects"
						class="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline md:text-base"
					>
						{node.name}
					</a>
				{/if}

				<div class="shrink-0">
					<HealthTrendBadge {health} {trend} compact={!isRoot} />
				</div>
			</div>

			{#if hasChildren && !collapsed}
				{@render domainRows(node.children, false)}
			{/if}
		</div>
	{/each}
{/snippet}

<div class="rounded-lg border border-border bg-muted/20">
	{#if tree.length === 0}
		<p class="px-4 py-3 text-sm text-muted-foreground">No projects yet.</p>
	{:else}
		{@render domainRows(tree, true)}
	{/if}
</div>

<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { cn } from '$lib/utils';
	import HealthTrendBadge from '$lib/components/health-trend-badge.svelte';
	import { computeVisibleNodeIds, trendDirection } from '$lib/projects/filter';
	import {
		HEALTH_STATUS_ORDER,
		HEALTH_STATUS_LABELS,
		LIFECYCLE_STATUS_LABELS,
		type HealthStatus,
		type LifecycleStatus,
		type ProjectNode,
		type ProjectUpdateRow,
		type WeeklyDraftRow,
		type LatestHealth,
		type ProjectFilters
	} from '$lib/types/projects';

	type CarryForward = Pick<ProjectUpdateRow, 'health_status' | 'reason' | 'next_steps'>;

	let {
		tree,
		weekOf,
		weekUpdates,
		carryForward,
		latestHealth = {},
		filters,
		drafts = $bindable({} as Record<string, WeeklyDraftRow>),
		revealBranchFor = $bindable(null as string | null),
		onEdit,
		onDelete,
		onAddChild
	}: {
		tree: ProjectNode[];
		weekOf: string;
		weekUpdates: Record<string, ProjectUpdateRow>;
		carryForward: Record<string, CarryForward>;
		latestHealth?: Record<string, LatestHealth>;
		filters: ProjectFilters;
		drafts?: Record<string, WeeklyDraftRow>;
		/** When set, expands ancestors so the branch is visible (e.g. after create). */
		revealBranchFor?: string | null;
		onEdit: (node: ProjectNode) => void;
		onDelete: (node: ProjectNode) => void;
		onAddChild: (node: ProjectNode) => void;
	} = $props();

	const visibleIds = $derived(computeVisibleNodeIds(tree, latestHealth, filters));

	let collapsedIds = $state(new Set<string>());
	let expandedDetailIds = $state(new Set<string>());
	let mobileDefaultApplied = $state(false);

	function walkTreeFingerprint(nodes: ProjectNode[], parts: string[] = []): string[] {
		for (const n of nodes) {
			parts.push(`${n.id}:${n.lifecycle_status}`);
			if (n.children.length) walkTreeFingerprint(n.children, parts);
		}
		return parts;
	}

	const treeFingerprint = $derived(walkTreeFingerprint(tree).sort().join(','));

	const updatesFingerprint = $derived(
		Object.entries(weekUpdates)
			.map(([k, v]) => `${k}:${v.id}:${v.health_status}`)
			.sort()
			.join(',')
	);

	let lastSeedWeek = $state('');
	let lastSeedUpdates = $state('');
	let lastSeedTree = $state('');

	function ancestorIdsFor(
		nodes: ProjectNode[],
		targetId: string,
		acc: string[] = []
	): string[] | null {
		for (const n of nodes) {
			if (n.id === targetId) return acc;
			const inner = ancestorIdsFor(n.children, targetId, [...acc, n.id]);
			if (inner) return inner;
		}
		return null;
	}

	function ensureBranchVisible(projectId: string) {
		const ancestors = ancestorIdsFor(tree, projectId) ?? [];
		const next = new Set(collapsedIds);
		for (const id of ancestors) next.delete(id);
		next.delete(projectId);
		collapsedIds = next;
	}

	function isCheckinEligible(status: LifecycleStatus): boolean {
		return status === 'active' || status === 'paused';
	}

	function collectEligible(nodes: ProjectNode[], out: ProjectNode[] = []): ProjectNode[] {
		for (const n of nodes) {
			if (isCheckinEligible(n.lifecycle_status)) out.push(n);
			if (n.children.length) collectEligible(n.children, out);
		}
		return out;
	}

	function draftForNode(node: ProjectNode): WeeklyDraftRow {
		const cur = weekUpdates[node.id];
		const prev = carryForward[node.id];
		const health_status: HealthStatus =
			cur?.health_status ?? prev?.health_status ?? 'satisfactory';
		return {
			project_id: node.id,
			update_id: cur?.id,
			health_status,
			reason: cur?.reason ?? prev?.reason ?? '',
			next_steps: cur?.next_steps ?? prev?.next_steps ?? ''
		};
	}

	function buildInitialDrafts(): Record<string, WeeklyDraftRow> {
		const next: Record<string, WeeklyDraftRow> = {};
		for (const node of collectEligible(tree)) {
			next[node.id] = draftForNode(node);
		}
		return next;
	}

	function mergeInitialDrafts(prev: Record<string, WeeklyDraftRow>): Record<string, WeeklyDraftRow> {
		const eligible = collectEligible(tree);
		const eligibleIds = new Set(eligible.map((n) => n.id));
		const next: Record<string, WeeklyDraftRow> = {};
		for (const [id, row] of Object.entries(prev)) {
			if (eligibleIds.has(id)) next[id] = row;
		}
		for (const node of eligible) {
			if (!next[node.id]) next[node.id] = draftForNode(node);
		}
		return next;
	}

	// Footgun #1: wrap data reads in untrack so user edits to drafts are not wiped.
	$effect(() => {
		const w = weekOf;
		const u = updatesFingerprint;
		const t = treeFingerprint;
		untrack(() => {
			const weekOrUpdatesChanged = w !== lastSeedWeek || u !== lastSeedUpdates;
			if (weekOrUpdatesChanged) {
				drafts = buildInitialDrafts();
			} else if (t !== lastSeedTree) {
				drafts = mergeInitialDrafts(drafts);
			}
			lastSeedWeek = w;
			lastSeedUpdates = u;
			lastSeedTree = t;
		});
	});

	$effect(() => {
		const reveal = revealBranchFor;
		if (!reveal) return;
		untrack(() => ensureBranchVisible(reveal));
		revealBranchFor = null;
	});

	$effect(() => {
		if (!browser || mobileDefaultApplied) return;
		const mq = window.matchMedia('(max-width: 767px)');
		const apply = () => {
			if (!mq.matches) {
				collapsedIds = new Set();
				return;
			}
			const ids = new Set<string>();
			function walk(nodes: ProjectNode[]) {
				for (const n of nodes) {
					if (n.children.length > 0) ids.add(n.id);
					walk(n.children);
				}
			}
			walk(tree);
			collapsedIds = ids;
		};
		apply();
		mobileDefaultApplied = true;
		mq.addEventListener('change', apply);
		return () => mq.removeEventListener('change', apply);
	});

	function toggleCollapsed(id: string) {
		const next = new Set(collapsedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		collapsedIds = next;
	}

	function toggleDetail(id: string) {
		const next = new Set(expandedDetailIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expandedDetailIds = next;
	}

	function setHealth(projectId: string, health_status: HealthStatus) {
		const row = drafts[projectId];
		if (!row) return;
		drafts = { ...drafts, [projectId]: { ...row, health_status } };
	}

	function patchDraft(projectId: string, patch: Partial<Pick<WeeklyDraftRow, 'reason' | 'next_steps'>>) {
		const row = drafts[projectId];
		if (!row) return;
		drafts = { ...drafts, [projectId]: { ...row, ...patch } };
	}

	const healthSegmentClass: Record<HealthStatus, string> = {
		excellent: 'bg-emerald-600/90 text-white hover:bg-emerald-600',
		satisfactory: 'bg-green-600/80 text-white hover:bg-green-600',
		watch: 'bg-amber-500/90 text-white hover:bg-amber-500',
		serious: 'bg-orange-600/90 text-white hover:bg-orange-600',
		critical: 'bg-red-600/90 text-white hover:bg-red-600'
	};
</script>

{#snippet treeRows(nodes: ProjectNode[])}
	{#each nodes as node (node.id)}
		{#if visibleIds.has(node.id)}
		{@const eligible = isCheckinEligible(node.lifecycle_status)}
		{@const draft = drafts[node.id]}
		{@const hasChildren = node.children.length > 0}
		{@const collapsed = collapsedIds.has(node.id)}
		{@const latest = latestHealth[node.id]}
		{@const trend = trendDirection(latest)}
		<div
			class={cn(
				'border-b border-border/60',
				node.depth === 0 && 'bg-muted/30',
				node.depth > 0 && 'pl-4 md:pl-6'
			)}
		>
			<div
				class={cn(
					'flex flex-col gap-2 py-3 pr-2',
					node.depth === 0 ? 'px-3 md:px-4' : 'px-2 md:px-3'
				)}
			>
				<div class="flex min-w-0 items-start gap-2">
					{#if hasChildren}
						<button
							type="button"
							class="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
							aria-label={collapsed ? 'Expand' : 'Collapse'}
							aria-expanded={!collapsed}
							onclick={() => toggleCollapsed(node.id)}
						>
							<ChevronRight
								class={cn('size-4 transition-transform', !collapsed && 'rotate-90')}
							/>
						</button>
					{:else}
						<span class="size-5 shrink-0" aria-hidden="true"></span>
					{/if}

					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
							<span
								class={cn(
									'font-medium text-foreground',
									node.depth === 0 ? 'text-base md:text-lg' : 'text-sm md:text-base'
								)}
							>
								{node.name}
							</span>
							<span class="text-xs text-muted-foreground">
								{LIFECYCLE_STATUS_LABELS[node.lifecycle_status]}
							</span>
						</div>
						<div class="mt-0.5">
							<HealthTrendBadge
								health={latest?.health_status ?? null}
								{trend}
								compact
							/>
						</div>
					</div>

					<div class="flex shrink-0 gap-0.5">
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label="Add sub-project under {node.name}"
							onclick={() => onAddChild(node)}
						>
							<Plus class="size-4" />
						</Button>
						{#if node.parent_id != null}
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label="Edit project"
								onclick={() => onEdit(node)}
							>
								<Pencil class="size-4" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								class="text-destructive hover:text-destructive"
								aria-label="Delete project"
								onclick={() => onDelete(node)}
							>
								<Trash2 class="size-4" />
							</Button>
						{/if}
					</div>
				</div>

				{#if eligible && draft}
					<div
						class="flex flex-wrap gap-0.5 rounded-md border border-border p-0.5"
						role="group"
						aria-label="Health status for {node.name}"
					>
						{#each HEALTH_STATUS_ORDER as status (status)}
							<button
								type="button"
								class={cn(
									'min-w-0 flex-1 rounded px-1 py-1.5 text-[0.65rem] font-medium leading-tight sm:text-xs',
									draft.health_status === status
										? healthSegmentClass[status]
										: 'bg-muted/50 text-muted-foreground hover:bg-muted'
								)}
								aria-pressed={draft.health_status === status}
								onclick={() => setHealth(node.id, status)}
							>
								{HEALTH_STATUS_LABELS[status]}
							</button>
						{/each}
					</div>

					<Button
						type="button"
						variant="link"
						size="sm"
						class="h-auto self-start px-0 text-xs"
						onclick={() => toggleDetail(node.id)}
					>
						{expandedDetailIds.has(node.id) ? 'Hide notes' : 'Reason & next steps'}
					</Button>

					{#if expandedDetailIds.has(node.id)}
						<div class="grid gap-2 sm:grid-cols-2">
							<div class="space-y-1">
								<label class="text-xs font-medium text-muted-foreground" for="reason-{node.id}">
									Reason
								</label>
								<textarea
									id="reason-{node.id}"
									rows="3"
									class="border-input bg-background w-full rounded-md border px-2 py-1.5 text-sm"
									value={draft.reason}
									oninput={(e) =>
										patchDraft(node.id, {
											reason: (e.currentTarget as HTMLTextAreaElement).value
										})}
								></textarea>
							</div>
							<div class="space-y-1">
								<label
									class="text-xs font-medium text-muted-foreground"
									for="next-{node.id}"
								>
									Next steps
								</label>
								<textarea
									id="next-{node.id}"
									rows="3"
									class="border-input bg-background w-full rounded-md border px-2 py-1.5 text-sm"
									value={draft.next_steps}
									oninput={(e) =>
										patchDraft(node.id, {
											next_steps: (e.currentTarget as HTMLTextAreaElement).value
										})}
								></textarea>
							</div>
						</div>
					{/if}
				{:else if !eligible}
					<p class="text-xs text-muted-foreground italic">Not in weekly check-in sweep</p>
				{/if}
			</div>
		</div>

		{#if hasChildren && !collapsed}
			{@render treeRows(node.children)}
		{/if}
		{/if}
	{/each}
{/snippet}

<div class="rounded-lg border border-border bg-card">
	{@render treeRows(tree)}
</div>

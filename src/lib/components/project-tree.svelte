<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronsDownUp from '@lucide/svelte/icons/chevrons-down-up';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { cn } from '$lib/utils';
	import HealthStatusIcon from '$lib/components/health-status-icon.svelte';
	import HealthTrendBadge from '$lib/components/health-trend-badge.svelte';
	import { computeVisibleNodeIds, trendDirection } from '$lib/projects/filter';
	import {
		DEFAULT_PROGRESS_MAX,
		formatProgressLabel,
		isProgressEnabled
	} from '$lib/projects/progress';
	import {
		HEALTH_SEGMENT_SELECTED_CLASS,
		LIFECYCLE_BADGE_CLASS
	} from '$lib/projects/health-appearance';
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

	type CarryForward = Pick<
		ProjectUpdateRow,
		| 'health_status'
		| 'reason'
		| 'next_steps'
		| 'progress_value'
		| 'progress_max'
		| 'progress_note'
	>;

	let {
		tree,
		weekOf,
		weekUpdates,
		carryForward,
		latestHealth = {},
		filters,
		drafts = $bindable({} as Record<string, WeeklyDraftRow>),
		revealBranchFor = $bindable(null as string | null),
		draftSeedKey = 0,
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
		/** Bump after save so drafts reseed from fresh weekUpdates. */
		draftSeedKey?: number;
		onEdit: (node: ProjectNode) => void;
		onDelete: (node: ProjectNode) => void;
		onAddChild: (node: ProjectNode) => void;
	} = $props();

	const visibleIds = $derived(computeVisibleNodeIds(tree, latestHealth, filters));

	let collapsedIds = $state(new Set<string>());
	let expandedDetailIds = $state(new Set<string>());
	let collapseDefaultApplied = $state(false);

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
	let lastDraftSeedKey = $state(-1);

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
			next_steps: cur?.next_steps ?? prev?.next_steps ?? '',
			progress_value: cur?.progress_value ?? prev?.progress_value ?? null,
			progress_max: cur?.progress_max ?? prev?.progress_max ?? null,
			progress_note: cur?.progress_note ?? prev?.progress_note ?? null
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
		const sk = draftSeedKey;
		untrack(() => {
			const weekOrUpdatesChanged =
				w !== lastSeedWeek || u !== lastSeedUpdates || sk !== lastDraftSeedKey;
			if (weekOrUpdatesChanged) {
				drafts = buildInitialDrafts();
			} else if (t !== lastSeedTree) {
				drafts = mergeInitialDrafts(drafts);
			}
			lastSeedWeek = w;
			lastSeedUpdates = u;
			lastSeedTree = t;
			lastDraftSeedKey = sk;
		});
	});

	$effect(() => {
		const reveal = revealBranchFor;
		if (!reveal) return;
		untrack(() => ensureBranchVisible(reveal));
		revealBranchFor = null;
	});

	function collectAllCollapsibleIds(nodes: ProjectNode[]): Set<string> {
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

	$effect(() => {
		if (!browser || collapseDefaultApplied || tree.length === 0) return;
		untrack(() => {
			collapsedIds = collectAllCollapsibleIds(tree);
			collapseDefaultApplied = true;
		});
	});

	function toggleCollapsed(id: string) {
		const next = new Set(collapsedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		collapsedIds = next;
	}

	function collectVisibleCollapsibleIds(
		nodes: ProjectNode[],
		visible: Set<string>,
		ids = new Set<string>()
	): Set<string> {
		for (const n of nodes) {
			if (!visible.has(n.id)) continue;
			if (n.children.length > 0) {
				ids.add(n.id);
				collectVisibleCollapsibleIds(n.children, visible, ids);
			}
		}
		return ids;
	}

	const collapsibleIds = $derived(collectVisibleCollapsibleIds(tree, visibleIds));

	const allBranchesExpanded = $derived(
		collapsibleIds.size > 0 &&
			[...collapsibleIds].every((id) => !collapsedIds.has(id))
	);

	function toggleExpandAllBranches() {
		if (allBranchesExpanded) {
			collapsedIds = new Set(collapsibleIds);
		} else {
			collapsedIds = new Set();
		}
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

	type DraftPatch = Partial<
		Pick<
			WeeklyDraftRow,
			'reason' | 'next_steps' | 'progress_value' | 'progress_max' | 'progress_note'
		>
	>;

	function patchDraft(projectId: string, patch: DraftPatch) {
		const row = drafts[projectId];
		if (!row) return;
		let next: WeeklyDraftRow = { ...row, ...patch };
		if (
			next.progress_value != null &&
			next.progress_max != null &&
			next.progress_value > next.progress_max
		) {
			next = { ...next, progress_value: next.progress_max };
		}
		drafts = { ...drafts, [projectId]: next };
	}

	function setProgressEnabled(projectId: string, enabled: boolean) {
		const row = drafts[projectId];
		if (!row) return;
		if (!enabled) {
			patchDraft(projectId, {
				progress_value: null,
				progress_max: null,
				progress_note: null
			});
			return;
		}
		patchDraft(projectId, {
			progress_value: 0,
			progress_max: row.progress_max ?? DEFAULT_PROGRESS_MAX,
			progress_note: row.progress_note ?? ''
		});
	}

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
								{node.name}{#if node.children.length > 0}<span
										class="font-normal text-muted-foreground"
									>
										{' '}({node.children.length})</span
									>{/if}
							</span>
							{#if node.lifecycle_status !== 'active'}
								<span class={LIFECYCLE_BADGE_CLASS}>
									{LIFECYCLE_STATUS_LABELS[node.lifecycle_status]}
								</span>
							{/if}
						</div>
						{#if trend !== 'none'}
							<div class="mt-0.5">
								<HealthTrendBadge
									health={latest?.health_status ?? null}
									{trend}
									compact
									showStatusIcon={false}
								/>
							</div>
						{/if}
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
									'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded px-1 py-1.5 text-[0.65rem] font-medium leading-tight sm:text-xs',
									draft.health_status === status
										? HEALTH_SEGMENT_SELECTED_CLASS[status]
										: 'bg-muted/50 text-muted-foreground hover:bg-muted'
								)}
								aria-pressed={draft.health_status === status}
								onclick={() => setHealth(node.id, status)}
							>
								<HealthStatusIcon
									health={status}
									size="xs"
									muted={draft.health_status !== status}
								/>
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

						<div class="space-y-2 border-t border-border/60 pt-3 sm:max-w-md">
							<div class="flex items-center gap-2">
								<input
									id="progress-enabled-{node.id}"
									type="checkbox"
									class="size-4 rounded border border-input"
									checked={isProgressEnabled(draft.progress_value)}
									onchange={(e) =>
										setProgressEnabled(
											node.id,
											(e.currentTarget as HTMLInputElement).checked
										)}
								/>
								<Label
									for="progress-enabled-{node.id}"
									class="text-xs font-medium text-muted-foreground"
								>
									Track progress
								</Label>
							</div>

							{#if draft.progress_value != null && draft.progress_max != null}
								{@const pValue = draft.progress_value}
								{@const pMax = draft.progress_max}
								<div class="space-y-2">
									<p class="text-sm font-medium tabular-nums text-foreground">
										{formatProgressLabel(pValue, pMax)}
									</p>
									<progress
										class="h-2 w-full accent-primary"
										value={pValue}
										max={pMax}
										aria-label="Progress {formatProgressLabel(pValue, pMax)}"
									></progress>
									{#if draft.progress_note}
										<p class="text-xs text-muted-foreground">{draft.progress_note}</p>
									{/if}
									<div class="flex flex-wrap items-end gap-2">
										<div class="min-w-[4.5rem] flex-1 space-y-1">
											<Label
												for="progress-value-{node.id}"
												class="text-xs text-muted-foreground">Value</Label
											>
											<Input
												id="progress-value-{node.id}"
												type="number"
												min={0}
												max={pMax}
												step={1}
												class="h-8"
												value={pValue}
												oninput={(e) => {
													const v = Number(
														(e.currentTarget as HTMLInputElement).value
													);
													if (Number.isNaN(v)) return;
													patchDraft(node.id, {
														progress_value: Math.min(
															Math.max(0, Math.trunc(v)),
															pMax
														)
													});
												}}
											/>
										</div>
										<div class="min-w-[4.5rem] flex-1 space-y-1">
											<Label for="progress-max-{node.id}" class="text-xs text-muted-foreground"
												>Of</Label
											>
											<Input
												id="progress-max-{node.id}"
												type="number"
												min={1}
												step={1}
												class="h-8"
												value={pMax}
												oninput={(e) => {
													const v = Number(
														(e.currentTarget as HTMLInputElement).value
													);
													if (Number.isNaN(v) || v < 1) return;
													const max = Math.trunc(v);
													patchDraft(node.id, {
														progress_max: max,
														progress_value: Math.min(pValue, max)
													});
												}}
											/>
										</div>
									</div>
									<div class="space-y-1">
										<Label for="progress-note-{node.id}" class="text-xs text-muted-foreground"
											>Note</Label
										>
										<Input
											id="progress-note-{node.id}"
											type="text"
											placeholder="What does the total represent?"
											class="h-8"
											value={draft.progress_note ?? ''}
											oninput={(e) =>
												patchDraft(node.id, {
													progress_note:
														(e.currentTarget as HTMLInputElement).value || null
												})}
										/>
									</div>
								</div>
							{/if}
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
	{#if collapsibleIds.size > 0}
		<div class="flex justify-end border-b border-border/60 px-2 py-1 md:px-3">
			<Button
				type="button"
				variant="ghost"
				size="sm"
				class="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
				aria-label={allBranchesExpanded ? 'Collapse all branches' : 'Expand all branches'}
				onclick={toggleExpandAllBranches}
			>
				{#if allBranchesExpanded}
					<ChevronsDownUp class="size-3.5 shrink-0" aria-hidden="true" />
					<span class="hidden sm:inline">Collapse all</span>
				{:else}
					<ChevronsUpDown class="size-3.5 shrink-0" aria-hidden="true" />
					<span class="hidden sm:inline">Expand all</span>
				{/if}
			</Button>
		</div>
	{/if}
	{@render treeRows(tree)}
</div>

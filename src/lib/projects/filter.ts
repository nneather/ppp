import {
	LIFECYCLE_STATUSES,
	HEALTH_STATUSES,
	DEFAULT_VISIBLE_LIFECYCLES,
	HEALTH_STATUS_ORDER,
	type HealthStatus,
	type LifecycleStatus,
	type LatestHealth,
	type ProjectFilters,
	type ProjectNode,
	type TrendDirection
} from '$lib/types/projects';

export const ATTENTION_HEALTH = new Set<HealthStatus>(['watch', 'serious', 'critical']);

const HEALTH_RANK = new Map<HealthStatus, number>(
	HEALTH_STATUS_ORDER.map((s, i) => [s, i])
);

export function trendDirection(latest: LatestHealth | undefined): TrendDirection {
	if (!latest) return 'none';
	if (latest.previous == null) return 'none';
	const cur = HEALTH_RANK.get(latest.health_status);
	const prev = HEALTH_RANK.get(latest.previous);
	if (cur == null || prev == null) return 'none';
	if (cur < prev) return 'up';
	if (cur > prev) return 'down';
	return 'flat';
}

function parseLifecycleParam(raw: string | null): Set<LifecycleStatus> | null {
	if (!raw?.trim()) return null;
	const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
	const out = new Set<LifecycleStatus>();
	for (const p of parts) {
		if ((LIFECYCLE_STATUSES as readonly string[]).includes(p)) {
			out.add(p as LifecycleStatus);
		}
	}
	return out.size > 0 ? out : null;
}

function parseHealthParam(raw: string | null): HealthStatus | 'attention' | null {
	const t = (raw ?? '').trim();
	if (!t) return null;
	if (t === 'attention') return 'attention';
	if ((HEALTH_STATUSES as readonly string[]).includes(t)) return t as HealthStatus;
	return null;
}

export function parseProjectFilters(searchParams: URLSearchParams): ProjectFilters {
	const lifecycle = parseLifecycleParam(searchParams.get('lifecycle')) ?? DEFAULT_VISIBLE_LIFECYCLES;
	const health = parseHealthParam(searchParams.get('health'));
	const domain = searchParams.get('domain')?.trim() || null;
	return { lifecycle, health, domain };
}

/** True when lifecycle matches the default visible set (no `lifecycle` URL param). */
export function isDefaultLifecycleFilter(lifecycle: Set<LifecycleStatus>): boolean {
	if (lifecycle.size !== DEFAULT_VISIBLE_LIFECYCLES.size) return false;
	for (const s of DEFAULT_VISIBLE_LIFECYCLES) {
		if (!lifecycle.has(s)) return false;
	}
	return true;
}

/** Count of non-default filter dimensions for badge display. */
export function countActiveProjectFilters(filters: ProjectFilters): number {
	let count = 0;
	if (!isDefaultLifecycleFilter(filters.lifecycle)) count++;
	if (filters.health != null) count++;
	if (filters.domain != null) count++;
	return count;
}

export function hasActiveProjectFilters(searchParams: URLSearchParams): boolean {
	return countActiveProjectFilters(parseProjectFilters(searchParams)) > 0;
}

function nodeInDomainSubtree(node: ProjectNode, domainRootId: string | null): boolean {
	if (domainRootId == null) return true;
	if (node.id === domainRootId) return true;
	let cur: ProjectNode | undefined = node;
	while (cur?.parent_id) {
		if (cur.parent_id === domainRootId) return true;
		// Walk up via tree not available here — use parent_id chain from node only works one level
		break;
	}
	return false;
}

function buildParentMap(nodes: ProjectNode[]): Map<string, ProjectNode> {
	const map = new Map<string, ProjectNode>();
	function walk(list: ProjectNode[]) {
		for (const n of list) {
			map.set(n.id, n);
			if (n.children.length) walk(n.children);
		}
	}
	walk(nodes);
	return map;
}

function isUnderDomain(
	node: ProjectNode,
	domainRootId: string,
	byId: Map<string, ProjectNode>
): boolean {
	if (node.id === domainRootId) return true;
	let pid = node.parent_id;
	while (pid) {
		if (pid === domainRootId) return true;
		const parent = byId.get(pid);
		if (!parent) break;
		pid = parent.parent_id;
	}
	return false;
}

export function matchesFilter(
	node: ProjectNode,
	latest: LatestHealth | undefined,
	filters: ProjectFilters,
	opts?: { domainRootId?: string | null; byId?: Map<string, ProjectNode> }
): boolean {
	if (opts?.domainRootId != null && opts.byId) {
		if (!isUnderDomain(node, opts.domainRootId, opts.byId)) return false;
	} else if (opts?.domainRootId != null) {
		if (!nodeInDomainSubtree(node, opts.domainRootId)) return false;
	}

	if (!filters.lifecycle.has(node.lifecycle_status)) return false;

	if (filters.health === 'attention') {
		if (!latest || !ATTENTION_HEALTH.has(latest.health_status)) return false;
	} else if (filters.health != null) {
		if (!latest || latest.health_status !== filters.health) return false;
	}

	return true;
}

export function findDomainRootId(tree: ProjectNode[], domainName: string | null): string | null {
	if (!domainName) return null;
	const root = tree.find((n) => n.name === domainName && n.parent_id == null);
	return root?.id ?? null;
}

/** Visible if node matches filters or has a visible descendant (ancestor-preserving). */
export function computeVisibleNodeIds(
	tree: ProjectNode[],
	latestHealth: Map<string, LatestHealth> | Record<string, LatestHealth>,
	filters: ProjectFilters
): Set<string> {
	const latest =
		latestHealth instanceof Map ? latestHealth : new Map(Object.entries(latestHealth));
	const domainRootId = findDomainRootId(tree, filters.domain);
	const byId = buildParentMap(tree);
	const visible = new Set<string>();

	function walk(nodes: ProjectNode[]): boolean {
		let anyVisible = false;
		for (const node of nodes) {
			const selfMatches = matchesFilter(node, latest.get(node.id), filters, {
				domainRootId,
				byId
			});
			const childVisible = node.children.length > 0 && walk(node.children);
			if (selfMatches || childVisible) {
				visible.add(node.id);
				anyVisible = true;
			}
		}
		return anyVisible;
	}

	walk(tree);
	return visible;
}

export function countAttentionNodes(
	latestHealth: Map<string, LatestHealth> | Record<string, LatestHealth>
): number {
	const entries =
		latestHealth instanceof Map ? latestHealth.values() : Object.values(latestHealth);
	let count = 0;
	for (const h of entries) {
		if (ATTENTION_HEALTH.has(h.health_status)) count++;
	}
	return count;
}

export function countActiveProjects(tree: ProjectNode[]): number {
	let count = 0;
	function walk(nodes: ProjectNode[]) {
		for (const n of nodes) {
			if (n.parent_id != null && n.lifecycle_status === 'active') count++;
			if (n.children.length) walk(n.children);
		}
	}
	walk(tree);
	return count;
}

/**
 * Active + paused projects (any depth) whose latest health `week_of` is not
 * the given Chicago Sunday — used for the dashboard check-in nudge.
 */
export function countMissingWeekCheckIns(
	tree: ProjectNode[],
	latestHealth: Map<string, LatestHealth> | Record<string, LatestHealth>,
	weekOf: string
): number {
	const get = (id: string): LatestHealth | undefined =>
		latestHealth instanceof Map ? latestHealth.get(id) : latestHealth[id];

	let missing = 0;
	function walk(nodes: ProjectNode[]) {
		for (const n of nodes) {
			if (n.lifecycle_status === 'active' || n.lifecycle_status === 'paused') {
				const h = get(n.id);
				if (!h || h.week_of !== weekOf) missing++;
			}
			if (n.children.length) walk(n.children);
		}
	}
	walk(tree);
	return missing;
}

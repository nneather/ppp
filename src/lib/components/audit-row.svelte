<script lang="ts" module>
	export type AuditDiffEntry = {
		key: string;
		before: unknown;
		after: unknown;
	};

	const NOISE_KEYS = new Set<string>(['updated_at']);

	export function diffKeys(
		oldD: Record<string, unknown> | null,
		newD: Record<string, unknown> | null
	): AuditDiffEntry[] {
		const keys = new Set<string>([
			...Object.keys(oldD ?? {}),
			...Object.keys(newD ?? {})
		]);
		const out: AuditDiffEntry[] = [];
		for (const k of keys) {
			if (NOISE_KEYS.has(k)) continue;
			const before = oldD?.[k] ?? null;
			const after = newD?.[k] ?? null;
			if (JSON.stringify(before) === JSON.stringify(after)) continue;
			out.push({ key: k, before, after });
		}
		out.sort((a, b) => a.key.localeCompare(b.key));
		return out;
	}

	export function formatValue(v: unknown): string {
		if (v === null || v === undefined) return '∅';
		if (typeof v === 'string') return v;
		if (typeof v === 'number' || typeof v === 'boolean') return String(v);
		try {
			return JSON.stringify(v);
		} catch {
			return String(v);
		}
	}
</script>

<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { Badge, type BadgeVariant } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import type {
		AuditDisplayOperation,
		AuditLogRow
	} from '../../routes/settings/audit-log/+page.server';

	let {
		row,
		expanded = false,
		onToggle,
		onRevert
	}: {
		row: AuditLogRow;
		expanded?: boolean;
		onToggle: (id: string) => void;
		onRevert: (row: AuditLogRow) => void;
	} = $props();

	const diff = $derived(diffKeys(row.old_data, row.new_data));

	function badgeVariant(op: AuditDisplayOperation): BadgeVariant {
		if (op === 'INSERT') return 'secondary';
		if (op === 'DELETE' || op === 'SOFT_DELETE') return 'destructive';
		if (op === 'SOFT_RESTORE') return 'secondary';
		return 'default';
	}

	function operationLabel(op: AuditDisplayOperation): string {
		switch (op) {
			case 'SOFT_DELETE':
				return 'DELETE';
			case 'SOFT_RESTORE':
				return 'RESTORE';
			default:
				return op;
		}
	}

	function summaryText(op: AuditDisplayOperation, diffLen: number): string {
		switch (op) {
			case 'INSERT':
				return 'Created';
			case 'DELETE':
				return 'Hard deleted';
			case 'SOFT_DELETE':
				return 'Soft deleted';
			case 'SOFT_RESTORE':
				return 'Restored';
			default:
				return `${diffLen} field${diffLen === 1 ? '' : 's'}`;
		}
	}

	function relativeTime(iso: string): string {
		const then = new Date(iso).getTime();
		if (!Number.isFinite(then)) return '';
		const diffMs = Date.now() - then;
		const sec = Math.round(diffMs / 1000);
		if (sec < 60) return `${sec}s ago`;
		const min = Math.round(sec / 60);
		if (min < 60) return `${min}m ago`;
		const hr = Math.round(min / 60);
		if (hr < 24) return `${hr}h ago`;
		const d = Math.round(hr / 24);
		if (d < 30) return `${d}d ago`;
		const mo = Math.round(d / 30);
		if (mo < 12) return `${mo}mo ago`;
		const y = Math.round(d / 365);
		return `${y}y ago`;
	}

	const fullData = $derived(row.operation === 'INSERT' ? row.new_data : row.old_data);
</script>

<article class="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
	<header class="flex flex-wrap items-start justify-between gap-3">
		<div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
			<Badge variant={badgeVariant(row.displayOperation)} class="font-mono uppercase">
				{operationLabel(row.displayOperation)}
			</Badge>
			<span class="font-mono text-sm font-medium text-foreground">{row.table_name}</span>
			{#if row.entityLabel}
				<span class="truncate text-sm text-foreground" title={row.entityLabel}>
					— {row.entityLabel}
				</span>
			{/if}
			<span
				class="text-xs text-muted-foreground"
				title={new Date(row.changed_at).toLocaleString()}
			>
				{relativeTime(row.changed_at)}
			</span>
			<span class="text-xs text-muted-foreground">·</span>
			<span class="truncate text-xs text-muted-foreground" title={row.changed_by ?? 'system'}>
				{row.changed_by_label}
			</span>
		</div>
		<div class="flex shrink-0 items-center gap-1.5">
			{#if row.canRevert}
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="h-8 gap-1 px-2"
					onclick={() => onRevert(row)}
				>
					<Undo2 class="size-3.5" />
					{row.displayOperation === 'SOFT_DELETE'
						? 'Restore'
						: row.displayOperation === 'SOFT_RESTORE'
							? 'Re-delete'
							: 'Revert'}
				</Button>
			{/if}
			<Button
				type="button"
				variant="ghost"
				size="sm"
				class="h-8 gap-1 px-2 text-muted-foreground"
				onclick={() => onToggle(row.id)}
				aria-expanded={expanded}
				aria-controls={`audit-${row.id}-detail`}
			>
				<ChevronDown class={cn('size-4 transition-transform', expanded && 'rotate-180')} />
				{summaryText(row.displayOperation, diff.length)}
			</Button>
		</div>
	</header>

	<p class="mt-2 truncate font-mono text-[0.7rem] text-muted-foreground" title={row.record_id}>
		id {row.record_id}
	</p>

	{#if expanded}
		<div id={`audit-${row.id}-detail`} class="mt-3 border-t border-border pt-3">
			{#if row.operation === 'UPDATE'}
				{#if diff.length === 0}
					<p class="text-xs text-muted-foreground">
						No tracked field changes (only noise fields differ).
					</p>
				{:else}
					<table class="w-full table-fixed text-xs">
						<thead>
							<tr class="text-left text-muted-foreground">
								<th class="w-1/4 pb-1 font-medium">Field</th>
								<th class="w-3/8 pb-1 font-medium">Before</th>
								<th class="w-3/8 pb-1 font-medium">After</th>
							</tr>
						</thead>
						<tbody class="font-mono">
							{#each diff as entry (entry.key)}
								<tr class="align-top">
									<td class="py-1 pr-2 text-foreground">{entry.key}</td>
									<td class="py-1 pr-2 break-words text-muted-foreground">
										{formatValue(entry.before)}
									</td>
									<td class="py-1 break-words text-foreground">
										{formatValue(entry.after)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			{:else if fullData}
				<dl class="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-[8rem_1fr]">
					{#each Object.keys(fullData).sort() as k (k)}
						<dt class="font-mono text-muted-foreground">{k}</dt>
						<dd class="break-words font-mono text-foreground">{formatValue(fullData[k])}</dd>
					{/each}
				</dl>
			{:else}
				<p class="text-xs text-muted-foreground">No data captured.</p>
			{/if}
		</div>
	{/if}
</article>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import {
		LIFECYCLE_STATUSES,
		LIFECYCLE_STATUS_LABELS,
		HEALTH_STATUSES,
		HEALTH_STATUS_LABELS,
		DEFAULT_VISIBLE_LIFECYCLES,
		type LifecycleStatus,
		type HealthStatus
	} from '$lib/types/projects';
	import { HEALTH_DOT_CLASS } from '$lib/projects/health-appearance';
	import { cn } from '$lib/utils';

	let {
		domainNames
	}: {
		domainNames: string[];
	} = $props();

	function buildParams(mutator: (p: URLSearchParams) => void): string {
		const params = new URLSearchParams(page.url.searchParams);
		mutator(params);
		const q = params.toString();
		return `/projects${q ? `?${q}` : ''}`;
	}

	function navigate(mutator: (p: URLSearchParams) => void) {
		goto(buildParams(mutator), { keepFocus: true, noScroll: true, replaceState: false });
	}

	const activeLifecycles = $derived.by(() => {
		const raw = page.url.searchParams.get('lifecycle');
		if (!raw?.trim()) return new Set(DEFAULT_VISIBLE_LIFECYCLES);
		const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
		const out = new Set<LifecycleStatus>();
		for (const p of parts) {
			if ((LIFECYCLE_STATUSES as readonly string[]).includes(p)) {
				out.add(p as LifecycleStatus);
			}
		}
		return out.size > 0 ? out : new Set(DEFAULT_VISIBLE_LIFECYCLES);
	});

	const healthValue = $derived(page.url.searchParams.get('health')?.trim() || 'all');
	const domainValue = $derived(page.url.searchParams.get('domain')?.trim() || 'all');

	const healthLabel = $derived.by(() => {
		if (healthValue === 'all') return 'All health';
		if (healthValue === 'attention') return 'Needs attention';
		if ((HEALTH_STATUSES as readonly string[]).includes(healthValue)) {
			return HEALTH_STATUS_LABELS[healthValue as HealthStatus];
		}
		return 'All health';
	});

	const selectedHealthStatus = $derived.by((): HealthStatus | null => {
		if ((HEALTH_STATUSES as readonly string[]).includes(healthValue)) {
			return healthValue as HealthStatus;
		}
		return null;
	});

	function toggleLifecycle(status: LifecycleStatus) {
		navigate((p) => {
			const next = new Set(activeLifecycles);
			if (next.has(status)) next.delete(status);
			else next.add(status);
			if (next.size === 0) {
				p.delete('lifecycle');
			} else if (
				next.size === DEFAULT_VISIBLE_LIFECYCLES.size &&
				[...DEFAULT_VISIBLE_LIFECYCLES].every((s) => next.has(s))
			) {
				p.delete('lifecycle');
			} else {
				p.set('lifecycle', [...next].sort().join(','));
			}
		});
	}

	function setHealth(v: string) {
		navigate((p) => {
			if (v === 'all') p.delete('health');
			else p.set('health', v);
		});
	}

	function setDomain(v: string) {
		navigate((p) => {
			if (v === 'all') p.delete('domain');
			else p.set('domain', v);
		});
	}

	const optionalLifecycles = $derived(
		LIFECYCLE_STATUSES.filter((s) => !DEFAULT_VISIBLE_LIFECYCLES.has(s))
	);
</script>

<div class="mb-4 space-y-3 rounded-lg border border-border bg-muted/20 p-3 md:p-4">
	<div class="flex flex-wrap items-center gap-2">
		<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Lifecycle</span>
		{#each LIFECYCLE_STATUSES as status (status)}
			<Button
				type="button"
				variant={activeLifecycles.has(status) ? 'default' : 'outline'}
				size="sm"
				class={cn('h-7 text-xs', optionalLifecycles.includes(status) && !activeLifecycles.has(status) && 'opacity-70')}
				onclick={() => toggleLifecycle(status)}
			>
				{LIFECYCLE_STATUS_LABELS[status]}
			</Button>
		{/each}
	</div>

	<div class="flex flex-wrap gap-3">
		<div class="min-w-[10rem] flex-1 space-y-1">
			<label for="health-filter" class="text-xs font-medium text-muted-foreground">Health</label>
			<Select.Root
				type="single"
				value={healthValue}
				onValueChange={(v) => {
					if (v) setHealth(v);
				}}
			>
				<Select.Trigger id="health-filter" class="w-full">
					<span class="inline-flex items-center gap-2">
						{#if selectedHealthStatus}
							<span
								class={cn(
									'inline-block size-2 shrink-0 rounded-full',
									HEALTH_DOT_CLASS[selectedHealthStatus]
								)}
								aria-hidden="true"
							></span>
						{/if}
						{healthLabel}
					</span>
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all" label="All health">All health</Select.Item>
					<Select.Item value="attention" label="Needs attention">Needs attention</Select.Item>
					{#each HEALTH_STATUSES as st (st)}
						<Select.Item value={st} label={HEALTH_STATUS_LABELS[st]}>
							<span class="inline-flex items-center gap-2">
								<span
									class={cn('inline-block size-2 shrink-0 rounded-full', HEALTH_DOT_CLASS[st])}
									aria-hidden="true"
								></span>
								{HEALTH_STATUS_LABELS[st]}
							</span>
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<div class="min-w-[10rem] flex-1 space-y-1">
			<label for="domain-filter" class="text-xs font-medium text-muted-foreground">Domain</label>
			<Select.Root
				type="single"
				value={domainValue}
				onValueChange={(v) => {
					if (v) setDomain(v);
				}}
			>
				<Select.Trigger id="domain-filter" class="w-full">
					{domainValue === 'all' ? 'All domains' : domainValue}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all" label="All domains">All domains</Select.Item>
					{#each domainNames as name (name)}
						<Select.Item value={name} label={name}>{name}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</div>
</div>

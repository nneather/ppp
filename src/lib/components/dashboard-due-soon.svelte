<script lang="ts">
	import AssignmentRow from '$lib/components/assignment-row.svelte';
	import { formatYmdMediumChicago, ymdInChicago } from '$lib/invoicing/chicago-date';
	import type { DueSoonAssignment } from '$lib/types/classwork';

	let {
		assignments,
		isOwner = true
	}: {
		assignments: DueSoonAssignment[];
		isOwner?: boolean;
	} = $props();

	const todayYmd = ymdInChicago();

	function dueLabel(a: DueSoonAssignment): string {
		if (a.days_until < 0) {
			const n = Math.abs(a.days_until);
			return n === 1 ? '1d overdue' : `${n}d overdue`;
		}
		if (a.days_until === 0) return 'Due today';
		if (a.days_until === 1) return 'Due tomorrow';
		return `Due in ${a.days_until}d`;
	}

	const overdueCount = $derived(assignments.filter((a) => a.days_until < 0).length);
</script>

<section
	class="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
	aria-labelledby="classwork-due-soon-heading"
>
	<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
		<div class="min-w-0">
			<h2
				id="classwork-due-soon-heading"
				class="text-sm font-semibold tracking-tight text-foreground"
			>
				Due soon
			</h2>
			<p class="text-xs text-muted-foreground">
				Classwork · 14 days
				{#if overdueCount > 0}
					<span class="text-destructive"> · {overdueCount} overdue</span>
				{/if}
			</p>
		</div>
		<a
			href="/classwork"
			class="text-xs font-medium text-primary underline-offset-4 hover:underline"
		>
			Open classwork
		</a>
	</div>

	{#if assignments.length === 0}
		<p class="text-sm text-muted-foreground">
			Nothing due in the next 14 days.
			<a
				href="/classwork"
				class="font-medium text-primary underline-offset-4 hover:underline"
			>
				Add assignments
			</a>
		</p>
	{:else}
		<ul class="divide-y divide-border">
			{#each assignments as a (a.id)}
				<AssignmentRow
					assignment={a}
					variant="compact"
					actionPrefix="/classwork?"
					{todayYmd}
					{isOwner}
					formatDate={formatYmdMediumChicago}
					daysLabel={(row) => dueLabel(row as DueSoonAssignment)}
				/>
			{/each}
		</ul>
	{/if}
</section>

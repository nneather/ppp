<script lang="ts">
	import { formatYmdMediumChicago } from '$lib/invoicing/chicago-date';
	import {
		ASSIGNMENT_KIND_LABELS,
		type DueSoonAssignment
	} from '$lib/types/classwork';
	import { cn } from '$lib/utils';

	let {
		assignments
	}: {
		assignments: DueSoonAssignment[];
	} = $props();

	function dueLabel(days: number): string {
		if (days < 0) {
			const n = Math.abs(days);
			return n === 1 ? '1d overdue' : `${n}d overdue`;
		}
		if (days === 0) return 'Due today';
		if (days === 1) return 'Due tomorrow';
		return `Due in ${days}d`;
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
				<li class="py-2 first:pt-0 last:pb-0">
					<a
						href="/classwork?group=date"
						class="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<p
							class={cn(
								'text-xs font-medium tracking-wide uppercase',
								a.days_until < 0
									? 'text-destructive'
									: 'text-muted-foreground'
							)}
						>
							{dueLabel(a.days_until)}
							<span class="ml-1.5 normal-case tracking-normal">
								· {formatYmdMediumChicago(a.due_date)}
							</span>
						</p>
						<p class="mt-0.5 text-sm font-medium text-foreground">{a.title}</p>
						<p class="mt-0.5 text-xs text-muted-foreground">
							{a.course_code?.trim() || a.course_name}
							<span aria-hidden="true"> · </span>
							{ASSIGNMENT_KIND_LABELS[a.kind]}
						</p>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

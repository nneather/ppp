<script lang="ts">
	import { formatYmdMediumChicago } from '$lib/invoicing/chicago-date';
	import { formatEffectiveCadence } from '$lib/contacts/names';
	import type { ContactDueRow } from '$lib/types/contacts';
	import { cn } from '$lib/utils';

	let {
		contacts
	}: {
		contacts: ContactDueRow[];
	} = $props();

	function dueLabel(c: ContactDueRow): string {
		if (c.days_overdue == null) return 'Never logged';
		if (c.days_overdue === 0) return 'Due today';
		if (c.days_overdue === 1) return '1d overdue';
		return `${c.days_overdue}d overdue`;
	}

	const neverCount = $derived(contacts.filter((c) => c.days_overdue == null).length);
</script>

<section
	class="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
	aria-labelledby="contacts-due-heading"
>
	<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
		<div class="min-w-0">
			<h2
				id="contacts-due-heading"
				class="text-sm font-semibold tracking-tight text-foreground"
			>
				Due to meet
			</h2>
			<p class="text-xs text-muted-foreground">
				Contacts
				{#if neverCount > 0}
					<span> · {neverCount} never logged</span>
				{/if}
			</p>
		</div>
		<a
			href="/contacts"
			class="text-xs font-medium text-primary underline-offset-4 hover:underline"
		>
			Open contacts
		</a>
	</div>

	{#if contacts.length === 0}
		<p class="text-sm text-muted-foreground">
			Nobody is due right now.
			<a
				href="/contacts"
				class="font-medium text-primary underline-offset-4 hover:underline"
			>
				Log a meet
			</a>
		</p>
	{:else}
		<ul class="divide-y divide-border">
			{#each contacts as c (c.id)}
				<li class="py-2 first:pt-0 last:pb-0">
					<a
						href="/contacts"
						class="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<p
							class={cn(
								'text-xs font-medium tracking-wide uppercase',
								c.days_overdue == null || c.days_overdue > 0
									? 'text-destructive'
									: 'text-muted-foreground'
							)}
						>
							{dueLabel(c)}
							{#if c.last_touched_on}
								<span class="ml-1.5 normal-case tracking-normal">
									· last {formatYmdMediumChicago(c.last_touched_on)}
								</span>
							{/if}
						</p>
						<p class="mt-0.5 text-sm font-medium text-foreground">{c.display_name}</p>
						<p class="mt-0.5 text-xs text-muted-foreground">
							{formatEffectiveCadence(c.effective_cadence_days)}
							{#if c.household_name}
								<span aria-hidden="true"> · </span>
								{c.household_name}
							{/if}
						</p>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

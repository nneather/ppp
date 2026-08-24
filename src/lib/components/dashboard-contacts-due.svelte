<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { formatYmdMediumChicago } from '$lib/invoicing/chicago-date';
	import {
		CONTACT_FREQUENCY_LABELS,
		type ContactDueRow
	} from '$lib/types/contacts';
	import { cn } from '$lib/utils';

	let {
		contacts
	}: {
		contacts: ContactDueRow[];
	} = $props();

	function dueLabel(c: ContactDueRow): string {
		if (c.days_overdue != null && c.days_overdue > 0) {
			return c.days_overdue === 1 ? '1d overdue' : `${c.days_overdue}d overdue`;
		}
		if (c.days_overdue === 0 || c.days_left === 0) return 'Due today';
		if (c.days_left === 1) return '1d left';
		return `${c.days_left}d left`;
	}

	const overdueCount = $derived(
		contacts.filter((c) => c.days_overdue != null && c.days_overdue > 0).length
	);

	const dueEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				await invalidate('app:contacts:list');
			}
		};
	};
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
				{#if overdueCount > 0}
					<span class="text-destructive"> · {overdueCount} overdue</span>
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
					<p
						class={cn(
							'text-xs font-medium tracking-wide uppercase',
							c.days_overdue != null && c.days_overdue > 0
								? 'text-destructive'
								: 'text-muted-foreground'
						)}
					>
						{dueLabel(c)}
						<span class="ml-1.5 normal-case tracking-normal">
							· ends {formatYmdMediumChicago(c.period_end)}
						</span>
					</p>
					<p class="mt-0.5 text-sm font-medium text-foreground">{c.display_name}</p>
					<p class="mt-0.5 text-xs text-muted-foreground">
						{CONTACT_FREQUENCY_LABELS[c.frequency]}
						{#if c.household_name && c.household_name !== c.display_name}
							<span aria-hidden="true"> · </span>
							{c.household_name}
						{/if}
					</p>
					<div class="mt-1.5 flex flex-wrap gap-1.5">
						<form
							method="POST"
							action="/contacts?/logContactQuick"
							use:enhance={dueEnhance}
						>
							<input type="hidden" name="contact_id" value={c.contact_id} />
							{#if c.household_id}
								<input type="hidden" name="household_id" value={c.household_id} />
							{/if}
							<Button type="submit" size="sm" variant="secondary" label="Log Contact" />
						</form>
						<form
							method="POST"
							action="/contacts?/skipContactPeriod"
							use:enhance={dueEnhance}
						>
							<input type="hidden" name="contact_id" value={c.contact_id} />
							{#if c.household_id}
								<input type="hidden" name="household_id" value={c.household_id} />
							{/if}
							<Button type="submit" size="sm" variant="outline" label="Skip" />
						</form>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

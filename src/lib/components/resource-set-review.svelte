<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import {
		ruleChipLabel,
		type ResolvedMember,
		type ResourceSetRule
	} from '$lib/studies/resource-sets';

	let {
		setId,
		rules,
		included,
		excluded,
		isOwner
	}: {
		setId: string;
		rules: ResourceSetRule[];
		included: ResolvedMember[];
		excluded: ResolvedMember[];
		isOwner: boolean;
	} = $props();

	let showExcluded = $state(false);
</script>

{#snippet memberFields(member: ResolvedMember)}
	<input type="hidden" name="set_id" value={setId} />
	{#if member.bookId}<input type="hidden" name="book_id" value={member.bookId} />{/if}
	{#if member.essayId}<input type="hidden" name="essay_id" value={member.essayId} />{/if}
{/snippet}

{#if rules.length > 0}
	<ul class="mt-4 flex flex-wrap gap-1.5" aria-label="Rules">
		{#each rules as rule, i (`${rule.kind}-${rule.value}-${i}`)}
			<li class="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs">
				{ruleChipLabel(rule)}
			</li>
		{/each}
	</ul>
{:else}
	<p class="mt-4 text-xs text-muted-foreground">Static list — no rule. Members are includes only.</p>
{/if}

<div class="mt-4 flex items-center justify-between gap-3">
	<h2 class="text-sm font-medium">Included ({included.length})</h2>
	{#if isOwner}
		<form method="POST" action="?/markReviewed" use:enhance>
			<input type="hidden" name="set_id" value={setId} />
			<Button type="submit" size="sm" hotkey="s" label="Save review" />
		</form>
	{/if}
</div>

{#if included.length === 0}
	<p class="mt-2 text-sm text-muted-foreground">Nothing in this set yet.</p>
{:else}
	<ul class="mt-2 divide-y divide-border rounded-lg border border-border">
		{#each included as member (`${member.bookId ?? ''}:${member.essayId ?? ''}`)}
			<li class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
				<span class="min-w-0">
					<span class="font-medium">{member.title}</span>
					{#if member.isNew}
						<span class="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">New</span>
					{/if}
				</span>
				{#if isOwner}
					<form method="POST" action="?/removeMember" use:enhance>
						{@render memberFields(member)}
						<Button type="submit" variant="outline" size="sm">Remove</Button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<div class="mt-6">
	<button
		type="button"
		class="text-sm font-medium underline-offset-2 hover:underline"
		aria-expanded={showExcluded}
		onclick={() => (showExcluded = !showExcluded)}
	>
		Excluded ({excluded.length})
	</button>
	{#if showExcluded}
		{#if excluded.length === 0}
			<p class="mt-2 text-sm text-muted-foreground">Nothing excluded.</p>
		{:else}
			<ul class="mt-2 divide-y divide-border rounded-lg border border-border">
				{#each excluded as member (`x-${member.bookId ?? ''}:${member.essayId ?? ''}`)}
					<li class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
						<span class="min-w-0 font-medium">{member.title}</span>
						{#if isOwner}
							<form method="POST" action="?/restoreMember" use:enhance>
								{@render memberFields(member)}
								<Button type="submit" variant="outline" size="sm">Add back</Button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

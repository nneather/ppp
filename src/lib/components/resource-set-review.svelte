<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
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
		isOwner,
		addQuery = '',
		addHits = []
	}: {
		setId: string;
		rules: ResourceSetRule[];
		included: ResolvedMember[];
		excluded: ResolvedMember[];
		isOwner: boolean;
		addQuery?: string;
		addHits?: {
			id: string;
			title: string;
			authors: string | null;
			bookIds: string[];
			seriesAbbreviation: string | null;
			volumeCount: number;
			included: boolean;
		}[];
	} = $props();

	let showExcluded = $state(false);
</script>

{#snippet memberFields(member: ResolvedMember)}
	<input type="hidden" name="set_id" value={setId} />
	{#if member.essayId}<input type="hidden" name="essay_id" value={member.essayId} />{/if}
	{#each member.volumeBookIds as id (id)}
		<input type="hidden" name="book_id" value={id} />
	{/each}
{/snippet}

{#snippet memberMeta(member: ResolvedMember)}
	{#if member.authors || member.volumeCount > 1}
		<span class="mt-0.5 block text-xs text-muted-foreground">
			{member.authors}{#if member.authors && member.volumeCount > 1}{' · '}{/if}{#if member.volumeCount > 1}{member.seriesAbbreviation
				? `${member.seriesAbbreviation} · `
				: ''}{member.volumeCount} vols.{/if}
		</span>
	{/if}
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

{#if isOwner}
	<form method="GET" class="mt-4">
		<label class="text-sm font-medium" for="add-book">Add a book</label>
		<p class="mt-1 text-xs text-muted-foreground">
			Search by title or abbreviation. A multi-volume set is added together.
		</p>
		<div class="mt-2 flex items-center gap-2">
			<Input
				id="add-book"
				name="q"
				value={addQuery}
				placeholder="Title or abbreviation"
				aria-label="Title or abbreviation"
			/>
			<Button type="submit" size="sm" variant="outline">Search</Button>
		</div>
	</form>
	{#if addQuery.trim()}
		{#if addHits.length === 0}
			<p class="mt-2 text-sm text-muted-foreground">No titles match.</p>
		{:else}
			<ul class="mt-2 divide-y divide-border rounded-lg border border-border">
				{#each addHits as hit (hit.id)}
					<li class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
						<span class="min-w-0">
							<span class="font-medium">{hit.title}</span>
							{#if hit.authors || hit.volumeCount > 1}
								<span class="mt-0.5 block text-xs text-muted-foreground">
									{hit.authors}{#if hit.authors && hit.volumeCount > 1}{' · '}{/if}{#if hit.volumeCount > 1}{hit.seriesAbbreviation
										? `${hit.seriesAbbreviation} · `
										: ''}{hit.volumeCount} vols.{/if}
								</span>
							{/if}
						</span>
						{#if hit.included}
							<span class="shrink-0 text-xs text-muted-foreground">In set</span>
						{:else}
							<form method="POST" action="?/addMember" use:enhance>
								<input type="hidden" name="set_id" value={setId} />
								{#each hit.bookIds as id (id)}
									<input type="hidden" name="book_id" value={id} />
								{/each}
								<Button type="submit" variant="outline" size="sm">Add</Button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
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
			<li class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
				<span class="min-w-0">
					<span>
						<span class="font-medium">{member.title}</span>
						{#if !member.bibliographical}
							<span class="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Reference</span>
						{/if}
						{#if member.isNew}
							<span class="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">New</span>
						{/if}
					</span>
					{@render memberMeta(member)}
				</span>
				{#if isOwner}
					<span class="flex shrink-0 items-center gap-2">
						<form method="POST" action="?/setBibliographical" use:enhance>
							{@render memberFields(member)}
							<input type="hidden" name="bibliographical" value={member.bibliographical ? 'false' : 'true'} />
							<Button type="submit" variant="outline" size="sm">
								{member.bibliographical ? 'Reference only' : 'For bibliography'}
							</Button>
						</form>
						<form method="POST" action="?/removeMember" use:enhance>
							{@render memberFields(member)}
							<Button type="submit" variant="outline" size="sm">Remove</Button>
						</form>
					</span>
				{/if}
			</li>
		{/each}
	</ul>
	{#if included.some((member) => !member.bibliographical)}
		<p class="mt-2 text-xs text-muted-foreground">
			Reference items stay in the set and stay out of import and the bibliography.
		</p>
	{/if}
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
						<span class="min-w-0">
							<span class="font-medium">{member.title}</span>
							{@render memberMeta(member)}
						</span>
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

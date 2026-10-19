<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		ruleChipLabel,
		type ResolvedMember,
		type ResourceSetRule,
		type SetMemberAuthor
	} from '$lib/studies/resource-sets';

	type MoveTarget = { id: string; name: string; sectionName: string | null };

	const linkClass =
		'underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

	let {
		setId,
		rules,
		included,
		excluded,
		isOwner,
		addQuery = '',
		addHits = [],
		moveTargets = []
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
			authorLinks: SetMemberAuthor[];
			bookIds: string[];
			seriesAbbreviation: string | null;
			volumeCount: number;
			included: boolean;
			href: string;
		}[];
		moveTargets?: MoveTarget[];
	} = $props();

	let showNotIncluded = $state(false);
	let selected = $state(new Set<string>());
	let pendingKeys = $state(new Set<string>());
	let moveTargetId = $state('');
	let busy = $state(false);

	function memberKey(member: ResolvedMember): string {
		return `${member.bookId ?? ''}:${member.essayId ?? ''}`;
	}

	function toggle(key: string, on: boolean) {
		const next = new Set(selected);
		if (on) next.add(key);
		else next.delete(key);
		selected = next;
	}

	function clearSelected() {
		selected = new Set();
		moveTargetId = '';
	}

	function markPending(keys: string[]) {
		pendingKeys = new Set([...pendingKeys, ...keys]);
		busy = true;
	}

	function selectedMembers(pool: ResolvedMember[]): ResolvedMember[] {
		return pool.filter((member) => selected.has(memberKey(member)));
	}

	function displayLabel(member: ResolvedMember): string {
		return member.seriesAbbreviation?.trim() || member.title;
	}

	function tooltip(member: ResolvedMember): string {
		const parts = [member.title];
		if (member.authors) parts.push(member.authors);
		if (member.volumeCount > 1) {
			parts.push(
				`${member.seriesAbbreviation ? `${member.seriesAbbreviation} · ` : ''}${member.volumeCount} vols.`
			);
		}
		return parts.join(' — ');
	}

	function enhancePending(keys: string[]) {
		return () => {
			markPending(keys);
			return async ({ update }: { update: () => Promise<void> }) => {
				await update();
				pendingKeys = new Set([...pendingKeys].filter((k) => !keys.includes(k)));
				selected = new Set([...selected].filter((k) => !keys.includes(k)));
				busy = false;
			};
		};
	}

	const visibleIncluded = $derived(included.filter((m) => !pendingKeys.has(memberKey(m))));
	const visibleExcluded = $derived(excluded.filter((m) => !pendingKeys.has(memberKey(m))));
	const selectedCount = $derived(selected.size);
</script>

{#snippet memberFields(member: ResolvedMember)}
	<input type="hidden" name="set_id" value={setId} />
	{#if member.essayId}<input type="hidden" name="essay_id" value={member.essayId} />{/if}
	{#each member.volumeBookIds as id (id)}
		<input type="hidden" name="book_id" value={id} />
	{/each}
{/snippet}

{#snippet authorLine(authors: SetMemberAuthor[], trailing: string | null)}
	{#if authors.length > 0 || trailing}
		<span class="mt-0.5 block truncate text-xs text-muted-foreground">
			{#each authors as author, i (author.personId)}
				{#if i > 0}, {/if}<a
					href={`/library?author_id=${encodeURIComponent(author.personId)}`}
					class="{linkClass} hover:text-foreground"
				>{author.label}</a>
			{/each}{#if authors.length > 0 && trailing}{' · '}{/if}{#if trailing}{trailing}{/if}
		</span>
	{/if}
{/snippet}

{#snippet memberMeta(member: ResolvedMember)}
	{@const vol =
		member.volumeCount > 1 && !member.seriesAbbreviation ? `${member.volumeCount} vols.` : null}
	{#if member.authorLinks.length > 0}
		{@render authorLine(member.authorLinks, vol)}
	{:else if member.authors || vol}
		<span class="mt-0.5 block truncate text-xs text-muted-foreground">
			{member.authors}{#if member.authors && vol}{' · '}{/if}{#if vol}{vol}{/if}
		</span>
	{/if}
{/snippet}

{#snippet titleLabel(href: string | null, label: string, className: string)}
	{#if href}
		<a {href} class="{className} {linkClass} hover:text-foreground">{label}</a>
	{:else}
		<span class={className}>{label}</span>
	{/if}
{/snippet}

{#snippet memberRow(member: ResolvedMember, list: 'included' | 'excluded')}
	{@const key = memberKey(member)}
	<li class="flex items-center gap-2 px-3 py-2 text-sm">
		{#if isOwner}
			<input
				type="checkbox"
				class="size-4 shrink-0"
				checked={selected.has(key)}
				disabled={busy}
				aria-label={`Select ${displayLabel(member)}`}
				onchange={(e) => toggle(key, e.currentTarget.checked)}
			/>
		{/if}
		<span class="min-w-0 flex-1 overflow-hidden" title={tooltip(member)}>
			<span class="flex min-w-0 items-baseline gap-2">
				{@render titleLabel(member.href, displayLabel(member), 'shrink-0 font-medium')}
				{#if member.seriesAbbreviation}
					{@render titleLabel(member.href, member.title, 'min-w-0 truncate text-xs text-muted-foreground')}
				{/if}
				{#if member.volumeCount > 1 && member.seriesAbbreviation}
					<span class="shrink-0 text-[10px] text-muted-foreground">{member.volumeCount} vols.</span>
				{/if}
				{#if !member.bibliographical && list === 'included'}
					<span class="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Reference</span>
				{/if}
				{#if member.isNew}
					<span class="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">New</span>
				{/if}
			</span>
			{@render memberMeta(member)}
		</span>
		{#if isOwner}
			<span class="flex shrink-0 items-center gap-1">
				{#if list === 'included'}
					<form method="POST" action="?/setBibliographical" use:enhance={enhancePending([key])}>
						{@render memberFields(member)}
						<input type="hidden" name="bibliographical" value={member.bibliographical ? 'false' : 'true'} />
						<Button type="submit" variant="outline" size="xs" disabled={busy}>
							{member.bibliographical ? 'Reference only' : 'For bibliography'}
						</Button>
					</form>
					<form method="POST" action="?/excludeMember" use:enhance={enhancePending([key])}>
						{@render memberFields(member)}
						<Button type="submit" variant="outline" size="xs" disabled={busy}>Not included</Button>
					</form>
				{:else}
					<form method="POST" action="?/restoreMember" use:enhance={enhancePending([key])}>
						{@render memberFields(member)}
						<Button type="submit" variant="outline" size="xs" disabled={busy}>Include</Button>
					</form>
				{/if}
				<form method="POST" action="?/removeMember" use:enhance={enhancePending([key])}>
					{@render memberFields(member)}
					<Button type="submit" variant="outline" size="xs" class="text-destructive" disabled={busy}>Remove</Button>
				</form>
			</span>
		{/if}
	</li>
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
						<span class="min-w-0 overflow-hidden" title={hit.title}>
							{@render titleLabel(
								hit.href,
								hit.seriesAbbreviation?.trim() || hit.title,
								'font-medium'
							)}
							{#if hit.seriesAbbreviation}
								{@render titleLabel(hit.href, hit.title, 'mt-0.5 block truncate text-xs text-muted-foreground')}
							{/if}
							{#if hit.authorLinks.length > 0}
								{@render authorLine(
									hit.authorLinks,
									hit.volumeCount > 1 ? `${hit.volumeCount} vols.` : null
								)}
							{:else if hit.authors || hit.volumeCount > 1}
								<span class="mt-0.5 block truncate text-xs text-muted-foreground">
									{hit.authors}{#if hit.authors && hit.volumeCount > 1}{' · '}{/if}{#if hit.volumeCount > 1}{hit.volumeCount} vols.{/if}
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
								<Button type="submit" variant="outline" size="xs">Add</Button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
{/if}

{#if isOwner && selectedCount > 0}
	<div
		class="sticky top-0 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur"
	>
		<span class="text-sm font-medium">{selectedCount} selected</span>
		<form
			method="POST"
			action="?/moveMembers"
			class="flex items-center gap-2"
			use:enhance={enhancePending([...selected])}
		>
			<input type="hidden" name="set_id" value={setId} />
			{#each [...selectedMembers(included), ...selectedMembers(excluded)] as member (memberKey(member))}
				{@render memberFields(member)}
			{/each}
			<select
				name="target_set_id"
				class="h-6 rounded-md border border-input bg-background px-2 text-xs"
				bind:value={moveTargetId}
				required
				aria-label="Move to set"
			>
				<option value="" disabled>Move to…</option>
				{#each moveTargets as target (target.id)}
					<option value={target.id}>
						{target.sectionName ? `${target.sectionName}: ` : ''}{target.name}
					</option>
				{/each}
			</select>
			<Button type="submit" size="xs" disabled={busy || !moveTargetId}>Move</Button>
		</form>
		<form method="POST" action="?/restoreMember" use:enhance={enhancePending([...selected])}>
			<input type="hidden" name="set_id" value={setId} />
			{#each [...selectedMembers(included), ...selectedMembers(excluded)] as member (memberKey(member))}
				{@render memberFields(member)}
			{/each}
			<Button type="submit" variant="outline" size="xs" disabled={busy}>Include</Button>
		</form>
		<form method="POST" action="?/excludeMember" use:enhance={enhancePending([...selected])}>
			<input type="hidden" name="set_id" value={setId} />
			{#each [...selectedMembers(included), ...selectedMembers(excluded)] as member (memberKey(member))}
				{@render memberFields(member)}
			{/each}
			<Button type="submit" variant="outline" size="xs" disabled={busy}>Not included</Button>
		</form>
		<form method="POST" action="?/removeMember" use:enhance={enhancePending([...selected])}>
			<input type="hidden" name="set_id" value={setId} />
			{#each [...selectedMembers(included), ...selectedMembers(excluded)] as member (memberKey(member))}
				{@render memberFields(member)}
			{/each}
			<Button type="submit" variant="outline" size="xs" class="text-destructive" disabled={busy}>Remove</Button>
		</form>
		<button type="button" class="text-xs text-muted-foreground underline-offset-2 hover:underline" onclick={clearSelected}>
			Clear
		</button>
	</div>
{/if}

<div class="mt-4 flex items-center justify-between gap-3">
	<h2 class="text-sm font-medium">Included ({visibleIncluded.length})</h2>
</div>

{#if visibleIncluded.length === 0}
	<p class="mt-2 text-sm text-muted-foreground">Nothing in this set yet.</p>
{:else}
	<ul class="mt-2 divide-y divide-border rounded-lg border border-border">
		{#each visibleIncluded as member (memberKey(member))}
			{@render memberRow(member, 'included')}
		{/each}
	</ul>
	{#if visibleIncluded.some((member) => !member.bibliographical)}
		<p class="mt-2 text-xs text-muted-foreground">
			Reference items stay in the set and stay out of import and the bibliography.
		</p>
	{/if}
{/if}

<div class="mt-6">
	<button
		type="button"
		class="text-sm font-medium underline-offset-2 hover:underline"
		aria-expanded={showNotIncluded}
		onclick={() => (showNotIncluded = !showNotIncluded)}
	>
		Not included ({visibleExcluded.length})
	</button>
	<p class="mt-1 text-xs text-muted-foreground">
		Parked here — still listed. Remove hides a book from this set altogether.
	</p>
	{#if showNotIncluded}
		{#if visibleExcluded.length === 0}
			<p class="mt-2 text-sm text-muted-foreground">Nothing parked.</p>
		{:else}
			<ul class="mt-2 divide-y divide-border rounded-lg border border-border">
				{#each visibleExcluded as member (`x-${memberKey(member)}`)}
					{@render memberRow(member, 'excluded')}
				{/each}
			</ul>
		{/if}
	{/if}
</div>

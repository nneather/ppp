<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		filterResourceSetItems,
		resourceSetListLabel,
		testamentOfBibleBook,
		type ResourceSetListItem,
		type ResourceSetSectionGroup
	} from '$lib/studies/resource-sets';
	import { GENRES } from '$lib/types/library';
	import { cn } from '$lib/utils';

	type FormState = {
		kind?: string;
		message?: string;
		sectionId?: string;
		success?: boolean;
	} | null;

	let {
		sections,
		isOwner,
		form = null
	}: {
		sections: ResourceSetSectionGroup[];
		isOwner: boolean;
		form?: FormState;
	} = $props();

	const STORAGE_KEY = 'studies.sets.collapsed';

	let query = $state('');
	let addingSetFor = $state<string | null>(null);
	let addingSection = $state(false);
	/** Null until the saved collapse set is read. Defaults treat Bible books as closed. */
	let collapsedSectionIds = $state<Set<string> | null>(null);
	let collapsedTestaments = $state<Set<'ot' | 'nt'> | null>(null);

	$effect(() => {
		if (!browser) return;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw) as { sections?: unknown; testaments?: unknown };
			const sectionIds = Array.isArray(parsed.sections)
				? parsed.sections.filter((id): id is string => typeof id === 'string')
				: [];
			const testaments = new Set<'ot' | 'nt'>();
			if (Array.isArray(parsed.testaments)) {
				for (const t of parsed.testaments) {
					if (t === 'ot' || t === 'nt') testaments.add(t);
				}
			}
			collapsedSectionIds = new Set(sectionIds);
			collapsedTestaments = testaments;
		} catch {
			/* keep the defaults */
		}
	});

	$effect(() => {
		if (form?.kind === 'createSet' && form.sectionId && !form.success) {
			addingSetFor = form.sectionId;
			addingSection = false;
		} else if (form?.kind === 'createSection' && !form.success && form.message) {
			addingSection = true;
			addingSetFor = null;
		}
	});

	function persist(sectionsClosed: Set<string>, testamentsClosed: Set<'ot' | 'nt'>) {
		if (!browser) return;
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				sections: [...sectionsClosed],
				testaments: [...testamentsClosed]
			})
		);
	}

	function closedSections(): Set<string> {
		if (collapsedSectionIds) return new Set(collapsedSectionIds);
		const bible = sections.find((s) => s.slug === 'bible-books');
		return new Set(bible ? [bible.id] : []);
	}

	function closedTestaments(): Set<'ot' | 'nt'> {
		return new Set(collapsedTestaments ?? ['ot', 'nt']);
	}

	function sectionIsOpen(section: ResourceSetSectionGroup): boolean {
		if (query.trim()) return true;
		return !closedSections().has(section.id);
	}

	function testamentIsOpen(which: 'ot' | 'nt'): boolean {
		if (query.trim()) return true;
		return !closedTestaments().has(which);
	}

	function toggleSection(section: ResourceSetSectionGroup) {
		const next = closedSections();
		if (next.has(section.id)) next.delete(section.id);
		else next.add(section.id);
		collapsedSectionIds = next;
		persist(next, closedTestaments());
	}

	function toggleTestament(which: 'ot' | 'nt') {
		const next = closedTestaments();
		if (next.has(which)) next.delete(which);
		else next.add(which);
		collapsedTestaments = next;
		persist(closedSections(), next);
	}

	function openSetForm(sectionId: string) {
		addingSection = false;
		addingSetFor = addingSetFor === sectionId ? null : sectionId;
		const next = closedSections();
		next.delete(sectionId);
		collapsedSectionIds = next;
		persist(next, closedTestaments());
	}

	function openSectionForm() {
		addingSetFor = null;
		addingSection = !addingSection;
	}

	const onSaved: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update();
			if (result.type === 'success') {
				addingSetFor = null;
				addingSection = false;
			}
		};
	};

	function visibleItems(section: ResourceSetSectionGroup): ResourceSetListItem[] {
		return filterResourceSetItems(section.items, query);
	}

	function countLabel(section: ResourceSetSectionGroup, items: ResourceSetListItem[]): string {
		const noun =
			section.slug === 'bible-books'
				? items.length === 1
					? 'book'
					: 'books'
				: items.length === 1
					? 'set'
					: 'sets';
		const fresh = items.reduce((n, item) => n + item.newCount, 0);
		const base = `${items.length} ${noun}`;
		return fresh > 0 ? `${base} · ${fresh} new` : base;
	}

	function splitCanon(items: ResourceSetListItem[]) {
		const ot: ResourceSetListItem[] = [];
		const nt: ResourceSetListItem[] = [];
		const other: ResourceSetListItem[] = [];
		for (const item of items) {
			const testament = testamentOfBibleBook(item.bibleBook);
			if (testament === 'ot') ot.push(item);
			else if (testament === 'nt') nt.push(item);
			else other.push(item);
		}
		return { ot, nt, other };
	}

	const anyMatch = $derived(sections.some((section) => visibleItems(section).length > 0));
</script>

{#snippet row(item: ResourceSetListItem)}
	<li>
		<a
			class="flex items-baseline justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/50"
			href={`/studies/sets/${item.id}`}
		>
			<span class="min-w-0 truncate font-medium">{resourceSetListLabel(item)}</span>
			<span class="shrink-0 text-xs text-muted-foreground">
				{item.memberCount}
				{#if item.newCount > 0}
					<span class="ml-1 text-primary">{item.newCount} new</span>
				{/if}
			</span>
		</a>
	</li>
{/snippet}

{#snippet itemList(items: ResourceSetListItem[])}
	{#if items.length === 0}
		<p class="mt-2 text-sm text-muted-foreground">None yet.</p>
	{:else}
		<ul class="mt-2 divide-y divide-border rounded-lg border border-border">
			{#each items as item (item.id)}
				{@render row(item)}
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet testamentBlock(which: 'ot' | 'nt', label: string, items: ResourceSetListItem[])}
	{#if items.length > 0}
		<div class="mt-3">
			<button
				type="button"
				class="flex w-full items-center gap-2 text-left text-sm"
				aria-expanded={testamentIsOpen(which)}
				onclick={() => toggleTestament(which)}
			>
				<ChevronRight class={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', testamentIsOpen(which) && 'rotate-90')} />
				<span class="font-medium">{label}</span>
				<span class="text-xs text-muted-foreground">{items.length}</span>
			</button>
			{#if testamentIsOpen(which)}
				{@render itemList(items)}
			{/if}
		</div>
	{/if}
{/snippet}

<Input
	bind:value={query}
	placeholder="Filter sets"
	aria-label="Filter sets"
	class="mt-4"
/>

{#if query.trim() && !anyMatch}
	<p class="mt-4 text-sm text-muted-foreground">No sets match.</p>
{/if}

{#each sections as section (section.id)}
	{@const items = visibleItems(section)}
	{#if !query.trim() || items.length > 0 || addingSetFor === section.id}
		<section class="mt-6">
			<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
				<button
					type="button"
					class="flex min-w-0 items-center gap-2 text-left"
					aria-expanded={sectionIsOpen(section)}
					onclick={() => toggleSection(section)}
				>
					<ChevronRight
						class={cn('size-4 shrink-0 text-muted-foreground transition-transform', sectionIsOpen(section) && 'rotate-90')}
					/>
					<span class="text-sm font-medium">{section.name}</span>
					<span class="text-xs text-muted-foreground">{countLabel(section, query.trim() ? items : section.items)}</span>
				</button>
				{#if isOwner && !section.locked}
					<div class="ml-auto flex items-center gap-3">
						<button
							type="button"
							class="text-xs font-medium text-primary underline-offset-2 hover:underline"
							onclick={() => openSetForm(section.id)}
						>
							New set
						</button>
						<button
							type="button"
							class="text-xs font-medium text-primary underline-offset-2 hover:underline"
							onclick={openSectionForm}
						>
							New section
						</button>
					</div>
				{/if}
			</div>

			{#if sectionIsOpen(section)}
				{#if addingSetFor === section.id}
					<form method="POST" action="?/createSet" use:enhance={onSaved} class="mt-3 space-y-3 rounded-lg border border-border p-3">
						<input type="hidden" name="section_id" value={section.id} />
						<div>
							<Label for={`set-name-${section.id}`} class="text-xs uppercase tracking-wide text-muted-foreground">Name</Label>
							<Input
								id={`set-name-${section.id}`}
								name="name"
								required
								maxlength={80}
								placeholder={section.setKind === 'language' ? 'Latin language tools' : 'Set name'}
								class="mt-1"
							/>
						</div>
						<div>
							<Label for={`set-genre-${section.id}`} class="text-xs uppercase tracking-wide text-muted-foreground">Genre rule</Label>
							<select
								id={`set-genre-${section.id}`}
								name="genre"
								class="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
							>
								<option value="">No rule — add books on the set page</option>
								{#each GENRES as genre (genre)}
									<option value={genre}>{genre}</option>
								{/each}
							</select>
						</div>
						{#if form?.kind === 'createSet' && form.sectionId === section.id && form.message}
							<p class="text-sm text-destructive" role="alert">{form.message}</p>
						{/if}
						<div class="flex gap-2">
							<Button type="submit" size="sm" hotkey="s" label="Save set" />
							<Button type="button" size="sm" variant="outline" hotkey="Escape" label="Cancel" onclick={() => (addingSetFor = null)} />
						</div>
					</form>
				{/if}

				{#if section.slug === 'bible-books'}
					{@const canon = splitCanon(items)}
					{@render testamentBlock('ot', 'Old Testament', canon.ot)}
					{@render testamentBlock('nt', 'New Testament', canon.nt)}
					{#if canon.other.length > 0}
						{@render itemList(canon.other)}
					{/if}
				{:else}
					{@render itemList(items)}
				{/if}
			{/if}
		</section>
	{/if}
{/each}

{#if isOwner && addingSection}
	<form method="POST" action="?/createSection" use:enhance={onSaved} class="mt-6 space-y-3 rounded-lg border border-border p-3">
		<div>
			<Label for="section-name" class="text-xs uppercase tracking-wide text-muted-foreground">New section</Label>
			<Input id="section-name" name="name" required maxlength={80} placeholder="Section name" class="mt-1" />
		</div>
		{#if form?.kind === 'createSection' && form.message}
			<p class="text-sm text-destructive" role="alert">{form.message}</p>
		{/if}
		<div class="flex gap-2">
			<Button type="submit" size="sm" hotkey="s" label="Save section" />
			<Button type="button" size="sm" variant="outline" hotkey="Escape" label="Cancel" onclick={() => (addingSection = false)} />
		</div>
	</form>
{/if}

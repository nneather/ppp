<script lang="ts">
	import PageHeader from '$lib/components/page-header.svelte';
	import { paperDisplayLead } from '$lib/studies/paper-display';
	import { PAPER_STATUS_LABELS } from '$lib/types/classwork';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function formatDate(ymd: string): string {
		const [y, m, d] = ymd.split('-').map((x) => Number.parseInt(x, 10));
		if (!y || !m || !d) return ymd;
		return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
			timeZone: 'UTC',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function sermonLead(sermon: (typeof data.sermons)[number]): { lead: string; detail: string | null } {
		const passage = sermon.passage_display?.trim() ?? '';
		const topic = sermon.topic?.trim() ?? '';
		if (passage && topic && passage.toLowerCase() !== topic.toLowerCase()) {
			return { lead: passage, detail: topic };
		}
		return { lead: passage || topic || 'Untitled', detail: null };
	}
</script>

<svelte:head>
	<title>Studies — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 pb-tabbar md:px-6 md:py-8">
	<PageHeader title="Studies" subtitle="Papers in progress, and sermons dated from today forward." />

	{#if data.loadError}
		<p class="mt-4 text-sm text-destructive" role="alert">{data.loadError}</p>
	{/if}

	<section class="mt-6">
		<div class="flex items-baseline justify-between gap-3">
			<h2 class="text-sm font-medium">Active papers</h2>
			<a class="text-xs text-muted-foreground underline-offset-2 hover:underline" href="/studies/papers">
				All papers
			</a>
		</div>
		{#if data.papers.length === 0}
			<p class="mt-2 text-sm text-muted-foreground">No papers in progress.</p>
		{:else}
			<ul class="mt-2 divide-y divide-border rounded-lg border border-border">
				{#each data.papers as paper (paper.id)}
					{@const lead = paperDisplayLead(paper)}
					{@const due = paper.assignment_due_date ?? paper.due_date}
					<li>
						<a
							class="block px-3 py-2.5 text-sm hover:bg-muted/50"
							href={`/studies/papers/${paper.id}`}
						>
							<p class="font-medium break-words">{lead.lead}</p>
							{#if lead.detail}
								<p class="text-xs text-muted-foreground">{lead.detail}</p>
							{/if}
							<p class="mt-0.5 flex flex-wrap gap-x-1.5 text-xs text-muted-foreground">
								<span>{PAPER_STATUS_LABELS[paper.status]}</span>
								{#if paper.course_code || paper.course_name}
									<span aria-hidden="true">·</span>
									<span>{paper.course_code ?? paper.course_name}</span>
								{/if}
								{#if due}
									<span aria-hidden="true">·</span>
									<span>Due {formatDate(due)}</span>
								{/if}
								<span aria-hidden="true">·</span>
								<span>{paper.sourceCount} source{paper.sourceCount === 1 ? '' : 's'}</span>
							</p>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="mt-8">
		<div class="flex items-baseline justify-between gap-3">
			<h2 class="text-sm font-medium">Upcoming sermons</h2>
			<a
				class="text-xs text-muted-foreground underline-offset-2 hover:underline"
				href="/studies/sermons"
			>
				All sermons
			</a>
		</div>
		{#if data.sermons.length === 0}
			<p class="mt-2 text-sm text-muted-foreground">Nothing dated from today forward.</p>
		{:else}
			<ul class="mt-2 divide-y divide-border rounded-lg border border-border">
				{#each data.sermons as sermon (sermon.id)}
					{@const lead = sermonLead(sermon)}
					<li>
						<a
							class="block px-3 py-2.5 text-sm hover:bg-muted/50"
							href={`/studies/sermons/${sermon.id}`}
						>
							<p class="font-medium break-words">{lead.lead}</p>
							{#if lead.detail}
								<p class="text-xs text-muted-foreground">{lead.detail}</p>
							{/if}
							<p class="mt-0.5 text-xs text-muted-foreground">
								{formatDate(sermon.preached_on)}{sermon.venue_name ? ` · ${sermon.venue_name}` : ''}
							</p>
							{#if sermon.venue_logistics}
								<p class="text-xs text-muted-foreground">{sermon.venue_logistics}</p>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

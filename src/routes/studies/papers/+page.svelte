<script lang="ts">
	import { invalidate } from '$app/navigation';
	import PageHeader from '$lib/components/page-header.svelte';
	import PaperFormSheet from '$lib/components/paper-form-sheet.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import { paperDisplayLead } from '$lib/studies/paper-display';
	import { PAPER_STATUS_LABELS, type PaperListRow, type PaperStatus } from '$lib/types/classwork';
	import { cn } from '$lib/utils';
	import FileText from '@lucide/svelte/icons/file-text';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type FormShape = {
		kind?: string;
		message?: string;
		success?: boolean;
		paperId?: string;
	};
	const f = $derived((form ?? null) as FormShape | null);

	let sheetOpen = $state(false);
	let sheetMode = $state<'create' | 'edit'>('create');
	let editingPaper = $state<PaperListRow | null>(null);

	const sheetError = $derived.by(() => {
		if (!f || f.success === true) return null;
		if (f.kind === 'createPaper' || f.kind === 'updatePaper') return f.message ?? null;
		return null;
	});

	function openCreate() {
		sheetMode = 'create';
		editingPaper = null;
		sheetOpen = true;
	}

	function openEdit(p: PaperListRow) {
		sheetMode = 'edit';
		editingPaper = p;
		sheetOpen = true;
	}

	async function onSaved() {
		await invalidate('app:classwork:papers');
	}

	function effectiveDue(p: PaperListRow): string | null {
		return p.assignment_due_date ?? p.due_date;
	}

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

	const statusBadgeClass: Record<PaperStatus, string> = {
		researching: 'bg-muted text-muted-foreground',
		drafting: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
		submitted: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
		published: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
		archived: 'bg-muted text-muted-foreground'
	};
</script>

<svelte:head>
	<title>Research papers — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 pb-tabbar">
	<PageHeader
		title="Research papers"
		subtitle={data.show === 'archived'
			? 'Completed papers stay out of the active list.'
			: 'Paper-scoped bibliography and citations. Deadlines still live on assignments.'}
	>
		{#snippet actions()}
			{#if data.isOwner && data.show !== 'archived'}
				<Button type="button" class="gap-2" hotkey="b" onclick={openCreate}>
					<Plus class="size-4" />
					<HotkeyLabel label="New paper" mnemonic="b" />
				</Button>
			{/if}
		{/snippet}
	</PageHeader>

	<p class="mt-4 text-sm">
		{#if data.show === 'archived'}
			<a href="/studies/papers" class="text-muted-foreground underline-offset-2 hover:underline">Active papers</a>
		{:else}
			<a href="/studies/papers?show=archived" class="text-muted-foreground underline-offset-2 hover:underline">Complete</a>
		{/if}
	</p>

	{#if data.loadError}
		<p class="mt-4 text-sm text-destructive" role="alert">{data.loadError}</p>
	{/if}

	{#if f && f.success !== true && f.kind === 'openResearchPaper'}
		<p class="mt-4 text-sm text-destructive" role="alert">{f.message}</p>
	{/if}

	{#if data.papers.length === 0}
		<div class="mt-8 rounded-lg border border-dashed border-border px-4 py-10 text-center">
			<FileText class="mx-auto size-8 text-muted-foreground" />
			<p class="mt-3 text-sm font-medium">
				{data.show === 'archived' ? 'No completed papers' : 'No research papers yet'}
			</p>
			{#if data.show !== 'archived'}
			<p class="mt-1 text-sm text-muted-foreground">
				Create one here, or open one from a paper assignment. Short reflections don't need a
				paper — they stay assignments.
			</p>
			{#if data.isOwner}
				<div class="mt-4">
					<Button type="button" class="gap-2" onclick={openCreate}>
						<Plus class="size-4" />
						New paper
					</Button>
				</div>
			{/if}
			{/if}
		</div>
	{:else}
		<ul class="mt-6 space-y-2">
			{#each data.papers as p (p.id)}
				{@const due = effectiveDue(p)}
				{@const lead = paperDisplayLead(p)}
				<li class="rounded-lg border border-border px-3 py-2.5">
					<div class="flex items-start justify-between gap-3">
						<a href={`/studies/papers/${p.id}`} class="min-w-0 flex-1">
							<p class="text-sm font-medium break-words">{lead.lead}</p>
							{#if lead.detail}
								<p class="text-xs text-muted-foreground">{lead.detail}</p>
							{/if}
							<p class="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
								<span
									class={cn(
										'rounded-full px-2 py-0.5 text-[10px] font-medium',
										statusBadgeClass[p.status]
									)}
								>
									{PAPER_STATUS_LABELS[p.status]}
								</span>
								{#if p.course_name}
									<span>{p.course_code ?? p.course_name}</span>
									<span aria-hidden="true">·</span>
								{/if}
								{#if due}
									<span>Due {formatDate(due)}</span>
									<span aria-hidden="true">·</span>
								{/if}
								<span>{p.sourceCount} source{p.sourceCount === 1 ? '' : 's'}</span>
								{#if p.assignment_id}
									<Badge variant="outline" class="px-1.5 py-0 text-[10px]">Assignment-linked</Badge>
								{/if}
							</p>
							{#if p.topic}
								<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.topic}</p>
							{/if}
						</a>
						{#if data.isOwner}
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label="Edit paper"
								onclick={() => openEdit(p)}
							>
								<Pencil class="size-3.5" />
							</Button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if data.isOwner}
	<PaperFormSheet
		bind:open={sheetOpen}
		mode={sheetMode}
		paper={editingPaper}
		courses={data.courses}
		assignments={data.assignments}
		linkedAssignmentIds={data.linkedAssignmentIds}
		errorMessage={sheetError}
		onSaved={onSaved}
	/>
{/if}

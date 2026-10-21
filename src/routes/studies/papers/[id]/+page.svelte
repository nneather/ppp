<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import PageHeader from '$lib/components/page-header.svelte';
	import PaperFormSheet from '$lib/components/paper-form-sheet.svelte';
	import StudySourcesPanel from '$lib/components/study-sources-panel.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import { Button } from '$lib/components/ui/button';
	import { paperDisplayLead } from '$lib/studies/paper-display';
	import { PAPER_STATUS_LABELS, type PaperStatus } from '$lib/types/classwork';
	import { cn } from '$lib/utils';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type FormShape = {
		kind?: string;
		message?: string;
		success?: boolean;
	};
	const f = $derived((form ?? null) as FormShape | null);

	const paperKey = $derived(`app:classwork:paper:${data.paper.id}`);

	let sheetOpen = $state(false);
	let statusOverride = $state<PaperStatus | null>(null);
	let deletePaperOpen = $state(false);
	let deletePaperPending = $state(false);
	let deletePaperFormEl = $state<HTMLFormElement | null>(null);
	let statusFormEl = $state<HTMLFormElement | null>(null);

	const sources = $derived(data.sources);
	const paperStatus = $derived(statusOverride ?? data.paper.status);
	const displayLead = $derived(paperDisplayLead(data.paper));

	const sheetError = $derived.by(() => {
		if (!f || f.success === true) return null;
		if (f.kind === 'updatePaper') return f.message ?? null;
		return null;
	});

	const actionError = $derived.by(() => {
		if (!f || f.success === true) return null;
		if (f.kind === 'softDeletePaper' || f.kind === 'setPaperStatus') return f.message ?? null;
		return null;
	});

	async function refresh() {
		await invalidate(paperKey);
	}

	const effectiveDue = $derived(data.paper.assignment_due_date ?? data.paper.due_date);

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

	function fillInput(formEl: HTMLFormElement | null, name: string, value: string) {
		const input = formEl?.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
		if (input) input.value = value;
	}

	function submitStatus(status: PaperStatus) {
		if (!statusFormEl) return;
		fillInput(statusFormEl, 'status', status);
		statusFormEl.requestSubmit();
	}

	let statusUndo = $state<{ message: string; status: PaperStatus } | null>(null);
	let statusUndoTimer: ReturnType<typeof setTimeout> | null = null;

	const statusEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success' && result.data && typeof result.data === 'object') {
				const body = result.data as { status?: PaperStatus; previousStatus?: PaperStatus };
				if (body.status) statusOverride = body.status;
				if (body.status === 'archived' && body.previousStatus && body.previousStatus !== 'archived') {
					statusUndo = { message: 'Marked complete', status: body.previousStatus };
					if (statusUndoTimer) clearTimeout(statusUndoTimer);
					statusUndoTimer = setTimeout(() => (statusUndo = null), 10000);
				}
			}
			await update({ reset: false, invalidateAll: false });
		};
	};

	const deletePaperEnhance: SubmitFunction = () => {
		deletePaperPending = true;
		return async ({ result, update }) => {
			deletePaperPending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				deletePaperOpen = false;
				await goto('/studies/papers');
			}
		};
	};

	const statusBadgeClass: Record<PaperStatus, string> = {
		researching: 'bg-muted text-muted-foreground',
		drafting: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
		submitted: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
		published: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
		archived: 'bg-muted text-muted-foreground'
	};
</script>

<svelte:head>
	<title>{displayLead.lead} — Research papers — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 pb-tabbar">
	<PageHeader title={displayLead.lead} back={{ href: '/studies/papers', label: 'Research papers' }}>
		{#snippet meta()}
			<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
				<span class={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusBadgeClass[paperStatus])}>
					{PAPER_STATUS_LABELS[paperStatus]}
				</span>
				{#if data.paper.course_name}
					<span>{data.paper.course_code ? `${data.paper.course_code} · ` : ''}{data.paper.course_name}</span>
				{/if}
				{#if data.paper.assignment_title}
					<span aria-hidden="true">·</span>
					<span>Assignment: {data.paper.assignment_title}</span>
				{/if}
				{#if effectiveDue}
					<span aria-hidden="true">·</span>
					<span>Due {formatDate(effectiveDue)}</span>
				{/if}
				{#if displayLead.detail}
					<span aria-hidden="true">·</span>
					<span>{displayLead.detail}</span>
				{/if}
			</div>
			{#if data.paper.topic}
				<p class="mt-2 text-sm text-muted-foreground">{data.paper.topic}</p>
			{/if}
		{/snippet}
		{#snippet actions()}
			{#if data.isOwner}
				<div class="flex flex-wrap items-center gap-2">
					{#if paperStatus === 'archived'}
						<Button type="button" variant="outline" onclick={() => submitStatus('researching')}>
							Restore
						</Button>
					{:else}
						<Button type="button" variant="outline" onclick={() => submitStatus('archived')}>
							Complete
						</Button>
					{/if}
					<Button type="button" variant="outline" class="gap-2" hotkey="e" onclick={() => (sheetOpen = true)}>
						<Pencil class="size-4" />
						<HotkeyLabel label="Edit" mnemonic="e" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon"
						class="text-destructive"
						aria-label="Delete paper"
						onclick={() => (deletePaperOpen = true)}
					>
						<Trash2 class="size-4" />
					</Button>
				</div>
			{/if}
		{/snippet}
	</PageHeader>

	{#if data.loadError}
		<p class="mt-4 text-sm text-destructive" role="alert">{data.loadError}</p>
	{/if}
	{#if actionError}
		<p class="mt-4 text-sm text-destructive" role="alert">{actionError}</p>
	{/if}

	{#if data.paper.notes}
		<div class="mt-4 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
			<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
			<p class="mt-1 text-sm whitespace-pre-wrap">{data.paper.notes}</p>
		</div>
	{/if}

	<StudySourcesPanel
		parentKind="paper"
		parentId={data.paper.id}
		passageDisplay={data.paper.passage_display}
		sources={sources}
		orphanSources={data.orphanSources}
		groups={data.groups}
		setNames={data.setNames}
		isOwner={data.isOwner}
		srcQ={data.srcQ}
		bookHits={data.bookHits}
		essayHits={data.essayHits}
		sectionCandidateCount={data.sectionCandidateCount}
		footnotePages={data.footnotePages}
		systematics={data.systematics}
		systematicsQuery={data.systematicsQuery}
		invalidateKey={paperKey}
		form={f}
	/>
</div>

{#if statusUndo}
	<div
		class="bottom-tabbar fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg"
		role="status"
	>
		<span>{statusUndo.message}</span>
		<button
			type="button"
			class="underline underline-offset-2"
			onclick={() => {
				const next = statusUndo;
				statusUndo = null;
				if (next) submitStatus(next.status);
			}}
		>
			Undo
		</button>
	</div>
{/if}

{#if data.isOwner}
	<PaperFormSheet
		bind:open={sheetOpen}
		mode="edit"
		paper={{ ...data.paper, status: paperStatus }}
		courses={data.courses}
		assignments={data.assignments}
		linkedAssignmentIds={data.linkedAssignmentIds}
		errorMessage={sheetError}
		onSaved={refresh}
	/>

	<form method="POST" action="?/setPaperStatus" use:enhance={statusEnhance} bind:this={statusFormEl} class="hidden">
		<input type="hidden" name="paper_id" value={data.paper.id} />
		<input type="hidden" name="status" value="" />
	</form>

	<form
		bind:this={deletePaperFormEl}
		method="POST"
		action="?/softDeletePaper"
		use:enhance={deletePaperEnhance}
		class="hidden"
	>
		<input type="hidden" name="paper_id" value={data.paper.id} />
	</form>
	<ConfirmDialog
		bind:open={deletePaperOpen}
		title="Delete paper?"
		description={`Soft-delete “${data.paper.title}” and its attached sources? Library books and essays are untouched.`}
		confirmLabel="Delete"
		pending={deletePaperPending}
		onConfirm={() => deletePaperFormEl?.requestSubmit()}
	/>
{/if}

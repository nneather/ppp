<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import PageHeader from '$lib/components/page-header.svelte';
	import PaperFormSheet from '$lib/components/paper-form-sheet.svelte';
	import PaperSourceRow from '$lib/components/paper-source-row.svelte';
	import PaperAddSourcePanel from '$lib/components/paper-add-source-panel.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import { Button } from '$lib/components/ui/button';
	import { compilePaperBibliography } from '$lib/classwork/paper-bibliography';
	import { paperSourceTitle, type PaperSourceView } from '$lib/classwork/paper-sources';
	import { copyCitationToClipboard } from '$lib/library/turabian';
	import { PAPER_STATUS_LABELS } from '$lib/types/classwork';
	import { cn } from '$lib/utils';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
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

	let deletePaperOpen = $state(false);
	let deletePaperPending = $state(false);
	let deletePaperFormEl = $state<HTMLFormElement | null>(null);

	let removeTarget = $state<{ sourceId: string; title: string } | null>(null);
	let removeSourceOpen = $state(false);
	let removeSourcePending = $state(false);
	let removeSourceFormEl = $state<HTMLFormElement | null>(null);

	let copyToast = $state<string | null>(null);
	let copyToastTimer: ReturnType<typeof setTimeout> | null = null;

	function flashCopyToast(message: string) {
		copyToast = message;
		if (copyToastTimer) clearTimeout(copyToastTimer);
		copyToastTimer = setTimeout(() => (copyToast = null), 2500);
	}

	const sheetError = $derived.by(() => {
		if (!f || f.success === true) return null;
		if (f.kind === 'updatePaper') return f.message ?? null;
		return null;
	});

	const actionError = $derived.by(() => {
		if (!f || f.success === true) return null;
		if (
			f.kind === 'addPaperSource' ||
			f.kind === 'createNotOwnedSource' ||
			f.kind === 'removePaperSource' ||
			f.kind === 'updatePaperSourceNotes' ||
			f.kind === 'softDeletePaper'
		) {
			return f.message ?? null;
		}
		return null;
	});

	async function refresh() {
		await invalidate(paperKey);
	}

	const attachedBookIds = $derived(
		data.sources.filter((s) => s.kind === 'book').map((s) => s.citation.id)
	);
	const attachedEssayIds = $derived(
		data.sources.filter((s) => s.kind === 'essay').map((s) => s.essayId)
	);

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

	async function copyCompiledBibliography() {
		const compiled = compilePaperBibliography(data.sources);
		if (!compiled.plain) {
			flashCopyToast('No bibliography entries yet');
			return;
		}
		try {
			await copyCitationToClipboard(compiled);
			flashCopyToast('Bibliography copied');
		} catch (e) {
			flashCopyToast(e instanceof Error ? e.message : 'Copy failed');
		}
	}

	function askRemoveSource(source: PaperSourceView) {
		removeTarget = { sourceId: source.sourceId, title: paperSourceTitle(source) };
		removeSourceOpen = true;
	}

	function askRemoveOrphan(sourceId: string) {
		removeTarget = { sourceId, title: 'Unavailable source' };
		removeSourceOpen = true;
	}

	function submitRemoveSource() {
		if (!removeTarget || !removeSourceFormEl) return;
		const idInput = removeSourceFormEl.querySelector(
			'input[name="source_id"]'
		) as HTMLInputElement | null;
		if (!idInput) return;
		idInput.value = removeTarget.sourceId;
		removeSourceFormEl.requestSubmit();
	}

	const removeSourceEnhance: SubmitFunction = () => {
		removeSourcePending = true;
		return async ({ result, update }) => {
			removeSourcePending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				removeSourceOpen = false;
				removeTarget = null;
				await refresh();
			}
		};
	};

	const totalSourceCount = $derived(data.sources.length + data.orphanSources.length);

	const deletePaperEnhance: SubmitFunction = () => {
		deletePaperPending = true;
		return async ({ result, update }) => {
			deletePaperPending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				deletePaperOpen = false;
				await goto('/classwork/papers');
			}
		};
	};

	const statusBadgeClass: Record<string, string> = {
		draft: 'bg-muted text-muted-foreground',
		in_progress: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
		submitted: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
	};
</script>

<svelte:head>
	<title>{data.paper.title} — Research papers — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 pb-tabbar">
	<PageHeader title={data.paper.title} back={{ href: '/classwork/papers', label: 'Research papers' }}>
		{#snippet meta()}
			<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
				<span
					class={cn(
						'rounded-full px-2 py-0.5 text-xs font-medium',
						statusBadgeClass[data.paper.status]
					)}
				>
					{PAPER_STATUS_LABELS[data.paper.status]}
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
				{#if data.paper.passage_display}
					<span aria-hidden="true">·</span>
					<span>{data.paper.passage_display}</span>
				{/if}
			</div>
			{#if data.paper.topic}
				<p class="mt-2 text-sm text-muted-foreground">{data.paper.topic}</p>
			{/if}
		{/snippet}
		{#snippet actions()}
			{#if data.isOwner}
				<div class="flex flex-wrap items-center gap-2">
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
			<p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</p>
			<p class="mt-1 text-sm whitespace-pre-wrap">{data.paper.notes}</p>
		</div>
	{/if}

	<section class="mt-8">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 class="text-sm font-semibold">
				Sources
				<span class="ml-1 font-normal text-muted-foreground">({totalSourceCount})</span>
			</h2>
			<Button
				type="button"
				variant="outline"
				class="gap-2"
				hotkey="b"
				disabled={data.sources.length === 0}
				onclick={copyCompiledBibliography}
			>
				<ClipboardList class="size-4" />
				<HotkeyLabel label="Copy bibliography" mnemonic="b" />
			</Button>
		</div>
		<p class="mt-1 text-xs text-muted-foreground">
			Flat Turabian order, books + essays merged. Unsigned reference articles are cited in
			notes only and stay out of the bibliography.
		</p>

		{#if data.isOwner}
			<div class="mt-4">
				<PaperAddSourcePanel
					paperId={data.paper.id}
					query={data.srcQ}
					bookHits={data.bookHits}
					essayHits={data.essayHits}
					{attachedBookIds}
					{attachedEssayIds}
					onAdded={refresh}
				/>
			</div>
		{/if}

		{#if totalSourceCount === 0}
			<div class="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center">
				<p class="text-sm font-medium">No sources attached</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Search the library above — owned books, research stubs, and essays all count.
				</p>
			</div>
		{:else}
			<ul class="mt-4 space-y-2">
				{#each data.sources as source (source.sourceId)}
					<PaperSourceRow
						{source}
						isOwner={data.isOwner}
						onCopied={flashCopyToast}
						onRemove={askRemoveSource}
						onSaved={refresh}
					/>
				{/each}
				{#each data.orphanSources as orphan (orphan.sourceId)}
					<li
						class="flex items-start justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2.5 opacity-80"
					>
						<div class="min-w-0">
							<p class="text-sm font-medium text-muted-foreground">
								Unavailable {orphan.kind} source
							</p>
							<p class="mt-0.5 text-xs text-muted-foreground">
								The library entry behind this source was deleted. Remove it, or restore the
								{orphan.kind} from the audit log.
							</p>
							{#if orphan.notes}
								<p
									class="mt-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs whitespace-pre-wrap text-muted-foreground"
								>
									{orphan.notes}
								</p>
							{/if}
						</div>
						{#if data.isOwner}
							<Button
								type="button"
								variant="outline"
								size="icon-sm"
								class="shrink-0 text-destructive"
								aria-label="Remove unavailable source"
								onclick={() => askRemoveOrphan(orphan.sourceId)}
							>
								<Trash2 class="size-3.5" />
							</Button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

{#if copyToast}
	<div
		class="bottom-tabbar fixed left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg"
		role="status"
	>
		{copyToast}
	</div>
{/if}

{#if data.isOwner}
	<PaperFormSheet
		bind:open={sheetOpen}
		mode="edit"
		paper={data.paper}
		courses={data.courses}
		assignments={data.assignments}
		linkedAssignmentIds={data.linkedAssignmentIds}
		errorMessage={sheetError}
		onSaved={refresh}
	/>

	<form
		bind:this={removeSourceFormEl}
		method="POST"
		action="?/removePaperSource"
		use:enhance={removeSourceEnhance}
		class="hidden"
	>
		<input type="hidden" name="source_id" value="" />
	</form>
	<ConfirmDialog
		bind:open={removeSourceOpen}
		title="Remove source?"
		description={removeTarget
			? `Remove “${removeTarget.title}” from this paper? Its research note goes with it (re-attaching restores it). The library entry is untouched.`
			: ''}
		confirmLabel="Remove"
		pending={removeSourcePending}
		onConfirm={submitRemoveSource}
	/>

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

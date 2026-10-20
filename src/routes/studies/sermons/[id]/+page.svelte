<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import PageHeader from '$lib/components/page-header.svelte';
	import SermonFormSheet from '$lib/components/sermon-form-sheet.svelte';
	import StudySourcesPanel from '$lib/components/study-sources-panel.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import { Button } from '$lib/components/ui/button';
	import { formatYmdMediumChicago } from '$lib/invoicing/chicago-date';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type FormShape = { kind?: string; message?: string; success?: boolean };
	const f = $derived((form ?? null) as FormShape | null);

	const sermonKey = $derived(`app:sermons:sermon:${data.sermon.id}`);
	const title = $derived(
		data.sermon.passage_display?.trim() || data.sermon.topic?.trim() || 'Sermon'
	);

	let sheetOpen = $state(false);
	let deleteOpen = $state(false);
	let deletePending = $state(false);
	let deleteFormEl = $state<HTMLFormElement | null>(null);

	const sheetError = $derived.by(() => {
		if (!f || f.success === true) return null;
		if (f.kind === 'updateSermon') return f.message ?? null;
		return null;
	});

	const actionError = $derived.by(() => {
		if (!f || f.success === true) return null;
		if (f.kind === 'softDeleteSermon') return f.message ?? null;
		return null;
	});

	async function refresh() {
		await invalidate(sermonKey);
	}

	const deleteEnhance: SubmitFunction = () => {
		deletePending = true;
		return async ({ result, update }) => {
			deletePending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				deleteOpen = false;
				await goto('/studies/sermons');
			}
		};
	};
</script>

<svelte:head>
	<title>{title} — Sermons — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 pb-tabbar md:px-6 md:py-8">
	<PageHeader title={title} back={{ href: '/studies/sermons', label: 'Sermons' }}>
		{#snippet meta()}
			<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
				<time datetime={data.sermon.preached_on}>{formatYmdMediumChicago(data.sermon.preached_on)}</time>
				{#if data.sermon.venue_name}
					<span aria-hidden="true">·</span>
					<span>{data.sermon.venue_name}</span>
				{/if}
				{#if data.sermon.topical}
					<span aria-hidden="true">·</span>
					<span>Topical</span>
				{/if}
				{#if data.sermon.topic?.trim() && data.sermon.passage_display?.trim()}
					<span aria-hidden="true">·</span>
					<span>{data.sermon.topic}</span>
				{/if}
			</div>
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
						aria-label="Delete sermon"
						onclick={() => (deleteOpen = true)}
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

	{#if data.sermon.notes}
		<div class="mt-4 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
			<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
			<p class="mt-1 text-sm whitespace-pre-wrap">{data.sermon.notes}</p>
		</div>
	{/if}

	<StudySourcesPanel
		parentKind="sermon"
		parentId={data.sermon.id}
		passageDisplay={data.sermon.passage_display}
		sources={data.sources}
		orphanSources={data.orphanSources}
		groups={data.groups}
		setNames={data.setNames}
		isOwner={data.isOwner}
		srcQ={data.srcQ}
		bookHits={data.bookHits}
		essayHits={data.essayHits}
		suggestions={data.suggestions}
		importSets={data.importSets}
		importCreateSections={data.importCreateSections}
		importPapers={data.importPapers}
		sectionCandidateCount={data.sectionCandidateCount}
		footnotePages={data.footnotePages}
		systematics={data.systematics}
		invalidateKey={sermonKey}
		form={f}
	/>
</div>

{#if data.isOwner}
	<SermonFormSheet
		bind:open={sheetOpen}
		mode="edit"
		sermon={data.sermon}
		venues={data.venues}
		errorMessage={sheetError}
		onSaved={refresh}
	/>

	<form
		bind:this={deleteFormEl}
		method="POST"
		action="?/softDeleteSermon"
		use:enhance={deleteEnhance}
		class="hidden"
	>
		<input type="hidden" name="sermon_id" value={data.sermon.id} />
	</form>
	<ConfirmDialog
		bind:open={deleteOpen}
		title="Delete sermon?"
		description={`Soft-delete “${title}”? Attached library books stay in the catalog.`}
		confirmLabel="Delete"
		pending={deletePending}
		onConfirm={() => deleteFormEl?.requestSubmit()}
	/>
{/if}

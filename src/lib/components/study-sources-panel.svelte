<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { onDestroy, onMount } from 'svelte';
	import PaperImportDialog from '$lib/components/paper-import-dialog.svelte';
	import PaperSourceRow from '$lib/components/paper-source-row.svelte';
	import PaperAddSourcePanel from '$lib/components/paper-add-source-panel.svelte';
	import PaperGroupHeader from '$lib/components/paper-group-header.svelte';
	import SystematicsOnPassage from '$lib/components/systematics-on-passage.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import type { SystematicSetBlock } from '$lib/library/outline';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		compilePaperBibliography,
		compileSectionedBibliography
	} from '$lib/studies/paper-bibliography';
	import {
		setIdForGroupName,
		type ImportSetSection,
		type SetSuggestion
	} from '$lib/studies/import-suggest';
	import {
		groupPaperSources,
		paperSourceCatalog,
		paperSourceTitle,
		type OrphanPaperSource,
		type PaperGroupView,
		type PaperSourceView
	} from '$lib/studies/paper-sources';
	import { includeInCompiledBibliography } from '$lib/studies/source-usage';
	import { copyCitationToClipboard } from '$lib/library/turabian';
	import type { BookListRow, EssaySearchHit } from '$lib/types/library';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import Download from '@lucide/svelte/icons/download';
	import FolderInput from '@lucide/svelte/icons/folder-input';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	type FormShape = { kind?: string; message?: string; success?: boolean; setId?: string };

	let {
		parentKind,
		parentId,
		passageDisplay = null,
		sources: sourceRows,
		orphanSources,
		groups,
		setNames,
		isOwner,
		srcQ,
		bookHits,
		essayHits,
		sectionCandidateCount = 0,
		footnotePages = {},
		systematics,
		systematicsQuery = null,
		invalidateKey,
		form
	}: {
		parentKind: 'paper' | 'sermon';
		parentId: string;
		passageDisplay?: string | null;
		sources: PaperSourceView[];
		orphanSources: OrphanPaperSource[];
		groups: PaperGroupView[];
		setNames: { id: string; name: string }[];
		isOwner: boolean;
		srcQ: string;
		bookHits: BookListRow[];
		essayHits: EssaySearchHit[];
		sectionCandidateCount?: number;
		footnotePages?: Record<string, string>;
		systematics: Promise<SystematicSetBlock[]>;
		systematicsQuery?: {
			bibleBook: string;
			chapter: number | null;
			verse: number | null;
			chapterEnd: number | null;
			verseEnd: number | null;
		} | null;
		invalidateKey: string;
		form: FormShape | null;
	} = $props();

	const parentField = $derived(parentKind === 'paper' ? 'paper_id' : 'sermon_id');
	const noun = $derived(parentKind === 'paper' ? 'paper' : 'sermon');
	const undoKey = $derived(
		parentKind === 'paper' ? 'ppp.studies.paper-undo' : 'ppp.studies.sermon-undo'
	);

	let importOpen = $state(false);
	let importMeta = $state<{
		suggestions: SetSuggestion[];
		importSets: ImportSetSection[];
		importCreateSections: { id: string; name: string; setKind: 'language' | 'custom' }[];
		importPapers: { id: string; title: string; passageDisplay: string | null }[];
	} | null>(null);
	let importMetaLoading = $state(false);

	$effect(() => {
		if (!importOpen || importMeta) return;
		importMetaLoading = true;
		const params = new URLSearchParams({ parent_kind: parentKind, parent_id: parentId });
		void fetch(`/studies/import-meta.json?${params}`)
			.then(async (res) => {
				if (!res.ok) return;
				importMeta = (await res.json()) as NonNullable<typeof importMeta>;
			})
			.finally(() => {
				importMetaLoading = false;
			});
	});
	let includeCandidates = $state(false);
	let sectionByGroup = $state(false);
	let removedSourceIds = $state<string[]>([]);

	let removeStudyFormEl = $state<HTMLFormElement | null>(null);
	let restoreStudyFormEl = $state<HTMLFormElement | null>(null);
	let removeSetFormEl = $state<HTMLFormElement | null>(null);
	let restoreSetFormEl = $state<HTMLFormElement | null>(null);
	let pendingStudy: { sourceId: string; title: string } | null = null;
	let pendingSet: { setId: string; bookId: string; essayId: string; title: string } | null = null;

	type UndoState =
		| { kind: 'study'; message: string; sourceId: string }
		| { kind: 'set'; message: string; setId: string; bookId: string; essayId: string };
	let undo = $state<UndoState | null>(null);
	let undoTimer: ReturnType<typeof setTimeout> | null = null;

	let newGroupOpen = $state(false);
	let newGroupName = $state('');
	let newGroupPending = $state(false);
	let deleteGroupTarget = $state<PaperGroupView | null>(null);
	let deleteGroupOpen = $state(false);
	let deleteGroupPending = $state(false);
	let deleteGroupFormEl = $state<HTMLFormElement | null>(null);
	let reorderPending = $state(false);
	let reorderFormEl = $state<HTMLFormElement | null>(null);

	let copyToast = $state<string | null>(null);
	let copyToastTimer: ReturnType<typeof setTimeout> | null = null;

	function flashCopyToast(message: string) {
		copyToast = message;
		if (copyToastTimer) clearTimeout(copyToastTimer);
		copyToastTimer = setTimeout(() => (copyToast = null), 2500);
	}

	function persistUndo(next: UndoState, at = Date.now()) {
		const body =
			next.kind === 'study'
				? { kind: next.kind, message: next.message, sourceId: next.sourceId }
				: {
						kind: next.kind,
						message: next.message,
						setId: next.setId,
						bookId: next.bookId,
						essayId: next.essayId
					};
		try {
			sessionStorage.setItem(undoKey, JSON.stringify({ ...body, at, studyId: parentId }));
		} catch {
			/* private mode */
		}
	}

	function clearPersistedUndo() {
		try {
			sessionStorage.removeItem(undoKey);
		} catch {
			/* private mode */
		}
	}

	function showUndo(next: UndoState, ttlMs = 10000) {
		undo = next;
		persistUndo(next, Date.now() - (10000 - ttlMs));
		if (undoTimer) clearTimeout(undoTimer);
		undoTimer = setTimeout(() => {
			undo = null;
			clearPersistedUndo();
		}, ttlMs);
	}

	onMount(() => {
		let raw: string | null = null;
		try {
			raw = sessionStorage.getItem(undoKey);
		} catch {
			return;
		}
		if (!raw) return;
		try {
			const saved = JSON.parse(raw) as UndoState & { at?: number; studyId?: string; paperId?: string };
			const savedId = saved.studyId ?? saved.paperId;
			if (savedId !== parentId || typeof saved.at !== 'number') return;
			const left = 10000 - (Date.now() - saved.at);
			if (left <= 0 || (saved.kind !== 'study' && saved.kind !== 'set')) {
				clearPersistedUndo();
				return;
			}
			if (saved.kind === 'study' && saved.sourceId) {
				showUndo({ kind: 'study', message: saved.message, sourceId: saved.sourceId }, left);
			} else if (saved.kind === 'set' && saved.setId) {
				showUndo(
					{
						kind: 'set',
						message: saved.message,
						setId: saved.setId,
						bookId: saved.bookId,
						essayId: saved.essayId
					},
					left
				);
			}
		} catch {
			clearPersistedUndo();
		}
	});

	onDestroy(() => {
		if (undoTimer) clearTimeout(undoTimer);
		if (copyToastTimer) clearTimeout(copyToastTimer);
	});

	const sources = $derived(sourceRows.filter((source) => !removedSourceIds.includes(source.sourceId)));

	function originSetId(source: PaperSourceView): string | null {
		const group = groups.find((item) => item.id === source.groupId);
		return setIdForGroupName(group?.name, setNames);
	}

	const actionError = $derived.by(() => {
		if (!form || form.success === true) return null;
		if (
			form.kind === 'addPaperSource' ||
			form.kind === 'createNotOwnedSource' ||
			form.kind === 'removePaperSource' ||
			form.kind === 'updatePaperSourceNotes' ||
			form.kind === 'createPaperGroup' ||
			form.kind === 'renamePaperGroup' ||
			form.kind === 'reorderPaperGroups' ||
			form.kind === 'softDeletePaperGroup' ||
			form.kind === 'setPaperSourceGroup' ||
			form.kind === 'importPaperSources' ||
			form.kind === 'setPaperSourceUsage' ||
			form.kind === 'restorePaperSource' ||
			form.kind === 'removeSetMember' ||
			form.kind === 'restoreSetMember'
		) {
			return form.message ?? null;
		}
		return null;
	});

	async function refresh() {
		await invalidate(invalidateKey);
	}

	const attachedBookIds = $derived(
		sources.filter((source) => source.kind === 'book').map((source) => source.citation.id)
	);
	const attachedEssayIds = $derived(
		sources.filter((source) => source.kind === 'essay').map((source) => source.essayId)
	);

	const compiledBibliography = $derived(
		sectionByGroup
			? compileSectionedBibliography(sources, groups, { includeCandidates })
			: compilePaperBibliography(sources, { includeCandidates })
	);
	const docxHref = $derived(
		`/studies/bibliography/download?${parentField}=${parentId}${sectionByGroup ? '&sectioned=1' : ''}${includeCandidates ? '&candidates=1' : ''}`
	);
	const bibliographyEmpty = $derived(
		sources.filter((source) => includeInCompiledBibliography(source.usage, includeCandidates))
			.length === 0
	);

	async function copyCompiledBibliography() {
		const compiled = compiledBibliography;
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

	function fillInput(formEl: HTMLFormElement | null, name: string, value: string) {
		const input = formEl?.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
		if (input) input.value = value;
	}

	function removeFromStudy(source: PaperSourceView) {
		if (!removeStudyFormEl) return;
		pendingStudy = { sourceId: source.sourceId, title: paperSourceTitle(source) };
		fillInput(removeStudyFormEl, 'source_id', source.sourceId);
		removeStudyFormEl.requestSubmit();
	}

	function removeOrphan(sourceId: string) {
		if (!removeStudyFormEl) return;
		pendingStudy = { sourceId, title: 'Unavailable source' };
		fillInput(removeStudyFormEl, 'source_id', sourceId);
		removeStudyFormEl.requestSubmit();
	}

	const removeStudyEnhance: SubmitFunction = () => {
		const snapshot = pendingStudy;
		return async ({ result, update }) => {
			if (result.type === 'success' && snapshot) {
				if (!removedSourceIds.includes(snapshot.sourceId)) {
					removedSourceIds = [...removedSourceIds, snapshot.sourceId];
				}
				showUndo({
					kind: 'study',
					message: `Removed “${snapshot.title}” from this ${noun}`,
					sourceId: snapshot.sourceId
				});
			}
			await update({ reset: false, invalidateAll: false });
		};
	};

	function removeFromSet(source: PaperSourceView, setId: string) {
		if (!removeSetFormEl) return;
		const catalog = paperSourceCatalog(source);
		pendingSet = {
			setId,
			bookId: catalog.bookId ?? '',
			essayId: catalog.essayId ?? '',
			title: paperSourceTitle(source)
		};
		fillInput(removeSetFormEl, 'set_id', setId);
		fillInput(removeSetFormEl, 'book_id', catalog.bookId ?? '');
		fillInput(removeSetFormEl, 'essay_id', catalog.essayId ?? '');
		removeSetFormEl.requestSubmit();
	}

	const removeSetEnhance: SubmitFunction = () => {
		const snapshot = pendingSet;
		return async ({ result, update }) => {
			if (result.type === 'success' && snapshot) {
				showUndo({
					kind: 'set',
					message: `Removed “${snapshot.title}” from the set`,
					setId: snapshot.setId,
					bookId: snapshot.bookId,
					essayId: snapshot.essayId
				});
			}
			await update({ reset: false, invalidateAll: false });
		};
	};

	function runUndo() {
		const current = undo;
		undo = null;
		if (undoTimer) clearTimeout(undoTimer);
		clearPersistedUndo();
		if (!current) return;
		if (current.kind === 'study' && restoreStudyFormEl) {
			removedSourceIds = removedSourceIds.filter((id) => id !== current.sourceId);
			fillInput(restoreStudyFormEl, 'source_id', current.sourceId);
			restoreStudyFormEl.requestSubmit();
			return;
		}
		if (current.kind === 'set' && restoreSetFormEl) {
			fillInput(restoreSetFormEl, 'set_id', current.setId);
			fillInput(restoreSetFormEl, 'book_id', current.bookId);
			fillInput(restoreSetFormEl, 'essay_id', current.essayId);
			restoreSetFormEl.requestSubmit();
		}
	}

	const quietEnhance: SubmitFunction = () => {
		return async ({ update }) => {
			await update({ reset: false, invalidateAll: false });
		};
	};

	async function onImported() {
		importOpen = false;
		await refresh();
	}

	const totalSourceCount = $derived(sources.length + orphanSources.length);
	const buckets = $derived(groupPaperSources(sources, groups));

	const newGroupEnhance: SubmitFunction = () => {
		newGroupPending = true;
		return async ({ result, update }) => {
			newGroupPending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				newGroupOpen = false;
				newGroupName = '';
				await refresh();
			}
		};
	};

	function askDeleteGroup(group: PaperGroupView) {
		deleteGroupTarget = group;
		deleteGroupOpen = true;
	}

	function submitDeleteGroup() {
		if (!deleteGroupTarget || !deleteGroupFormEl) return;
		const idInput = deleteGroupFormEl.querySelector('input[name="group_id"]') as HTMLInputElement | null;
		if (!idInput) return;
		idInput.value = deleteGroupTarget.id;
		deleteGroupFormEl.requestSubmit();
	}

	const deleteGroupEnhance: SubmitFunction = () => {
		deleteGroupPending = true;
		return async ({ result, update }) => {
			deleteGroupPending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				deleteGroupOpen = false;
				deleteGroupTarget = null;
				await refresh();
			}
		};
	};

	function moveGroup(groupId: string, direction: 'up' | 'down') {
		if (!reorderFormEl || reorderPending) return;
		const ids = groups.map((group) => group.id);
		const i = ids.indexOf(groupId);
		const j = direction === 'up' ? i - 1 : i + 1;
		if (i < 0 || j < 0 || j >= ids.length) return;
		[ids[i], ids[j]] = [ids[j]!, ids[i]!];
		const orderInput = reorderFormEl.querySelector('input[name="order"]') as HTMLInputElement | null;
		if (!orderInput) return;
		orderInput.value = JSON.stringify(ids);
		reorderFormEl.requestSubmit();
	}

	const reorderEnhance: SubmitFunction = () => {
		reorderPending = true;
		return async ({ result, update }) => {
			reorderPending = false;
			await update({ reset: false });
			if (result.type === 'success') await refresh();
		};
	};
</script>

{#if actionError}
	<p class="mt-4 text-sm text-destructive" role="alert">{actionError}</p>
{/if}

{#if systematicsQuery}
	<section class="mt-8">
		{#await systematics}
			<h2 class="text-sm font-semibold">Systematic theologies</h2>
			<p class="mt-2 text-sm text-muted-foreground">Loading index hits…</p>
		{:then blocks}
			{#if blocks.length > 0}
				<h2 class="text-sm font-semibold">Systematic theologies</h2>
				<p class="mt-0.5 text-xs text-muted-foreground">
					Index hits for this passage, with the verse each one covers. Attach a volume to add it as a source.
				</p>
				<div class="mt-3">
					<SystematicsOnPassage
						{blocks}
						passage={systematicsQuery}
						{parentField}
						{parentId}
						attachedBookIds={sourceRows
							.filter((s) => s.kind === 'book')
							.map((s) => s.citation.id)}
					/>
				</div>
			{/if}
		{:catch}
			<p class="text-sm text-destructive">Could not load systematic theologies.</p>
		{/await}
	</section>
{/if}

<section class="mt-8">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h2 class="text-sm font-semibold">
			Sources
			<span class="ml-1 font-normal text-muted-foreground">({totalSourceCount})</span>
		</h2>
		<div class="flex flex-wrap items-center gap-2">
			{#if isOwner}
				<Button type="button" variant="outline" class="gap-2" onclick={() => (importOpen = true)}>
					<FolderInput class="size-4" />
					Import sources
				</Button>
			{/if}
			<label class="flex items-center gap-1.5 text-xs text-muted-foreground">
				<input type="checkbox" class="size-3.5" bind:checked={includeCandidates} />
				Include candidates
			</label>
			<label class="flex items-center gap-1.5 text-xs text-muted-foreground">
				<input type="checkbox" class="size-3.5" bind:checked={sectionByGroup} />
				Section by group
			</label>
			<Button
				type="button"
				variant="outline"
				class="gap-2"
				hotkey="b"
				disabled={bibliographyEmpty}
				onclick={copyCompiledBibliography}
			>
				<ClipboardList class="size-4" />
				<HotkeyLabel label="Copy bibliography" mnemonic="b" />
			</Button>
			<Button
				variant="outline"
				class="gap-2"
				href={docxHref}
				disabled={bibliographyEmpty}
				data-sveltekit-reload
			>
				<Download class="size-4" />
				Download .docx
			</Button>
		</div>
	</div>
	<p class="mt-1 text-xs text-muted-foreground">
		Bibliography defaults to consulted and cited. Section by group turns each research group into a
		heading. Unsigned reference articles stay out.
	</p>

	{#if isOwner}
		<div class="mt-4">
			<PaperAddSourcePanel
				paperId={parentId}
				{parentField}
				query={srcQ}
				{bookHits}
				{essayHits}
				{attachedBookIds}
				{attachedEssayIds}
				onAdded={refresh}
			/>
		</div>
		<div class="mt-3">
			{#if !newGroupOpen}
				<button
					type="button"
					class="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
					onclick={() => (newGroupOpen = true)}
				>
					New research group
				</button>
			{:else}
				<form
					method="POST"
					action="?/createPaperGroup"
					use:enhance={newGroupEnhance}
					class="flex flex-wrap items-center gap-2"
				>
					<input type="hidden" name={parentField} value={parentId} />
					<Input
						type="text"
						name="name"
						bind:value={newGroupName}
						required
						placeholder="Group name — e.g. Primary sources"
						aria-label="New group name"
						class="h-8 w-full max-w-64 text-sm"
					/>
					<Button
						type="submit"
						variant="outline"
						size="sm"
						label={newGroupPending ? 'Adding…' : 'Add group'}
						disabled={newGroupPending || !newGroupName.trim()}
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						hotkey="Escape"
						label="Cancel"
						onclick={() => (newGroupOpen = false)}
					/>
				</form>
			{/if}
		</div>
	{/if}

	{#snippet sourceRow(source: PaperSourceView)}
		<PaperSourceRow
			{source}
			{groups}
			{isOwner}
			onCopied={flashCopyToast}
			onRemove={removeFromStudy}
			onRemoveFromSet={removeFromSet}
			originSetId={originSetId(source)}
			footnotePage={source.kind === 'book' ? (footnotePages[source.citation.id] ?? '') : ''}
			onSaved={refresh}
		/>
	{/snippet}

	{#if totalSourceCount === 0 && groups.length === 0}
		<div class="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center">
			<p class="text-sm font-medium">No sources attached</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Search the library above — owned books, research stubs, and essays all count.
			</p>
		</div>
	{:else if groups.length === 0}
		<ul class="mt-4 space-y-2">
			{#each sources as source (source.sourceId)}
				{@render sourceRow(source)}
			{/each}
		</ul>
	{:else}
		{#each buckets as bucket (bucket.group?.id ?? 'ungrouped')}
			{#if bucket.group === null}
				{#if bucket.sources.length > 0}
					<div class="mt-5">
						<h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Ungrouped
							<span class="ml-1 font-normal">({bucket.sources.length})</span>
						</h3>
						<ul class="mt-2 space-y-2">
							{#each bucket.sources as source (source.sourceId)}
								{@render sourceRow(source)}
							{/each}
						</ul>
					</div>
				{/if}
			{:else}
				{@const groupIndex = groups.findIndex((group) => group.id === bucket.group?.id)}
				<div class="mt-5">
					<PaperGroupHeader
						group={bucket.group}
						sources={bucket.sources}
						count={bucket.sources.length}
						{isOwner}
						canMoveUp={groupIndex > 0 && !reorderPending}
						canMoveDown={groupIndex < groups.length - 1 && !reorderPending}
						onMove={moveGroup}
						onDelete={askDeleteGroup}
						onSaved={refresh}
					/>
					{#if bucket.sources.length === 0}
						<p class="mt-2 text-xs text-muted-foreground">
							No sources in this group — use the group selector on a source row.
						</p>
					{:else}
						<ul class="mt-2 space-y-2">
							{#each bucket.sources as source (source.sourceId)}
								{@render sourceRow(source)}
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		{/each}
	{/if}

	{#if orphanSources.length > 0}
		<ul class="mt-4 space-y-2">
			{#each orphanSources as orphan (orphan.sourceId)}
				<li
					class="flex items-start justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2.5 opacity-80"
				>
					<div class="min-w-0">
						<p class="text-sm font-medium text-muted-foreground">Unavailable {orphan.kind} source</p>
						<p class="mt-0.5 text-xs text-muted-foreground">
							The library entry behind this source was deleted. Remove it, or restore the
							{orphan.kind} from the audit log.
						</p>
						{#if orphan.notes}
							<p class="mt-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs whitespace-pre-wrap text-muted-foreground">
								{orphan.notes}
							</p>
						{/if}
					</div>
					{#if isOwner}
						<Button
							type="button"
							variant="outline"
							size="icon-sm"
							class="shrink-0 text-destructive"
							aria-label="Remove unavailable source"
							onclick={() => removeOrphan(orphan.sourceId)}
						>
							<Trash2 class="size-3.5" />
						</Button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if undo}
	<div
		class="bottom-tabbar fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg"
		role="status"
	>
		<span>{undo.message}</span>
		<button type="button" class="underline underline-offset-2" onclick={runUndo}>Undo</button>
	</div>
{:else if copyToast}
	<div
		class="bottom-tabbar fixed left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg"
		role="status"
	>
		{copyToast}
	</div>
{/if}

{#if isOwner}
	<form
		bind:this={removeStudyFormEl}
		method="POST"
		action="?/removePaperSource"
		use:enhance={removeStudyEnhance}
		class="hidden"
	>
		<input type="hidden" name="source_id" value="" />
	</form>
	<form
		bind:this={restoreStudyFormEl}
		method="POST"
		action="?/restorePaperSource"
		use:enhance={quietEnhance}
		class="hidden"
	>
		<input type="hidden" name="source_id" value="" />
	</form>
	<form
		bind:this={removeSetFormEl}
		method="POST"
		action="?/removeSetMember"
		use:enhance={removeSetEnhance}
		class="hidden"
	>
		<input type="hidden" name="set_id" value="" />
		<input type="hidden" name="book_id" value="" />
		<input type="hidden" name="essay_id" value="" />
	</form>
	<form
		bind:this={restoreSetFormEl}
		method="POST"
		action="?/restoreSetMember"
		use:enhance={quietEnhance}
		class="hidden"
	>
		<input type="hidden" name="set_id" value="" />
		<input type="hidden" name="book_id" value="" />
		<input type="hidden" name="essay_id" value="" />
	</form>

	<PaperImportDialog
		bind:open={importOpen}
		{parentKind}
		{parentId}
		{parentField}
		{passageDisplay}
		{isOwner}
		suggestions={importMeta?.suggestions ?? []}
		importSets={importMeta?.importSets ?? []}
		importCreateSections={importMeta?.importCreateSections ?? []}
		importPapers={importMeta?.importPapers ?? []}
		{sectionCandidateCount}
		metaLoading={importMetaLoading && !importMeta}
		onImported={onImported}
	/>

	<form
		bind:this={deleteGroupFormEl}
		method="POST"
		action="?/softDeletePaperGroup"
		use:enhance={deleteGroupEnhance}
		class="hidden"
	>
		<input type="hidden" name="group_id" value="" />
	</form>
	<ConfirmDialog
		bind:open={deleteGroupOpen}
		title="Delete group?"
		description={deleteGroupTarget
			? `Delete “${deleteGroupTarget.name}”? Its sources stay on the ${noun}, ungrouped.`
			: ''}
		confirmLabel="Delete"
		pending={deleteGroupPending}
		onConfirm={submitDeleteGroup}
	/>

	<form
		bind:this={reorderFormEl}
		method="POST"
		action="?/reorderPaperGroups"
		use:enhance={reorderEnhance}
		class="hidden"
	>
		<input type="hidden" name={parentField} value={parentId} />
		<input type="hidden" name="order" value="" />
	</form>
{/if}

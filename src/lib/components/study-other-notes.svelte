<script lang="ts">
	type OtherNote = {
		id: string;
		body: string;
		page: string | null;
		passageDisplay: string | null;
		studyKind: 'paper' | 'sermon';
		studyId: string;
		studyLabel: string;
	};

	let {
		bookId = null,
		essayId = null,
		articleId = null,
		excludeStudyId
	}: {
		bookId?: string | null;
		essayId?: string | null;
		articleId?: string | null;
		excludeStudyId: string;
	} = $props();

	let open = $state(false);
	let loaded = $state(false);
	let loading = $state(false);
	let notes = $state<OtherNote[]>([]);
	let errorMessage = $state<string | null>(null);

	async function toggle() {
		open = !open;
		if (!open || loaded || loading) return;
		loading = true;
		errorMessage = null;
		const params = new URLSearchParams();
		if (bookId) params.set('book_id', bookId);
		if (essayId) params.set('essay_id', essayId);
		if (articleId) params.set('article_id', articleId);
		params.set('exclude_study', excludeStudyId);
		try {
			const response = await fetch(`/studies/notes.json?${params}`);
			if (!response.ok) {
				errorMessage = 'Could not load notes from other studies.';
				return;
			}
			const body = (await response.json()) as { notes?: OtherNote[]; error?: string | null };
			notes = body.notes ?? [];
			errorMessage = body.error ?? null;
			loaded = true;
		} catch {
			errorMessage = 'Could not load notes from other studies.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="mt-2">
	<button
		type="button"
		class="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
		onclick={toggle}
	>
		{#if loading}
			Loading other studies…
		{:else if loaded}
			{open ? 'Hide' : 'Show'} {notes.length} {notes.length === 1 ? 'note' : 'notes'} on other studies
		{:else}
			Notes on other studies
		{/if}
	</button>
	{#if open}
		{#if errorMessage}
			<p class="mt-1 text-xs text-destructive">{errorMessage}</p>
		{:else if loaded && notes.length === 0}
			<p class="mt-1 text-xs text-muted-foreground">No notes on this source in another study.</p>
		{:else}
			<ul class="mt-2 space-y-1.5">
				{#each notes as note (note.id)}
					<li class="text-xs text-muted-foreground">
						<a
							class="font-medium text-foreground underline-offset-2 hover:underline"
							href={note.studyKind === 'paper' ? `/studies/papers/${note.studyId}` : `/studies/sermons/${note.studyId}`}
						>
							{note.studyLabel}
						</a>
						{#if note.page || note.passageDisplay}
							<span> · {[note.page, note.passageDisplay].filter(Boolean).join(' · ')}</span>
						{/if}
						<span class="mt-0.5 block whitespace-pre-wrap text-foreground">{note.body}</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

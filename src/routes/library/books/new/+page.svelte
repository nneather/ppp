<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import BookForm from '$lib/components/book-form.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import {
		LIBRARY_OL_PREFILL_KEY,
		type OpenLibraryBookPrefill
	} from '$lib/library/open-library-prefill';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let olPrefill = $state<OpenLibraryBookPrefill | null>(null);

	$effect(() => {
		if (!browser) return;
		const raw = sessionStorage.getItem(LIBRARY_OL_PREFILL_KEY);
		if (!raw) return;
		try {
			const parsed = JSON.parse(raw) as OpenLibraryBookPrefill;
			if (parsed && typeof parsed.isbn === 'string') olPrefill = parsed;
		} catch {
			olPrefill = null;
		}
	});

	function clearOlPrefill() {
		if (browser) sessionStorage.removeItem(LIBRARY_OL_PREFILL_KEY);
		olPrefill = null;
	}

	const formMessage = $derived.by(() => {
		const f = form as { kind?: string; message?: string } | null;
		if (!f) return null;
		if (f.kind === 'createBook') return f;
		return null;
	});

	let dirty = $state(false);
	let confirmDiscardOpen = $state(false);
	let pendingNav = $state<URL | null>(null);
	let confirmedDiscard = $state(false);

	beforeNavigate(({ cancel, to, type }) => {
		if (!dirty || confirmedDiscard) return;
		if (type === 'leave') return;
		if (!to) return;
		cancel();
		pendingNav = to.url;
		confirmDiscardOpen = true;
	});

	function discardAndGo() {
		confirmedDiscard = true;
		confirmDiscardOpen = false;
		const next = pendingNav;
		pendingNav = null;
		if (next) goto(next);
	}

	async function onSaved(bookId: string) {
		confirmedDiscard = true; // success path; bypass beforeNavigate
		await invalidateAll();
		goto(`/library/books/${bookId}`);
	}
</script>

<svelte:head>
	<title>New book — Library — ppp</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
	<a
		href="/library"
		class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> Library
	</a>

	<header class="mt-4 mb-6 flex items-center gap-2 text-muted-foreground">
		<BookOpen class="size-6" />
		<h1 class="text-2xl font-semibold tracking-tight text-foreground">New book</h1>
	</header>

	<BookForm
		mode="create"
		book={null}
		people={data.people}
		personBookCounts={data.personBookCounts}
		categories={data.categories}
		series={data.series}
		{formMessage}
		{onSaved}
		onDirtyChange={(d) => (dirty = d)}
		openLibraryPrefill={olPrefill}
		onOpenLibraryPrefillConsumed={clearOlPrefill}
	/>

	<div class="mt-6">
		<Button
			type="button"
			variant="ghost"
			hotkey="Escape"
			label="Cancel"
			onclick={() => {
				pendingNav = new URL('/library', window.location.origin);
				if (dirty) {
					confirmDiscardOpen = true;
				} else {
					goto('/library');
				}
			}}
		/>
	</div>
</div>

<ConfirmDialog
	bind:open={confirmDiscardOpen}
	title="Discard unsaved changes?"
	description="You have unsaved edits to this book. Leaving will lose them."
	confirmLabel="Discard"
	cancelLabel="Keep editing"
	destructive
	onConfirm={discardAndGo}
/>

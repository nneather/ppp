<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import BookForm from '$lib/components/book-form.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Pencil from '@lucide/svelte/icons/pencil';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const formMessage = $derived.by(() => {
		const f = form as { kind?: string; message?: string } | null;
		if (!f) return null;
		if (f.kind === 'updateBook') return f;
		return null;
	});

	let dirty = $state(false);
	let confirmDiscardOpen = $state(false);
	let pendingNav = $state<URL | null>(null);
	let confirmedDiscard = $state(false);
	let olRefreshOpen = $state(false);

	$effect(() => {
		if (!browser) return;
		if (page.url.searchParams.get('ol') !== '1') return;
		olRefreshOpen = true;
		const u = new URL(page.url.href);
		u.searchParams.delete('ol');
		void goto(`${u.pathname}${u.search}`, { replaceState: true, noScroll: true });
	});

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

	async function onSaved(bookId: string, _opts?: { returnToScanner?: boolean }) {
		confirmedDiscard = true;
		await invalidateAll();
		goto(`/library/books/${bookId}`);
	}

	const detailHref = $derived(`/library/books/${data.book.id}`);
	const titleLabel = $derived(data.book.title?.trim() || '(untitled book)');

	function handleCancel() {
		if (dirty) {
			pendingNav = new URL(detailHref, window.location.origin);
			confirmDiscardOpen = true;
		} else {
			goto(detailHref);
		}
	}
</script>

<svelte:head>
	<title>Edit: {titleLabel} — Library — ppp</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
	<a
		href={detailHref}
		class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> {titleLabel}
	</a>

	<header class="mt-4 mb-6 flex items-center gap-2 text-muted-foreground">
		<Pencil class="size-5" />
		<h1 class="text-2xl font-semibold tracking-tight text-foreground">
			Edit: {#if data.book.title}{data.book.title}{:else}<span class="italic"
					>(untitled book)</span
				>{/if}
		</h1>
	</header>

	<BookForm
		mode="edit"
		book={data.book}
		people={data.people}
		personBookCounts={data.personBookCounts}
		series={data.series}
		bibleBooks={data.bibleBooks}
		{formMessage}
		{onSaved}
		onDirtyChange={(d) => (dirty = d)}
		onCancel={handleCancel}
		bind:olRefreshOpen
	/>
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

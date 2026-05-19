<script lang="ts">
	import { beforeNavigate, goto, invalidate } from '$app/navigation';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import BookForm from '$lib/components/book-form.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import Pencil from '@lucide/svelte/icons/pencil';
	import PageHeader from '$lib/components/page-header.svelte';
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
		await invalidate(`app:library:book:${data.book.id}`);
		await invalidate('app:library:list');
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

{#snippet editBookLead()}
	<Pencil class="size-5" />
{/snippet}

<div class="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
	<PageHeader
		back={{ href: detailHref, label: titleLabel }}
		title={`Edit: ${titleLabel}`}
		titlePlaceholder={!data.book.title?.trim()}
		lead={editBookLead}
		class="mb-6"
	/>

	<BookForm
		mode="edit"
		book={data.book}
		people={data.people}
		personBookCounts={data.personBookCounts}
		series={data.series}
		publishers={data.publishers}
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

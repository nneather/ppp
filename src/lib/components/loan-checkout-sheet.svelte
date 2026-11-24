<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Sheet from '$lib/components/ui/sheet';
	import type { LoanBookHit, LoanContactHit } from '$lib/types/loans';

	let {
		open = $bindable(false),
		initialBooks = [],
		errorMessage = null,
		useHotkey = false
	}: {
		open?: boolean;
		initialBooks?: LoanBookHit[];
		errorMessage?: string | null;
		useHotkey?: boolean;
	} = $props();

	let query = $state('');
	let hits = $state<LoanContactHit[]>([]);
	let selected = $state<LoanContactHit | null>(null);
	let books = $state<LoanBookHit[]>([]);
	let bookQuery = $state('');
	let bookHits = $state<LoanBookHit[]>([]);
	let dueOn = $state('');
	let pending = $state(false);
	let wasOpen = false;
	let contactTimer: ReturnType<typeof setTimeout> | undefined;
	let bookTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (open && !wasOpen) {
			books = initialBooks.map((book) => ({ id: book.id, title: book.title }));
			query = '';
			hits = [];
			selected = null;
			bookQuery = '';
			bookHits = [];
			void loadDefaultDue();
		}
		wasOpen = open;
	});

	async function loadDefaultDue() {
		const res = await fetch('/library/loan-defaults.json');
		if (!res.ok) return;
		const body = (await res.json()) as { dueOn?: string };
		if (body.dueOn) dueOn = body.dueOn;
	}

	function search(value: string) {
		query = value;
		selected = null;
		clearTimeout(contactTimer);
		contactTimer = setTimeout(async () => {
			const q = value.trim();
			if (q.length < 1) {
				hits = [];
				return;
			}
			const res = await fetch(`/library/loan-contacts.json?q=${encodeURIComponent(q)}`);
			if (!res.ok) return;
			hits = (await res.json()) as LoanContactHit[];
		}, 200);
	}

	function searchBooks(value: string) {
		bookQuery = value;
		clearTimeout(bookTimer);
		bookTimer = setTimeout(async () => {
			const q = value.trim();
			if (q.length < 1) {
				bookHits = [];
				return;
			}
			const exclude = books.map((book) => book.id).join(',');
			const res = await fetch(
				`/library/loan-books.json?q=${encodeURIComponent(q)}&exclude=${encodeURIComponent(exclude)}`
			);
			if (!res.ok) return;
			bookHits = (await res.json()) as LoanBookHit[];
		}, 200);
	}

	function addBook(hit: LoanBookHit) {
		if (books.some((book) => book.id === hit.id)) return;
		books = [...books, hit];
		bookQuery = '';
		bookHits = [];
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="bottom" class="max-h-[85dvh] overflow-y-auto">
		<Sheet.Header>
			<Sheet.Title>Check out</Sheet.Title>
			<Sheet.Description>One person, one due date, and every book in this batch.</Sheet.Description>
		</Sheet.Header>
		<form
			method="POST"
			action="?/checkoutBook"
			use:enhance={() => {
				pending = true;
				return async ({ result, update }) => {
					pending = false;
					await update();
					if (result.type === 'success') open = false;
				};
			}}
			class="mt-4 flex flex-col gap-3"
		>
			{#each books as book (book.id)}
				<input type="hidden" name="book_id" value={book.id} />
			{/each}
			<input type="hidden" name="contact_id" value={selected?.id ?? ''} />
			<div class="flex flex-col gap-1.5">
				<Label>Books</Label>
				{#if books.length === 0}
					<p class="text-sm text-muted-foreground">Add at least one book.</p>
				{:else}
					<ul class="flex flex-col gap-1">
						{#each books as book (book.id)}
							<li class="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
								<span class="min-w-0 truncate">{book.title}</span>
								<button
									type="button"
									class="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline"
									onclick={() => (books = books.filter((row) => row.id !== book.id))}
								>
									Remove
								</button>
							</li>
						{/each}
					</ul>
				{/if}
				<Input
					value={bookQuery}
					placeholder="Add another book"
					oninput={(e) => searchBooks(e.currentTarget.value)}
				/>
			</div>
			{#if bookHits.length > 0}
				<ul class="max-h-40 overflow-y-auto rounded-md border border-border">
					{#each bookHits as hit (hit.id)}
						<li>
							<button
								type="button"
								class="flex w-full px-3 py-2 text-left text-sm hover:bg-muted"
								onclick={() => addBook(hit)}
							>
								{hit.title}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			<div class="flex flex-col gap-1.5">
				<Label for="loan-due-on">Due date</Label>
				<Input id="loan-due-on" name="due_on" type="date" bind:value={dueOn} required />
			</div>
			<div class="flex flex-col gap-1.5">
				<Label for="loan-contact-q">Contact</Label>
				<Input
					id="loan-contact-q"
					value={query}
					placeholder="Name or email"
					oninput={(e) => search(e.currentTarget.value)}
				/>
			</div>
			{#if hits.length > 0 && !selected}
				<ul class="max-h-48 overflow-y-auto rounded-md border border-border">
					{#each hits as hit (hit.id)}
						<li>
							<button
								type="button"
								class="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted"
								onclick={() => {
									selected = hit;
									query = hit.name;
									hits = [];
								}}
							>
								<span>{hit.name}</span>
								<span class="text-xs text-muted-foreground">{hit.email ?? 'No email'}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			{#if selected && !selected.email}
				<p class="text-sm text-destructive" role="alert">
					Add an email on this contact before checking a book out.
				</p>
			{/if}
			{#if errorMessage}
				<p class="text-sm text-destructive" role="alert">{errorMessage}</p>
			{/if}
			<div class="flex gap-2">
				<Button
					type="submit"
					hotkey={useHotkey && open ? 's' : undefined}
					label={pending ? 'Checking out…' : 'Check out'}
					disabled={pending || books.length === 0 || !selected?.email || !dueOn}
				/>
				<Button
					type="button"
					variant="outline"
					hotkey={open ? 'Escape' : undefined}
					label="Cancel"
					onclick={() => (open = false)}
				/>
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>

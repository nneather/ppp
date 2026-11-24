<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Sheet from '$lib/components/ui/sheet';
	import type { LoanContactHit } from '$lib/types/loans';

	let {
		open = $bindable(false),
		bookId,
		errorMessage = null
	}: {
		open?: boolean;
		bookId: string;
		errorMessage?: string | null;
	} = $props();

	let query = $state('');
	let hits = $state<LoanContactHit[]>([]);
	let selected = $state<LoanContactHit | null>(null);
	let pending = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function search(value: string) {
		query = value;
		selected = null;
		clearTimeout(timer);
		timer = setTimeout(async () => {
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
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="bottom" class="max-h-[85dvh] overflow-y-auto">
		<Sheet.Header>
			<Sheet.Title>Check out</Sheet.Title>
			<Sheet.Description>Pick a contact who has an email address.</Sheet.Description>
		</Sheet.Header>
		<form
			method="POST"
			action="?/checkoutBook"
			use:enhance={() => {
				pending = true;
				return async ({ update }) => {
					pending = false;
					await update();
				};
			}}
			class="mt-4 flex flex-col gap-3"
		>
			<input type="hidden" name="book_id" value={bookId} />
			<input type="hidden" name="contact_id" value={selected?.id ?? ''} />
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
					hotkey="s"
					label={pending ? 'Checking out…' : 'Check out'}
					disabled={pending || !selected?.email}
				/>
				<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={() => (open = false)} />
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>

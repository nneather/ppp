<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import type { ContactListDef } from '$lib/types/contacts';

	let {
		open = $bindable(false),
		list = null,
		todayYmd,
		errorMessage = null,
		onSaved
	}: {
		open?: boolean;
		list?: ContactListDef | null;
		todayYmd: string;
		errorMessage?: string | null;
		onSaved?: () => void | Promise<void>;
	} = $props();

	let pending = $state(false);
	let touchedOn = $state('');
	let note = $state('');

	$effect(() => {
		if (!open) return;
		touchedOn = todayYmd;
		note = '';
	});

	const onSubmit: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				open = false;
				await onSaved?.();
			}
		};
	};
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Log cards sent</Dialog.Title>
			<Dialog.Description>
				{list ? list.name : 'List'} — stamps a card touch on every live member of households
				on this list. Does not clear due-to-meet.
			</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/logListCards" use:enhance={onSubmit} class="space-y-4">
			<input type="hidden" name="list_id" value={list?.id ?? ''} />
			{#if errorMessage}
				<p class="text-sm text-destructive" role="alert">{errorMessage}</p>
			{/if}
			<div class="space-y-2">
				<Label for="cards_touched_on">Date</Label>
				<Input
					id="cards_touched_on"
					name="touched_on"
					type="date"
					bind:value={touchedOn}
					required
				/>
			</div>
			<div class="space-y-2">
				<Label for="cards_note">Note (optional)</Label>
				<textarea
					id="cards_note"
					name="note"
					bind:value={note}
					rows={3}
					class="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					placeholder="Mailed Christmas cards…"
				></textarea>
			</div>
			<div class="flex justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					hotkey="Escape"
					label="Cancel"
					onclick={() => (open = false)}
				/>
				<Button
					type="submit"
					hotkey="s"
					label={pending ? 'Saving…' : 'Log cards'}
					disabled={pending || !list}
				/>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>

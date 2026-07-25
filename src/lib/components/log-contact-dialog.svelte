<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import type { ContactListRow } from '$lib/types/contacts';

	let {
		open = $bindable(false),
		contact = null,
		todayYmd,
		errorMessage = null,
		onSaved
	}: {
		open?: boolean;
		contact?: ContactListRow | null;
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
			<Dialog.Title>Log contact</Dialog.Title>
			<Dialog.Description>
				{contact ? contact.display_name : 'Contact'} — optional note and backdate.
			</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/logContactDetailed" use:enhance={onSubmit} class="space-y-4">
			<input type="hidden" name="contact_id" value={contact?.id ?? ''} />
			{#if errorMessage}
				<p class="text-sm text-destructive" role="alert">{errorMessage}</p>
			{/if}
			<div class="space-y-2">
				<Label for="touched_on">Date</Label>
				<Input id="touched_on" name="touched_on" type="date" bind:value={touchedOn} required />
			</div>
			<div class="space-y-2">
				<Label for="touch_note">Note (optional)</Label>
				<textarea
					id="touch_note"
					name="note"
					bind:value={note}
					rows={3}
					class="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					placeholder="Coffee, call, dinner…"
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
				<Button type="submit" hotkey="s" label={pending ? 'Saving…' : 'Save touch'} disabled={pending} />
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>

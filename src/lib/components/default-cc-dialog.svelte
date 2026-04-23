<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import EmailChipsEditor from './email-chips-editor.svelte';

	let {
		open = $bindable(false),
		initial,
		errorMessage = null
	}: {
		open: boolean;
		initial: string[];
		errorMessage?: string | null;
	} = $props();

	let pending = $state(false);
	let emails = $state<string[]>([]);

	$effect(() => {
		if (open) emails = [...initial];
	});

	const submitEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update();
			if (result.type === 'success') {
				open = false;
			}
		};
	};
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Default CC emails</Dialog.Title>
			<Dialog.Description>
				These addresses are pre-filled in the CC field every time you send an invoice.
			</Dialog.Description>
		</Dialog.Header>

		{#if errorMessage}
			<p
				class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				role="alert"
			>
				{errorMessage}
			</p>
		{/if}

		<form method="POST" action="?/updateDefaultCc" use:enhance={submitEnhance} class="space-y-4">
			<EmailChipsEditor
				bind:value={emails}
				fieldName="default_cc_emails"
				inputId="default-cc-input"
				label="Email addresses"
				placeholder="cc@example.com"
			/>

			<Dialog.Footer class="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<Button type="button" variant="outline" onclick={() => (open = false)} disabled={pending}>
					Cancel
				</Button>
				<Button type="submit" disabled={pending}>
					{pending ? 'Saving…' : 'Save defaults'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Sheet from '$lib/components/ui/sheet';
	import { EMAIL_VARIABLES } from '$lib/email/variables';
	import type { LoanReminderModel } from '$lib/types/loans';

	let {
		open = $bindable(false),
		reminder,
		errorMessage = null
	}: {
		open?: boolean;
		reminder: LoanReminderModel | null;
		errorMessage?: string | null;
	} = $props();

	let subject = $state('');
	let html = $state('');
	let scheduledFor = $state('');
	let pending = $state(false);
	let insertToken = $state<((token: string) => void) | null>(null);

	$effect(() => {
		if (!open || !reminder) return;
		subject = reminder.subject;
		html = reminder.htmlBody;
		scheduledFor = reminder.scheduledFor;
	});
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="w-full overflow-y-auto sm:max-w-xl">
		<Sheet.Header>
			<Sheet.Title>Next reminder</Sheet.Title>
			<Sheet.Description>This copy is the one that will send. The template stays as it is.</Sheet.Description>
		</Sheet.Header>
		{#if reminder}
			<form
				method="POST"
				action="?/updateLoanReminder"
				use:enhance={() => {
					pending = true;
					return async ({ update }) => {
						pending = false;
						await update();
					};
				}}
				class="mt-4 flex flex-col gap-3"
			>
				<input type="hidden" name="message_id" value={reminder.id} />
				<input type="hidden" name="html_body" value={html} />
				<div class="flex flex-col gap-1.5">
					<Label for="reminder-date">Send on</Label>
					<Input id="reminder-date" type="date" name="scheduled_for" bind:value={scheduledFor} />
				</div>
				<div class="flex flex-col gap-1.5">
					<Label for="reminder-subject">Subject</Label>
					<Input id="reminder-subject" name="subject" bind:value={subject} />
				</div>
				{#if open}
					{#await import('$lib/components/email-body-editor.svelte') then Editor}
						<Editor.default bind:html onReady={(insert) => (insertToken = insert)} />
					{/await}
				{/if}
				<div class="flex flex-wrap gap-1">
					{#each EMAIL_VARIABLES as variable (variable.token)}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => insertToken?.(`{{${variable.token}}}`)}
						>
							{variable.label}
						</Button>
					{/each}
				</div>
				{#if errorMessage}
					<p class="text-sm text-destructive" role="alert">{errorMessage}</p>
				{/if}
				<div class="flex gap-2">
					<Button type="submit" hotkey="s" label={pending ? 'Saving…' : 'Save reminder'} disabled={pending} />
					<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={() => (open = false)} />
				</div>
			</form>
		{/if}
	</Sheet.Content>
</Sheet.Root>

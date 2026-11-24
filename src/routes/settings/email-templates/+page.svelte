<script lang="ts">
	import { enhance } from '$app/forms';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { LIBRARY_LOAN_CHECKOUT_KEY, LIBRARY_LOAN_REMINDER_KEY } from '$lib/email/variables';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let deleteOpen = $state(false);
	let deleteId = $state<string | null>(null);
	let deleteForm = $state<HTMLFormElement | null>(null);

	const message = $derived(
		form && 'message' in form && form.success !== true ? (form.message ?? null) : null
	);

	function roleFor(templateId: string): string {
		const keys = data.bindings.filter((b) => b.template_id === templateId).map((b) => b.binding_key);
		const labels = [];
		if (keys.includes(LIBRARY_LOAN_CHECKOUT_KEY)) labels.push('Checkout');
		if (keys.includes(LIBRARY_LOAN_REMINDER_KEY)) labels.push('Reminder');
		return labels.join(' · ');
	}
</script>

<svelte:head>
	<title>Email templates — Settings — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
	<a href="/settings" class="text-sm text-muted-foreground underline underline-offset-2">Settings</a>
	<h1 class="mt-4 text-2xl font-semibold tracking-tight">Email templates</h1>
	<p class="mt-1 text-sm text-muted-foreground">
		Folders, HTML blocks, and merge fields. Editing a template changes future emails only.
	</p>

	{#if data.notOwner}
		<div class="mt-6 rounded-xl border border-border bg-muted/30 px-4 py-6 text-sm" role="alert">
			<p class="font-medium">Owner-only page</p>
			<p class="mt-1 text-muted-foreground">Only the workspace owner can edit email templates.</p>
		</div>
	{:else}
		{#if message}
			<p class="mt-4 text-sm text-destructive" role="alert">{message}</p>
		{/if}

		{#each data.folders as folder (folder.id)}
			<section class="mt-6">
				<h2 class="text-sm font-medium">{folder.name}</h2>
				<ul class="mt-2 flex flex-col gap-2">
					{#each data.templates.filter((t) => t.folder_id === folder.id) as template (template.id)}
						<li class="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
							<a href="/settings/email-templates/{template.id}" class="min-w-0">
								<span class="block font-medium">{template.name}</span>
								<span class="block truncate text-xs text-muted-foreground">
									{template.subject || 'No subject'}{roleFor(template.id) ? ` · ${roleFor(template.id)}` : ''}
								</span>
							</a>
							<Button
								type="button"
								variant="outline"
								size="sm"
								class="text-destructive"
								onclick={() => {
									deleteId = template.id;
									deleteOpen = true;
								}}
							>
								Delete
							</Button>
						</li>
					{/each}
				</ul>
			</section>
		{/each}

		{#if data.templates.some((t) => t.folder_id == null)}
			<section class="mt-6">
				<h2 class="text-sm font-medium">No folder</h2>
				<ul class="mt-2 flex flex-col gap-2">
					{#each data.templates.filter((t) => t.folder_id == null) as template (template.id)}
						<li>
							<a href="/settings/email-templates/{template.id}" class="underline">{template.name}</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<form method="POST" action="?/createTemplate" use:enhance class="mt-8 flex flex-col gap-3 rounded-xl border border-border p-4">
			<h2 class="text-sm font-medium">New template</h2>
			<div class="flex flex-col gap-1.5">
				<Label for="template-name">Name</Label>
				<Input id="template-name" name="name" required />
			</div>
			<div class="flex flex-col gap-1.5">
				<Label for="template-folder">Folder</Label>
				<select id="template-folder" name="folder_id" class="h-9 rounded-md border border-input bg-background px-2 text-sm">
					<option value="">None</option>
					{#each data.folders as folder (folder.id)}
						<option value={folder.id}>{folder.name}</option>
					{/each}
				</select>
			</div>
			<Button type="submit" hotkey="s" label="Save template" class="w-fit" />
		</form>

		<form method="POST" action="?/createFolder" use:enhance class="mt-4 flex items-end gap-2">
			<div class="flex flex-col gap-1.5">
				<Label for="folder-name">New folder</Label>
				<Input id="folder-name" name="name" />
			</div>
			<Button type="submit" variant="outline">Add folder</Button>
		</form>

		<form method="POST" action="?/deleteTemplate" use:enhance bind:this={deleteForm} class="hidden">
			<input type="hidden" name="id" value={deleteId ?? ''} />
		</form>
		<ConfirmDialog
			bind:open={deleteOpen}
			title="Delete this template?"
			description="Queued emails keep the copy they already have. A template that is the checkout or reminder email cannot be deleted until another one takes that role."
			confirmLabel="Delete"
			destructive
			onConfirm={() => deleteForm?.requestSubmit()}
		/>
	{/if}
</div>

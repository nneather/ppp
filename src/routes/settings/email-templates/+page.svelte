<script lang="ts">
	import { enhance } from '$app/forms';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { EMAIL_TEMPLATE_USES, emailUseLabel } from '$lib/email/variables';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let deleteOpen = $state(false);
	let deleteId = $state<string | null>(null);
	let deleteForm = $state<HTMLFormElement | null>(null);

	const message = $derived(
		form && 'message' in form && form.success !== true ? (form.message ?? null) : null
	);

	const savedKey = $derived(
		form && 'bindingKey' in form && form.success === true ? form.bindingKey : null
	);

	function rolesFor(templateId: string): string[] {
		return data.bindings
			.filter((b) => b.template_id === templateId)
			.map((b) => emailUseLabel(b.binding_key));
	}
</script>

<svelte:head>
	<title>Email templates — Settings — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
	<a href="/settings" class="text-sm text-muted-foreground underline underline-offset-2">Settings</a>
	<h1 class="mt-4 text-2xl font-semibold tracking-tight">Email templates</h1>
	<p class="mt-1 text-sm text-muted-foreground">
		The words in the checkout, reminder, and invoice emails. A change applies to future sends. Emails already queued keep their old copy.
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

		<section class="mt-6 rounded-xl border border-border">
			<div class="border-b border-border px-4 py-3">
				<h2 class="text-sm font-medium">When books are due</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					Checkout starts from these. You can still move one book's due date later.
				</p>
			</div>
			<form method="POST" action="?/updateLoanDefaults" use:enhance class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-end">
				<div class="flex flex-col gap-1">
					<Label for="loan-due-days">Books are due after</Label>
					<div class="flex items-center gap-2">
						<Input
							id="loan-due-days"
							name="loan_due_days"
							type="number"
							min="1"
							max="366"
							value={data.loanDueDays}
							class="w-24"
						/>
						<span class="text-sm text-muted-foreground">days</span>
					</div>
				</div>
				<div class="flex flex-col gap-1">
					<Label for="loan-lead-days">Remind this many days before</Label>
					<Input
						id="loan-lead-days"
						name="loan_reminder_lead_days"
						type="number"
						min="0"
						max="60"
						value={data.loanReminderLeadDays}
						class="w-24"
					/>
				</div>
				<Button type="submit" variant="outline" label="Save" />
			</form>
		</section>

		<section class="mt-6 rounded-xl border border-border">
			<div class="border-b border-border px-4 py-3">
				<h2 class="text-sm font-medium">Which template each email uses</h2>
				<p class="mt-1 text-sm text-muted-foreground">Changing a menu saves.</p>
			</div>
			<ul>
				{#each EMAIL_TEMPLATE_USES as use (use.key)}
					{@const current = data.bindings.find((b) => b.binding_key === use.key)?.template_id ?? ''}
					<li class="border-b border-border px-4 py-3 last:border-b-0">
						<form method="POST" action="?/assignUse" use:enhance class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<input type="hidden" name="binding_key" value={use.key} />
							<div class="min-w-0">
								<Label for="use-{use.key}">{use.label}</Label>
								<p class="text-xs text-muted-foreground">{use.detail}</p>
							</div>
							<div class="flex items-center gap-2">
								<select
									id="use-{use.key}"
									name="template_id"
									class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm sm:w-52"
									onchange={(event) => event.currentTarget.form?.requestSubmit()}
								>
									{#each data.templates as template (template.id)}
										<option value={template.id} selected={template.id === current}>{template.name}</option>
									{/each}
								</select>
								<button type="submit" class="sr-only">Save {use.label}</button>
								{#if savedKey === use.key}
									<span class="text-xs text-muted-foreground">Saved</span>
								{/if}
							</div>
						</form>
					</li>
				{/each}
			</ul>
		</section>

		<h2 class="mt-8 text-sm font-medium">Templates</h2>

		{#each data.folders as folder (folder.id)}
			<section class="mt-4">
				<h3 class="text-sm text-muted-foreground">{folder.name}</h3>
				<ul class="mt-2 flex flex-col gap-2">
					{#each data.templates.filter((t) => t.folder_id === folder.id) as template (template.id)}
						<li class="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2">
							<a href="/settings/email-templates/{template.id}" class="min-w-0 flex-1">
								<span class="block font-medium">{template.name}</span>
								<span class="block truncate text-xs text-muted-foreground">{template.subject || 'No subject'}</span>
								{#if rolesFor(template.id).length > 0}
									<span class="mt-1 flex flex-wrap gap-1">
										{#each rolesFor(template.id) as role (role)}
											<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{role}</span>
										{/each}
									</span>
								{/if}
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
			description="Emails already queued keep their copy. If this template is still chosen above, pick another one for that email before deleting it."
			confirmLabel="Delete"
			destructive
			onConfirm={() => deleteForm?.requestSubmit()}
		/>
	{/if}
</div>

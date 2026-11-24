<script lang="ts">
	import { enhance } from '$app/forms';
	import EmailBodyEditor from '$lib/components/email-body-editor.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { renderEmailTemplate } from '$lib/email/render';
	import { sanitizeEmailHtml } from '$lib/email/sanitize';
	import { EMAIL_VARIABLES } from '$lib/email/variables';
	import { ownerFirstName } from '$lib/email/render';
	import type { EmailMergeValues } from '$lib/email/render';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let name = $state('');
	let subject = $state('');
	let html = $state('');
	let folderId = $state('');
	let previewId = $state('sample');
	let insertToken = $state<((token: string) => void) | null>(null);
	let subjectFocused = $state(false);
	let seededId = $state('');

	$effect(() => {
		if (data.notOwner || seededId === data.template.id) return;
		seededId = data.template.id;
		name = data.template.name;
		subject = data.template.subject;
		html = data.template.html_body;
		folderId = data.template.folder_id ?? '';
	});

	const sample = $derived<EmailMergeValues>({
		'contact.first_name': 'Alex',
		'contact.last_name': 'Kim',
		'contact.full_name': 'Alex Kim',
		'book.title': 'The Institutes of the Christian Religion',
		'book.authors': 'John Calvin',
		'loan.checked_out_on': 'Nov 24, 2026',
		'loan.due_on': 'Dec 24, 2026',
		'loan.days_out': '30',
		'client.name': 'Covenant Seminary',
		'invoice.number': '2026-014',
		'invoice.period': 'Nov 1, 2026 – Nov 30, 2026',
		'invoice.total': '$1,200.00',
		'invoice.message': 'Please see the attached invoice.',
		'owner.first_name': data.notOwner ? 'Parker' : ownerFirstName(data.ownerFullName)
	});

	const previewValues = $derived.by(() => {
		if (previewId === 'sample' || data.notOwner) return sample;
		const loan = data.previews.find((p) => p.id === previewId)?.values;
		return loan ? { ...sample, ...loan } : sample;
	});
	const previewHtml = $derived(
		sanitizeEmailHtml(renderEmailTemplate(html, previewValues, { html: true }))
	);
	const previewSubject = $derived(renderEmailTemplate(subject, previewValues));
	const message = $derived(
		form && 'message' in form && form.success !== true ? (form.message ?? null) : null
	);
	const saved = $derived(form && 'success' in form && form.success === true);

	function insert(token: string) {
		const wrapped = `{{${token}}}`;
		if (subjectFocused) subject += wrapped;
		else insertToken?.(wrapped);
	}
</script>

<svelte:head>
	<title>{data.notOwner ? 'Email template' : data.template.name} — Settings — ppp</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
	<a href="/settings/email-templates" class="text-sm text-muted-foreground underline underline-offset-2">Email templates</a>
	{#if data.notOwner}
		<div class="mt-6 rounded-xl border border-border bg-muted/30 px-4 py-6 text-sm" role="alert">
			<p class="font-medium">Owner-only page</p>
		</div>
	{:else}
		<form method="POST" action="?/save" use:enhance class="mt-4 grid gap-6 lg:grid-cols-2">
			<div class="flex flex-col gap-3">
				<input type="hidden" name="id" value={data.template.id} />
				<input type="hidden" name="html_body" value={html} />
				<div class="flex flex-col gap-1.5">
					<Label for="tpl-name">Name</Label>
					<Input id="tpl-name" name="name" bind:value={name} />
				</div>
				<div class="flex flex-col gap-1.5">
					<Label for="tpl-folder">Folder</Label>
					<select id="tpl-folder" name="folder_id" bind:value={folderId} class="h-9 rounded-md border border-input bg-background px-2 text-sm">
						<option value="">None</option>
						{#each data.folders as folder (folder.id)}
							<option value={folder.id}>{folder.name}</option>
						{/each}
					</select>
				</div>
				<div class="flex flex-col gap-1.5">
					<Label for="tpl-subject">Subject</Label>
					<Input
						id="tpl-subject"
						name="subject"
						bind:value={subject}
						onfocus={() => (subjectFocused = true)}
						onblur={() => (subjectFocused = false)}
					/>
				</div>
				<EmailBodyEditor bind:html onReady={(insertFn) => (insertToken = insertFn)} />
				<div class="flex flex-wrap gap-1">
					{#each EMAIL_VARIABLES as variable (variable.token)}
						<Button type="button" variant="outline" size="sm" onclick={() => insert(variable.token)}>
							{variable.group}: {variable.label}
						</Button>
					{/each}
				</div>
				<p class="text-sm text-muted-foreground">
					{#if data.uses.length > 0}
						Used for {data.uses.join(', ')}.
					{:else}
						Not assigned to a send.
					{/if}
					<a href="/settings/email-templates" class="underline underline-offset-2">Change that on the templates page.</a>
				</p>
				{#if message}<p class="text-sm text-destructive" role="alert">{message}</p>{/if}
				{#if saved}<p class="text-sm text-muted-foreground">Saved.</p>{/if}
				<Button type="submit" hotkey="s" label="Save template" class="w-fit" />
			</div>
			<div>
				<Label for="preview-as">Preview</Label>
				<select id="preview-as" bind:value={previewId} class="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
					<option value="sample">Sample</option>
					{#each data.previews as preview (preview.id)}
						<option value={preview.id}>{preview.label}</option>
					{/each}
				</select>
				<p class="mt-3 text-sm font-medium">{previewSubject}</p>
				<div class="email-preview mt-2 rounded-md border border-border p-3 text-sm">{@html previewHtml}</div>
			</div>
		</form>
	{/if}
</div>

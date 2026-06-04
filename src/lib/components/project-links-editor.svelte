<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { ProjectLinkRow } from '$lib/types/projects';

	let {
		projectId,
		links,
		onChanged
	}: {
		projectId: string;
		links: ProjectLinkRow[];
		onChanged?: () => void | Promise<void>;
	} = $props();

	let newUrl = $state('');
	let newLabel = $state('');
	let pending = $state(false);

	const enhanceLinks: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update();
			if (result.type === 'success') {
				newUrl = '';
				newLabel = '';
				await onChanged?.();
			}
		};
	};

	function moveLink(index: number, direction: -1 | 1) {
		const next = index + direction;
		if (next < 0 || next >= links.length) return;
		const ordered = [...links];
		const tmp = ordered[index];
		ordered[index] = ordered[next];
		ordered[next] = tmp;
		const form = document.getElementById(`reorder-links-${projectId}`) as HTMLFormElement | null;
		const input = form?.querySelector('input[name="ordered_ids"]') as HTMLInputElement | null;
		if (input && form) {
			input.value = JSON.stringify(ordered.map((l) => l.id));
			form.requestSubmit();
		}
	}
</script>

<div class="space-y-3 border-t border-border pt-4">
	<Label class="text-base">Links</Label>
	<p class="text-xs text-muted-foreground">Reference URLs for this project (dossier, docs, repos).</p>

	{#if links.length === 0}
		<p class="text-sm text-muted-foreground italic">No links yet.</p>
	{:else}
		<ul class="space-y-2">
			{#each links as link, i (link.id)}
				<li class="rounded-lg border border-border p-2">
					<form
						method="POST"
						action="?/updateProjectLink"
						use:enhance={enhanceLinks}
						class="flex flex-col gap-2"
					>
						<input type="hidden" name="id" value={link.id} />
						<input type="hidden" name="project_id" value={projectId} />
						<Input name="url" type="url" value={link.url} required />
						<Input name="label" type="text" placeholder="Label (optional)" value={link.label ?? ''} />
						<div class="flex flex-wrap gap-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={i === 0 || pending}
								aria-label="Move up"
								onclick={() => moveLink(i, -1)}
							>
								<ChevronUp class="size-4" />
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={i === links.length - 1 || pending}
								aria-label="Move down"
								onclick={() => moveLink(i, 1)}
							>
								<ChevronDown class="size-4" />
							</Button>
							<Button type="submit" size="sm" variant="secondary" disabled={pending}>Save</Button>
						</div>
					</form>
					<form method="POST" action="?/deleteProjectLink" use:enhance={enhanceLinks} class="mt-1">
						<input type="hidden" name="id" value={link.id} />
						<input type="hidden" name="project_id" value={projectId} />
						<Button
							type="submit"
							variant="ghost"
							size="sm"
							class="text-destructive hover:text-destructive gap-1"
							disabled={pending}
						>
							<Trash2 class="size-3.5" />
							Remove
						</Button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	<form
		id="reorder-links-{projectId}"
		method="POST"
		action="?/reorderProjectLinks"
		use:enhance={enhanceLinks}
		class="hidden"
	>
		<input type="hidden" name="project_id" value={projectId} />
		<input type="hidden" name="ordered_ids" value="" />
	</form>

	<form
		method="POST"
		action="?/createProjectLink"
		use:enhance={enhanceLinks}
		class="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3"
	>
		<input type="hidden" name="project_id" value={projectId} />
		<Input name="url" type="url" placeholder="https://…" bind:value={newUrl} required />
		<Input name="label" type="text" placeholder="Label (optional)" bind:value={newLabel} />
		<Button type="submit" size="sm" variant="outline" disabled={pending}>Add link</Button>
	</form>
</div>

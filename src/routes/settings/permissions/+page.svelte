<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import type { PageProps } from './$types';
	import { MODULE_SLUGS, type ModuleSlug } from './module-slugs';

	let { data, form }: PageProps = $props();

	const moduleLabels: Record<ModuleSlug, string> = {
		library: 'Library',
		invoicing: 'Invoicing',
		calendar: 'Calendar',
		projects: 'Projects'
	};

	const enhanceRow: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') await invalidateAll();
		};
	};

	const err = $derived(
		form && 'kind' in form && form.kind === 'upsertPermission' && form.success !== true
			? (form.message ?? null)
			: null
	);
</script>

<svelte:head>
	<title>Permissions — Settings — ppp</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
	<a
		href="/settings"
		class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> Settings
	</a>

	<h1 class="mt-4 text-2xl font-semibold tracking-tight text-foreground">Viewer permissions</h1>
	<p class="mt-1 text-sm text-muted-foreground">
		Control module access for each viewer. Library changes take effect on the viewer’s next page load.
		Other modules store preferences for when those surfaces gain viewer RLS.
	</p>

	{#if data.loadError}
		<p class="mt-4 text-sm text-destructive" role="alert">{data.loadError}</p>
	{:else if data.viewers.length === 0}
		<p class="mt-6 text-sm text-muted-foreground">
			No viewer accounts yet. Invite a collaborator with the viewer role, then return here to grant access.
		</p>
	{:else}
		<div class="mt-8 overflow-x-auto rounded-xl border border-border">
			<table class="min-w-full divide-y divide-border text-sm">
				<thead class="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
					<tr>
						<th class="px-3 py-2">Viewer</th>
						{#each MODULE_SLUGS as mod (mod)}
							<th class="px-3 py-2">{moduleLabels[mod]}</th>
						{/each}
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each data.viewers as v (v.id)}
						<tr>
							<td class="px-3 py-2">
								<div class="font-medium text-foreground">{v.email}</div>
								{#if v.full_name?.trim()}
									<div class="text-xs text-muted-foreground">{v.full_name}</div>
								{/if}
							</td>
							{#each MODULE_SLUGS as mod (mod)}
								<td class="px-3 py-2">
									<form method="POST" action="?/upsertPermission" use:enhance={enhanceRow}>
										<input type="hidden" name="user_id" value={v.id} />
										<input type="hidden" name="module" value={mod} />
										<Label class="sr-only" for="perm-{v.id}-{mod}">{moduleLabels[mod]} for {v.email}</Label>
										<select
											id="perm-{v.id}-{mod}"
											name="access_level"
											value={data.matrix[v.id][mod]}
											class="h-9 w-full min-w-[7rem] rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
											onchange={(e) => e.currentTarget.form?.requestSubmit()}
										>
											<option value="none">None</option>
											<option value="read">Read</option>
											<option value="write">Write</option>
										</select>
									</form>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if err}
		<p class="mt-4 text-sm text-destructive" role="alert">{err}</p>
	{/if}

	<p class="mt-8">
		<Button href="/settings" variant="outline">Back to settings</Button>
	</p>
</div>

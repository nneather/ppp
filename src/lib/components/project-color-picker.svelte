<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { cn } from '$lib/utils';
	import {
		PROJECT_COLOR_KEYS,
		PROJECT_COLOR_LABELS,
		PROJECT_COLOR_DOT_CLASS,
		parseProjectColorKey,
		type ProjectColorKey
	} from '$lib/projects/project-colors';

	let {
		projectId,
		projectName,
		color = null,
		open = $bindable(false),
		onSaved
	}: {
		projectId: string;
		projectName: string;
		color?: string | null;
		open?: boolean;
		onSaved?: () => void | Promise<void>;
	} = $props();

	const currentKey = $derived(parseProjectColorKey(color));

	const submitEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update();
			if (result.type === 'success') {
				open = false;
				await onSaved?.();
			}
		};
	};

	function swatchClass(key: ProjectColorKey | null): string {
		if (!key) return 'bg-muted ring-1 ring-border';
		return PROJECT_COLOR_DOT_CLASS[key];
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Domain color</Dialog.Title>
			<Dialog.Description>
				Choose a color for {projectName}. Child projects inherit the accent.
			</Dialog.Description>
		</Dialog.Header>

		<div class="grid grid-cols-4 gap-2 py-2">
			{#each PROJECT_COLOR_KEYS as key (key)}
				<form method="POST" action="?/setProjectColor" use:enhance={submitEnhance}>
					<input type="hidden" name="id" value={projectId} />
					<input type="hidden" name="color" value={key} />
					<button
						type="submit"
						class={cn(
							'flex w-full flex-col items-center gap-1 rounded-lg p-2 hover:bg-muted',
							currentKey === key && 'ring-2 ring-ring'
						)}
						aria-label={PROJECT_COLOR_LABELS[key]}
						aria-pressed={currentKey === key}
					>
						<span class={cn('size-8 rounded-full', swatchClass(key))} aria-hidden="true"></span>
						<span class="text-[0.65rem] text-muted-foreground">{PROJECT_COLOR_LABELS[key]}</span>
					</button>
				</form>
			{/each}
		</div>

		<div class="flex justify-between gap-2 border-t border-border pt-3">
			<form method="POST" action="?/setProjectColor" use:enhance={submitEnhance}>
				<input type="hidden" name="id" value={projectId} />
				<input type="hidden" name="color" value="__none__" />
				<Button type="submit" variant="outline" size="sm" disabled={currentKey == null}>
					Clear
				</Button>
			</form>
			<Button type="button" variant="outline" size="sm" hotkey="Escape" label="Cancel" onclick={() => (open = false)} />
		</div>
	</Dialog.Content>
</Dialog.Root>

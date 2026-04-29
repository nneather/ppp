<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		destructive = false,
		pending = false,
		body,
		onConfirm,
		onCancel
	}: {
		open: boolean;
		title: string;
		description?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		destructive?: boolean;
		pending?: boolean;
		body?: Snippet;
		onConfirm: () => void;
		onCancel?: () => void;
	} = $props();

	function handleCancel() {
		if (pending) return;
		open = false;
		onCancel?.();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			{#if description}
				<Dialog.Description>{description}</Dialog.Description>
			{/if}
		</Dialog.Header>
		{#if body}
			<div class="text-sm text-muted-foreground">
				{@render body()}
			</div>
		{/if}
		<Dialog.Footer class="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
			<Button
				type="button"
				variant="outline"
				onclick={handleCancel}
				disabled={pending}
				hotkey="Escape"
				label={cancelLabel}
			/>
			<Button
				type="button"
				variant={destructive ? 'destructive' : 'default'}
				onclick={onConfirm}
				disabled={pending}
				hotkey={destructive ? 'd' : 's'}
				label={pending ? 'Working…' : confirmLabel}
			/>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

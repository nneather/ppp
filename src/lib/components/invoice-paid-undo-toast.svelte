<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	let {
		invoiceId,
		invoiceNumber,
		pending = false,
		liftForFab = false,
		onDismiss,
		enhanceUndo
	}: {
		invoiceId: string;
		invoiceNumber: string;
		pending?: boolean;
		/** Lift above the invoices-list Generate FAB on mobile. */
		liftForFab?: boolean;
		onDismiss: () => void;
		enhanceUndo: SubmitFunction;
	} = $props();
</script>

<div
	class={cn(
		'fixed inset-x-0 z-50 mx-auto flex w-full max-w-sm items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg md:bottom-6',
		liftForFab
			? 'bottom-[calc(9rem+env(safe-area-inset-bottom,0px))]'
			: 'bottom-tabbar'
	)}
	role="status"
>
	<span class="min-w-0 flex-1 truncate text-muted-foreground">
		{invoiceNumber} marked paid
	</span>
	<form method="POST" action="?/unmarkPaid" use:enhance={enhanceUndo} class="shrink-0">
		<input type="hidden" name="invoice_id" value={invoiceId} />
		<Button type="submit" size="sm" variant="outline" disabled={pending} class="gap-1">
			<Undo2 class="size-3.5" /> {pending ? 'Undoing…' : 'Undo'}
		</Button>
	</form>
	<Button type="button" size="sm" variant="ghost" onclick={onDismiss} label="Dismiss" />
</div>

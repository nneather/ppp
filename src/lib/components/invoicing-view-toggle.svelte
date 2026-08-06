<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		active
	}: {
		active: 'time' | 'invoices' | 'analytics';
	} = $props();
</script>

<div
	class="inline-flex rounded-md border border-border p-0.5 text-xs font-medium"
	role="group"
	aria-label="Invoicing view"
>
	<a
		href="/invoicing"
		class={cn(
			'rounded-sm px-3 py-1.5 transition-colors',
			active === 'time'
				? 'bg-foreground text-background'
				: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
		)}
		aria-current={active === 'time' ? 'page' : undefined}
	>
		Time
	</a>
	<a
		href="/invoicing/invoices"
		class={cn(
			'rounded-sm px-3 py-1.5 transition-colors',
			active === 'invoices'
				? 'bg-foreground text-background'
				: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
		)}
		aria-current={active === 'invoices' ? 'page' : undefined}
	>
		Invoices
	</a>
	<a
		href="/invoicing/analytics"
		class={cn(
			'rounded-sm px-3 py-1.5 transition-colors',
			active === 'analytics'
				? 'bg-foreground text-background'
				: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
		)}
		aria-current={active === 'analytics' ? 'page' : undefined}
	>
		Analytics
	</a>
</div>

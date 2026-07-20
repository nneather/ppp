<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		active
	}: {
		active: 'list' | 'by-book';
	} = $props();
</script>

<div
	class="inline-flex rounded-md border border-border p-0.5 text-xs font-medium"
	role="group"
	aria-label="Sermons view"
>
	<a
		href="/sermons"
		class={cn(
			'rounded-sm px-3 py-1.5 transition-colors',
			active === 'list'
				? 'bg-foreground text-background'
				: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
		)}
		aria-current={active === 'list' ? 'page' : undefined}
	>
		List
	</a>
	<a
		href="/sermons/by-book"
		class={cn(
			'rounded-sm px-3 py-1.5 transition-colors',
			active === 'by-book'
				? 'bg-foreground text-background'
				: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
		)}
		aria-current={active === 'by-book' ? 'page' : undefined}
	>
		By book
	</a>
</div>

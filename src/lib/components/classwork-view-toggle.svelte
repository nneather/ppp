<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		active
	}: {
		active: 'assignments' | 'papers';
	} = $props();
</script>

<div
	class="inline-flex rounded-md border border-border p-0.5 text-xs font-medium"
	role="group"
	aria-label="Classwork view"
>
	<a
		href="/classwork"
		class={cn(
			'rounded-sm px-3 py-1.5 transition-colors',
			active === 'assignments'
				? 'bg-foreground text-background'
				: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
		)}
		aria-current={active === 'assignments' ? 'page' : undefined}
	>
		Assignments
	</a>
	<a
		href="/classwork/papers"
		class={cn(
			'rounded-sm px-3 py-1.5 transition-colors',
			active === 'papers'
				? 'bg-foreground text-background'
				: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
		)}
		aria-current={active === 'papers' ? 'page' : undefined}
	>
		Papers
	</a>
</div>

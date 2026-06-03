<script lang="ts">
	import { cn } from '$lib/utils.js';

	type Props = {
		module: 'dashboard' | 'invoicing' | 'library' | 'projects' | 'settings' | 'generic';
		class?: string;
	};

	let { module, class: className }: Props = $props();
</script>

<div
	class={cn('animate-pulse space-y-4 p-4 md:p-6', className)}
	role="status"
	aria-busy="true"
	aria-label="Loading page"
>
	<div class="h-8 w-40 rounded-md bg-muted"></div>
	{#if module === 'library'}
		<div class="h-10 w-full rounded-md bg-muted"></div>
		<div class="space-y-2">
			{#each { length: 8 } as _, i (i)}
				<div class="h-16 rounded-lg bg-muted/80"></div>
			{/each}
		</div>
	{:else if module === 'invoicing'}
		<div class="h-10 w-full max-w-md rounded-md bg-muted"></div>
		<div class="space-y-2">
			{#each { length: 6 } as _, i (i)}
				<div class="h-12 rounded-lg bg-muted/80"></div>
			{/each}
		</div>
	{:else}
		<div class="space-y-2">
			{#each { length: 4 } as _, i (i)}
				<div class="h-12 rounded-lg bg-muted/80"></div>
			{/each}
		</div>
	{/if}
</div>

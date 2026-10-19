<script lang="ts">
	import StudiesNav from '$lib/components/studies-nav.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<div class="mx-auto max-w-3xl px-4 pt-4 md:px-6">
	<StudiesNav />
</div>
{@render children()}

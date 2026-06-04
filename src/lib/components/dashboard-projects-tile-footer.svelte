<script lang="ts">
	type Props = {
		attentionCount: number;
	};

	let { attentionCount }: Props = $props();
</script>

<div class="border-t border-border px-5 pb-4 pt-3">
	<a
		href="/projects?health=attention"
		class="block text-sm text-muted-foreground hover:text-foreground"
	>
		{#if attentionCount === 0}
			<span>No projects need attention</span>
		{:else if attentionCount === 1}
			<span>
				<span class="font-medium text-foreground">1</span> project needs attention
			</span>
		{:else}
			<span>
				<span class="font-medium text-foreground">{attentionCount}</span> projects need attention
			</span>
		{/if}
	</a>
</div>

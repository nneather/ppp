<script lang="ts">
	type Props = {
		needsReviewCount: number;
	};

	let { needsReviewCount }: Props = $props();
</script>

{#if needsReviewCount > 0}
	<div class="border-t border-border px-4 pb-3 pt-2.5 md:px-5 md:pb-4 md:pt-3">
		<a
			href="/library?needs_review=true"
			class="block text-sm font-medium text-primary underline-offset-4 hover:underline"
		>
			{needsReviewCount === 1 ? '1 book needs review' : `${needsReviewCount} books need review`}
		</a>
	</div>
{/if}

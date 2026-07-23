<script lang="ts">
	import { formatYmdMediumChicago } from '$lib/invoicing/chicago-date';
	import {
		CONTEXT_TYPE_SHORT,
		type DashboardSermonRow
	} from '$lib/types/sermons';

	let {
		sermons
	}: {
		sermons: DashboardSermonRow[];
	} = $props();
</script>

<section
	class="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm md:p-5"
	aria-labelledby="upcoming-sermons-heading"
>
	<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
		<h2
			id="upcoming-sermons-heading"
			class="text-sm font-semibold tracking-tight text-foreground"
		>
			Upcoming sermons
		</h2>
		<a
			href="/sermons"
			class="text-sm font-medium text-primary underline-offset-4 hover:underline"
		>
			All sermons
		</a>
	</div>

	{#if sermons.length === 0}
		<p class="text-sm text-muted-foreground">
			No sermons scheduled from today onward.
			<a href="/sermons" class="font-medium text-primary underline-offset-4 hover:underline"
				>Log a sermon</a
			>
		</p>
	{:else}
		<ul class="divide-y divide-border">
			{#each sermons as sermon (sermon.id)}
				<li class="py-2.5 first:pt-0 last:pb-0">
					<a
						href="/sermons"
						class="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
							{formatYmdMediumChicago(sermon.preached_on)}
							{#if sermon.context_type}
								<span class="ml-1.5 normal-case tracking-normal"
									>· {CONTEXT_TYPE_SHORT[sermon.context_type]}</span
								>
							{/if}
						</p>
						<p class="mt-0.5 text-sm font-medium text-foreground">
							{sermon.passage_display?.trim() ||
								sermon.topic?.trim() ||
								'Untitled sermon'}
						</p>
						{#if sermon.venue_name || (sermon.topic?.trim() && sermon.passage_display?.trim())}
							<p class="mt-0.5 text-xs text-muted-foreground">
								{#if sermon.venue_name}{sermon.venue_name}{/if}
								{#if sermon.venue_name && sermon.topic?.trim() && sermon.passage_display?.trim()}
									<span aria-hidden="true"> · </span>
								{/if}
								{#if sermon.topic?.trim() && sermon.passage_display?.trim()}{sermon.topic.trim()}{/if}
							</p>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

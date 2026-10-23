<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { SPORTS_LEAGUE_LABELS, type SportsTeamRow } from '$lib/types/sports';
	import { cn } from '$lib/utils';
	import Star from '@lucide/svelte/icons/star';

	let { teams, isOwner }: { teams: SportsTeamRow[]; isOwner: boolean } = $props();
</script>

<ul class="divide-y divide-border rounded-xl border border-border">
	{#each teams as t (t.id)}
		<li class="flex items-center gap-3 px-3 py-2">
			{#if t.logo_url}
				<img src={t.logo_url} alt="" class="size-7 shrink-0 object-contain" />
			{:else}
				<span class="size-7 shrink-0 rounded-full bg-muted"></span>
			{/if}
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium text-foreground">{t.display_name}</p>
				<p class="text-xs text-muted-foreground">
					{SPORTS_LEAGUE_LABELS[t.league]}
					{#if t.abbreviation}
						· {t.abbreviation}
					{/if}
				</p>
			</div>
			{#if isOwner}
				<form
					method="POST"
					action="?/toggleFollowed"
					use:enhance={() => {
						return async ({ update }) => {
							await update({ reset: false });
							await invalidate('app:sports:list');
						};
					}}
				>
					<input type="hidden" name="team_id" value={t.id} />
					<input type="hidden" name="is_followed" value={t.is_followed ? 'false' : 'true'} />
					<Button
						type="submit"
						variant="ghost"
						size="icon-sm"
						aria-label={t.is_followed ? 'Unfollow team' : 'Follow team'}
						class={t.is_followed ? 'text-amber-500' : 'text-muted-foreground'}
					>
						<Star class={cn('size-4', t.is_followed && 'fill-current')} />
					</Button>
				</form>
			{:else if t.is_followed}
				<Star class="size-4 fill-current text-amber-500" />
			{/if}
		</li>
	{:else}
		<li class="px-3 py-4 text-sm text-muted-foreground">No teams match.</li>
	{/each}
</ul>

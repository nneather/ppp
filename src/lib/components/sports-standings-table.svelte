<script lang="ts">
	import type { SportsStandingRow } from '$lib/types/sports';

	let { title, rows }: { title: string; rows: SportsStandingRow[] } = $props();
</script>

<div class="overflow-hidden rounded-xl border border-border">
	<div class="bg-muted/40 px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
		{title}
	</div>
	<table class="w-full text-sm">
		<thead class="text-left text-xs text-muted-foreground">
			<tr class="border-b border-border">
				<th class="px-3 py-1.5 font-medium">#</th>
				<th class="px-3 py-1.5 font-medium">Team</th>
				<th class="px-3 py-1.5 font-medium">W</th>
				<th class="px-3 py-1.5 font-medium">L</th>
				<th class="px-3 py-1.5 font-medium">GB</th>
				<th class="px-3 py-1.5 font-medium">Strk</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-border">
			{#each rows as s, i (s.id)}
				<tr>
					<td class="px-3 py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
					<td class="px-3 py-1.5">{s.team_name}</td>
					<td class="px-3 py-1.5 tabular-nums">{s.wins}</td>
					<td class="px-3 py-1.5 tabular-nums">{s.losses}</td>
					<td class="px-3 py-1.5 text-muted-foreground tabular-nums">
						{s.games_behind == null || s.games_behind === 0 ? '—' : s.games_behind}
					</td>
					<td class="px-3 py-1.5 text-muted-foreground tabular-nums">{s.streak ?? '—'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

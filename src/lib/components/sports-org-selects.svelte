<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';
	import type { SportsOrgSelect, SportsOrgSelectId } from '$lib/sports/standings';

	let {
		selects,
		onChange
	}: {
		selects: SportsOrgSelect[];
		onChange: (id: SportsOrgSelectId, value: string) => void;
	} = $props();
</script>

<div class="flex flex-wrap gap-3">
	{#each selects as spec (spec.id)}
		<label class="flex min-w-36 flex-1 flex-col gap-1 text-xs text-muted-foreground sm:max-w-xs">
			{spec.label}
			<Select.Root
				type="single"
				value={spec.value}
				items={spec.options}
				onValueChange={(value) => {
					if (typeof value === 'string' && value !== spec.value) onChange(spec.id, value);
				}}
			>
				<Select.Trigger class="h-10 w-full min-w-36" aria-label={spec.label}>
					<span data-slot="select-value" class="truncate text-left text-foreground">
						{spec.options.find((o) => o.value === spec.value)?.label ?? spec.value}
					</span>
				</Select.Trigger>
				<Select.Content class="max-h-72">
					{#each spec.options as opt (opt.value)}
						<Select.Item value={opt.value} label={opt.label}>{opt.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</label>
	{/each}
</div>

<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { CADENCE_UNITS, formatCadenceLabel, type CadenceUnit } from '$lib/contacts/cadence';

	let {
		amount = $bindable(''),
		unit = $bindable<CadenceUnit>('months'),
		amountId = 'cadence_amount',
		unitId = 'cadence_unit',
		label = 'Meet cadence',
		hint = null,
		allowEmpty = true
	}: {
		amount?: string;
		unit?: CadenceUnit;
		amountId?: string;
		unitId?: string;
		label?: string;
		hint?: string | null;
		allowEmpty?: boolean;
	} = $props();

	const unitLabel = $derived(unit === 'years' ? 'Years' : 'Months');
	const preview = $derived.by(() => {
		const n = Number.parseInt(amount, 10);
		if (!Number.isFinite(n) || n < 1) return null;
		const days = unit === 'years' ? n * 365 : n * 30;
		return formatCadenceLabel(days);
	});
</script>

<div class="space-y-2">
	<Label for={amountId}>{label}</Label>
	<div class="flex gap-2">
		<Input
			id={amountId}
			name="cadence_amount"
			type="number"
			min="1"
			step="1"
			bind:value={amount}
			placeholder={allowEmpty ? 'Default' : '3'}
			class="w-24"
			required={!allowEmpty}
		/>
		<input type="hidden" name="cadence_unit" value={unit} />
		<Select.Root
			type="single"
			value={unit}
			onValueChange={(v) => {
				if (v === 'months' || v === 'years') unit = v;
			}}
		>
			<Select.Trigger id={unitId} class="min-w-[7.5rem] flex-1" size="lg">
				{unitLabel}
			</Select.Trigger>
			<Select.Content>
				{#each CADENCE_UNITS as u (u)}
					<Select.Item value={u}>{u === 'years' ? 'Years' : 'Months'}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
	{#if hint}
		<p class="text-xs text-muted-foreground">{hint}</p>
	{:else if preview}
		<p class="text-xs text-muted-foreground">Every {preview}.</p>
	{:else if allowEmpty}
		<p class="text-xs text-muted-foreground">Leave blank to use the profile default.</p>
	{/if}
</div>

<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import {
		CONTEXT_TYPES,
		CONTEXT_TYPE_LABELS,
		HYMNALS,
		HYMNAL_LABELS,
		type ContextType,
		type Hymnal
	} from '$lib/types/sermons';

	let {
		idPrefix,
		name = $bindable(''),
		contextType = $bindable<ContextType | ''>(''),
		serviceStart = $bindable(''),
		driveMinutes = $bindable(''),
		departBy = $bindable(''),
		hymnal = $bindable<Hymnal | ''>(''),
		notes = $bindable('')
	}: {
		idPrefix: string;
		name: string;
		contextType: ContextType | '';
		serviceStart: string;
		driveMinutes: string;
		departBy: string;
		hymnal: Hymnal | '';
		notes: string;
	} = $props();

	const NONE = '__none__';

	const contextSelect = $derived(contextType || NONE);
	const contextLabel = $derived(contextType ? CONTEXT_TYPE_LABELS[contextType] : 'None');
	const hymnalSelect = $derived(hymnal || NONE);
	const hymnalLabel = $derived(hymnal ? HYMNAL_LABELS[hymnal] : 'None');
</script>

<div class="space-y-2">
	<Label for="{idPrefix}-name">Name</Label>
	<Input id="{idPrefix}-name" name="name" bind:value={name} required />
</div>
<div class="space-y-2">
	<Label>Type</Label>
	<input type="hidden" name="context_type" value={contextType} />
	<Select.Root
		type="single"
		value={contextSelect}
		onValueChange={(v) => {
			contextType = !v || v === NONE ? '' : (v as ContextType);
		}}
	>
		<Select.Trigger class="w-full">{contextLabel}</Select.Trigger>
		<Select.Content>
			<Select.Item value={NONE}>None</Select.Item>
			{#each CONTEXT_TYPES as ct (ct)}
				<Select.Item value={ct}>{CONTEXT_TYPE_LABELS[ct]}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
<div class="grid grid-cols-2 gap-3">
	<div class="space-y-2">
		<Label for="{idPrefix}-start">Service start</Label>
		<Input id="{idPrefix}-start" name="service_start" type="time" bind:value={serviceStart} />
	</div>
	<div class="space-y-2">
		<Label for="{idPrefix}-drive">Drive (minutes)</Label>
		<Input
			id="{idPrefix}-drive"
			name="drive_minutes"
			type="number"
			inputmode="numeric"
			min="1"
			max="600"
			step="1"
			placeholder="Optional"
			bind:value={driveMinutes}
		/>
	</div>
</div>
<div class="space-y-2">
	<Label for="{idPrefix}-leave">Leave by</Label>
	<Input id="{idPrefix}-leave" name="depart_by" type="time" bind:value={departBy} />
</div>
<div class="space-y-2">
	<Label>Hymnal</Label>
	<input type="hidden" name="hymnal" value={hymnal} />
	<Select.Root
		type="single"
		value={hymnalSelect}
		onValueChange={(v) => {
			hymnal = !v || v === NONE ? '' : (v as Hymnal);
		}}
	>
		<Select.Trigger class="w-full">{hymnalLabel}</Select.Trigger>
		<Select.Content>
			<Select.Item value={NONE}>None</Select.Item>
			{#each HYMNALS as key (key)}
				<Select.Item value={key}>{HYMNAL_LABELS[key]}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
<div class="space-y-2">
	<Label for="{idPrefix}-notes">Notes</Label>
	<textarea
		id="{idPrefix}-notes"
		name="notes"
		bind:value={notes}
		rows={3}
		class="flex min-h-[4.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		placeholder="Bulletin timing, who to call…"
	></textarea>
</div>

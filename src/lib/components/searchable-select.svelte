<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { filterPickerOptions, type PickerOption } from '$lib/classwork/paper-pickers';

	/**
	 * Inline searchable single-select. A trigger shows the current choice; opening it
	 * reveals a filter box and a scrollable list (max-h) that works inside sheets on
	 * mobile and desktop (no popover/portal).
	 */
	let {
		options,
		value,
		onChange,
		noneLabel,
		placeholder = 'Search…',
		emptyMessage = 'No matches.',
		id
	}: {
		options: PickerOption[];
		value: string;
		onChange: (v: string) => void;
		/** Label for the "nothing selected" row (value ''). */
		noneLabel: string;
		placeholder?: string;
		emptyMessage?: string;
		id?: string;
	} = $props();

	let open = $state(false);
	let query = $state('');

	const selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? noneLabel);
	const filtered = $derived(filterPickerOptions(options, query));

	function pick(v: string) {
		onChange(v);
		open = false;
		query = '';
	}
</script>

<div class="space-y-1">
	<button
		{id}
		type="button"
		class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<span class="truncate">{selectedLabel}</span>
		<span aria-hidden="true" class="ml-2 text-muted-foreground">{open ? '▲' : '▼'}</span>
	</button>
	{#if open}
		<div class="rounded-md border border-border bg-popover p-1">
			<Input bind:value={query} {placeholder} autocomplete="off" class="mb-1" />
			<ul class="max-h-56 overflow-y-auto overscroll-contain" role="listbox">
				<li>
					<button
						type="button"
						role="option"
						aria-selected={value === ''}
						class="w-full rounded px-2 py-2 text-left text-sm hover:bg-accent {value === ''
							? 'font-medium'
							: ''}"
						onclick={() => pick('')}>{noneLabel}</button
					>
				</li>
				{#each filtered as o (o.value)}
					<li>
						<button
							type="button"
							role="option"
							aria-selected={value === o.value}
							class="w-full rounded px-2 py-2 text-left text-sm hover:bg-accent {value === o.value
								? 'font-medium'
								: ''}"
							onclick={() => pick(o.value)}
						>
							{o.label}
							{#if o.hint}<span class="block text-xs text-muted-foreground">{o.hint}</span>{/if}
						</button>
					</li>
				{:else}
					<li class="px-2 py-2 text-sm text-muted-foreground">{emptyMessage}</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<script lang="ts">
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type InputType = Exclude<HTMLInputTypeAttribute, 'file'>;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, 'type'> &
			({ type: 'file'; files?: FileList } | { type?: InputType; files?: undefined })
	>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		class: className,
		'data-slot': dataSlot = 'input',
		...restProps
	}: Props = $props();

	const baseClass =
		'h-8 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40';

	/** WebKit date/time controls ignore height unless appearance is reset; edit pseudos must fill the box. */
	const dateTimeClass =
		'block appearance-none py-0 leading-none [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-date-and-time-value]:min-h-[1.5rem] [&::-webkit-date-and-time-value]:leading-[1.5rem] [&::-webkit-datetime-edit]:m-0 [&::-webkit-datetime-edit]:inline-flex [&::-webkit-datetime-edit]:h-full [&::-webkit-datetime-edit]:min-h-[1.25rem] [&::-webkit-datetime-edit]:items-center [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit-fields-wrapper]:p-0';
</script>

{#if type === 'file'}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(baseClass, className)}
		type="file"
		bind:files
		bind:value
		{...restProps}
	/>
{:else}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			baseClass,
			(type === 'date' ||
				type === 'datetime-local' ||
				type === 'month' ||
				type === 'week' ||
				type === 'time') &&
				dateTimeClass,
			className
		)}
		{type}
		bind:value
		{...restProps}
	/>
{/if}

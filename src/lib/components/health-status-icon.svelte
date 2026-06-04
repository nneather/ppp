<script lang="ts">
	import { HEALTH_HEX } from '$lib/projects/health-appearance';
	import { HEALTH_STATUS_LABELS, type HealthStatus } from '$lib/types/projects';
	import { cn } from '$lib/utils';

	let {
		health,
		size = 'sm',
		muted = false,
		class: className = ''
	}: {
		health: HealthStatus;
		size?: 'xs' | 'sm' | 'md';
		/** Lower contrast when shown on unselected picker segments. */
		muted?: boolean;
		class?: string;
	} = $props();

	const sizeClass = {
		xs: 'size-3',
		sm: 'size-3.5',
		md: 'size-4'
	} as const;

	const fill = $derived(HEALTH_HEX[health]);
	const watchStroke = '#454545';
</script>

<svg
	class={cn('inline-block shrink-0', sizeClass[size], muted && 'opacity-60', className)}
	viewBox="0 0 16 16"
	role="img"
	aria-label={HEALTH_STATUS_LABELS[health]}
>
	{#if health === 'excellent'}
		<circle cx="8" cy="8" r="6" fill={fill} />
	{:else if health === 'satisfactory'}
		<circle cx="8" cy="8" r="6" fill="none" stroke={fill} stroke-width="1.5" />
		<path d="M 8 2 A 6 6 0 0 0 8 14 L 8 2 Z" fill={fill} />
	{:else if health === 'watch'}
		<polygon
			points="8,13 2,4 14,4"
			fill={fill}
			stroke={watchStroke}
			stroke-width="1"
			stroke-linejoin="round"
		/>
	{:else if health === 'serious'}
		<polygon
			points="8,2 14,8 8,14 2,8"
			fill="none"
			stroke={fill}
			stroke-width="1.5"
			stroke-linejoin="round"
		/>
		<path d="M 8 2 L 14 8 L 8 14 L 8 8 Z" fill={fill} />
	{:else if health === 'critical'}
		<polygon points="8,2 14,8 8,14 2,8" fill={fill} />
	{/if}
</svg>

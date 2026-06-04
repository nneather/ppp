import type { HealthStatus } from '$lib/types/projects';

/** Raw doc hexes — reference + reused for trend arrows. */
export const HEALTH_HEX: Record<HealthStatus, string> = {
	excellent: '#3494CA',
	satisfactory: '#44A271',
	watch: '#FEE486',
	serious: '#F99C2B',
	critical: '#DA0000'
};

/** Selected segment in the inline picker (bg + text + hover). Shapes: health-status-icon.svelte. */
export const HEALTH_SEGMENT_SELECTED_CLASS: Record<HealthStatus, string> = {
	excellent: 'bg-[#3494CA] text-white hover:bg-[#2d83b4]',
	satisfactory: 'bg-[#44A271] text-white hover:bg-[#3b8d63]',
	watch: 'bg-[#FEE486] text-[#454545] hover:bg-[#fcd95f]',
	serious: 'bg-[#F99C2B] text-white hover:bg-[#e88c1c]',
	critical: 'bg-[#DA0000] text-white hover:bg-[#c00000]'
};

export const LIFECYCLE_BADGE_CLASS =
	'inline-flex items-center rounded px-1.5 py-0.5 text-[0.65rem] font-medium ' +
	'bg-[#DADADA] text-[#454545] dark:bg-[#454545] dark:text-[#DADADA]';

<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { type VariantProps, tv } from 'tailwind-variants';
	import { shortcut } from '$lib/hotkeys/shortcut.svelte';
	import { ariaKeyshortcuts, formatChord } from '$lib/hotkeys/platform';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';

	export const buttonVariants = tv({
		base: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-lg border border-transparent bg-clip-padding text-sm font-medium focus-visible:ring-3 active:not-aria-[haspopup]:translate-y-px aria-invalid:ring-3 [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80',
				outline:
					'border-border bg-background hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 aria-expanded:bg-muted aria-expanded:text-foreground',
				secondary:
					'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
				ghost:
					'hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-expanded:bg-muted aria-expanded:text-foreground',
				destructive:
					'bg-destructive/10 hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/20 text-destructive focus-visible:border-destructive/40 dark:hover:bg-destructive/30',
				link: 'text-primary underline-offset-4 hover:underline'
			},
			size: {
				default:
					'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
				xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
				lg: 'h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
				icon: 'size-8',
				'icon-xs':
					"size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
				'icon-sm':
					'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
				'icon-lg': 'size-9'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
			/**
			 * Single letter for the Mod+letter chord (Cmd on Mac, Ctrl on Win).
			 * Reserved letters: see `src/lib/hotkeys/registry.ts`.
			 */
			hotkey?: string;
			/**
			 * Plain-text button label. When passed together with `hotkey`, the
			 * matching letter is auto-underlined via <HotkeyLabel>. For
			 * icon + text buttons, omit `label` and pass children manually
			 * (wrap the text in <HotkeyLabel> if you want the underline).
			 */
			label?: string;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		hotkey,
		label,
		children,
		title,
		'aria-keyshortcuts': ariaKs,
		...restProps
	}: ButtonProps = $props();

	// Dev-only nudge: primary-action buttons (default-variant submit + any
	// destructive button) should declare a hotkey so app-wide chords stay
	// consistent. Outline/ghost/link variants are explicitly de-emphasized
	// and don't warn, even on submit. Icon-only default-variant buttons
	// (those with aria-label and no children-text path) are excluded too.
	// Anchors (`href` set) are navigation, not actions — they don't warn either.
	// See `.cursor/rules/hotkeys.mdc`.
	$effect(() => {
		if (!import.meta.env.DEV) return;
		if (hotkey) return;
		if (href) return;
		const isPrimarySubmit =
			type === 'submit' && (variant === 'default' || variant === undefined);
		const isDestructive = variant === 'destructive';
		const isPrimaryDefault =
			variant === 'default' && type === 'button' && !restProps['aria-label'];
		if (!(isPrimarySubmit || isDestructive || isPrimaryDefault)) return;
		console.warn(
			`[hotkey] <Button type="${type}" variant="${variant ?? 'default'}"> is missing a hotkey prop. ` +
				`Add hotkey="s|u|d|e|g|b" (see .cursor/rules/hotkeys.mdc).`
		);
	});

	const resolvedTitle = $derived(title ?? (hotkey ? formatChord(hotkey) : undefined));
	const resolvedAriaKs = $derived(ariaKs ?? (hotkey ? ariaKeyshortcuts(hotkey) : undefined));
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		title={resolvedTitle}
		aria-keyshortcuts={resolvedAriaKs}
		use:shortcut={hotkey ? { key: hotkey } : { key: '' }}
		{...restProps}
	>
		{#if label !== undefined}
			<HotkeyLabel {label} mnemonic={hotkey} />
		{:else}
			{@render children?.()}
		{/if}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		title={resolvedTitle}
		aria-keyshortcuts={resolvedAriaKs}
		use:shortcut={hotkey ? { key: hotkey } : { key: '' }}
		{...restProps}
	>
		{#if label !== undefined}
			<HotkeyLabel {label} mnemonic={hotkey} />
		{:else}
			{@render children?.()}
		{/if}
	</button>
{/if}

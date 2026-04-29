<script lang="ts">
	/**
	 * <HotkeyLabel>
	 *
	 * Renders `label` with the first case-insensitive occurrence of `mnemonic`
	 * underlined. Used inside <Button hotkey="..."> automatically; can also be
	 * used standalone for non-Button surfaces (menu items, link affordances).
	 *
	 * If `mnemonic` is unset or not present in the label, the label renders
	 * unchanged so callers can pass it unconditionally.
	 *
	 * The output is wrapped in a plain `<span>` (default `display: inline`)
	 * so flex parents (the shadcn Button uses `inline-flex gap-1.5`) treat
	 * the whole label as a single flex item. Inside the span, the text +
	 * `<u>` + text flow as inline content with no gap. Using `display: contents`
	 * here would defeat the purpose — it removes the wrapping span from layout
	 * and re-exposes the inner text/`<u>`/text nodes as separate flex children.
	 */

	let {
		label,
		mnemonic
	}: {
		label: string;
		mnemonic?: string;
	} = $props();

	const idx = $derived(
		mnemonic ? label.toLowerCase().indexOf(mnemonic.toLowerCase()) : -1
	);
</script>

<span
	>{#if idx === -1}{label}{:else}{label.slice(
			0,
			idx
		)}<u class="underline decoration-current decoration-2 underline-offset-4">{label[idx]}</u
		>{label.slice(idx + 1)}{/if}</span
>

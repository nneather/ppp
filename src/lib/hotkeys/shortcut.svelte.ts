import type { Action } from 'svelte/action';
import { register, unregister } from './registry';

export type ShortcutOptions = {
	key: string;
	handler?: (event: KeyboardEvent) => void;
};

/**
 * Svelte action: register a hotkey on `window` for the lifetime of `node`.
 *
 * Two modes, picked by the key:
 *
 * 1. **Mod+letter** (any single letter, e.g. `'s'`). Matches when
 *    `metaKey || ctrlKey` is held with no Shift/Alt. Listens on the
 *    capture phase, calls `preventDefault()` + `stopPropagation()` to
 *    reclaim browser chords (Cmd+S → form submit, not save-page).
 *
 * 2. **Escape** (the special string `'Escape'`). Matches a bare Esc press
 *    with no modifiers. Listens on the **bubble** phase and bails if
 *    `event.defaultPrevented` — that lets focused widgets (e.g. an open
 *    `<PersonAutocomplete>` dropdown that already preventDefaults Esc to
 *    close itself) win the keystroke. Multiple Cancel buttons may register
 *    Escape simultaneously; the registry intentionally doesn't warn on
 *    that case.
 *
 * Default behaviour when no `handler` is provided: dispatch a synthetic
 * `click` on `node` (so `<button hotkey="s">` works without re-wiring the
 * button's onclick into an explicit handler — the form's submit triggers).
 *
 * Disabled-button bail: if the node carries `disabled` or
 * `aria-disabled="true"`, the chord is still consumed (so the browser
 * shortcut doesn't fire — relevant for the Mod+letter case) but the
 * click does not.
 */
const ESCAPE = 'escape';

export const shortcut: Action<HTMLElement, ShortcutOptions> = (node, opts) => {
	let key = opts.key.toLowerCase();
	let handler = opts.handler;
	let listening = false;

	function onKeydown(event: KeyboardEvent) {
		if (key === ESCAPE) {
			if (event.key !== 'Escape') return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			// Let focused widgets (autocomplete with open dropdown, popover, etc.)
			// claim Escape first by calling preventDefault.
			if (event.defaultPrevented) return;
		} else {
			const mod = event.metaKey || event.ctrlKey;
			if (!mod) return;
			if (event.shiftKey || event.altKey) return;
			if (event.key.toLowerCase() !== key) return;
			event.preventDefault();
			event.stopPropagation();
		}
		const isDisabled =
			node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true';
		if (isDisabled) return;
		if (handler) handler(event);
		else node.click();
	}

	function attach() {
		if (listening || !key) return;
		// Skip the dev-only collision warning for Escape — multiple Cancel
		// buttons co-existing is normal and resolved hierarchically via
		// `event.defaultPrevented` in the bubble-phase handler.
		if (key !== ESCAPE) register(key);
		const useCapture = key !== ESCAPE;
		window.addEventListener('keydown', onKeydown, { capture: useCapture });
		listening = true;
	}

	function detach() {
		if (!listening) return;
		const useCapture = key !== ESCAPE;
		window.removeEventListener('keydown', onKeydown, { capture: useCapture });
		if (key !== ESCAPE) unregister(key);
		listening = false;
	}

	attach();

	return {
		update(next: ShortcutOptions) {
			const nextKey = next.key.toLowerCase();
			if (nextKey !== key) {
				detach();
				key = nextKey;
				attach();
			}
			handler = next.handler;
		},
		destroy() {
			detach();
		}
	};
};

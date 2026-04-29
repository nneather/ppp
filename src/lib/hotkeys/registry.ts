/**
 * Reserved letters for app-wide hotkeys (Mod+letter — Cmd on Mac, Ctrl on Win).
 *
 * Why a registry: stops two screens drifting to different letters for the same
 * action (e.g., Save = Cmd+S on one page, Cmd+W on another). Add new letters
 * here before introducing them anywhere else.
 *
 * **Cancel uses the special `Escape` value, not a Cmd+letter chord.**
 * shadcn `Sheet` and `Dialog` close on Esc natively; the `Escape` hotkey is
 * primarily a discoverability hint (tooltip + aria-keyshortcuts) for the
 * page-hosted Cancel buttons that aren't inside a modal primitive. The
 * shortcut action listens on the bubble phase and bails on
 * `event.defaultPrevented`, so focused widgets that handle Esc themselves
 * (like an open `<PersonAutocomplete>` dropdown) win the keystroke.
 *
 * **Avoid (do NOT add to this map):**
 *   - Browser/OS reserved on Mac (cannot preventDefault):
 *       n (new window), t (new tab), w (close tab), r (reload),
 *       q (quit), l (address bar), p (print), f (find in page),
 *       m (minimize), h (hide app), Space (Spotlight)
 *   - Clipboard / undo / select-all collisions inside text inputs
 *     (preventDefault would silently break native input behavior):
 *       c (copy), x (cut), v (paste), z (undo), y (redo),
 *       a (select all)
 *   - Surprising mappings:
 *       o (browsers / Mac use it for "open file" semantics)
 *
 * See `.cursor/rules/hotkeys.mdc` for the full convention.
 */
export const HOTKEY = {
	save: 's',
	delete: 'd',
	edit: 'e',
	update: 'u',
	generate: 'g',
	/**
	 * `b` is a safe Mod+letter on Mac (Cmd+B = bookmarks bar toggle in Chrome,
	 * reclaimable). Use for the second-letter mnemonic of an action label
	 * where no other reserved letter fits — e.g. "New **B**ook" on the library
	 * list. Don't pin a single global semantic to it.
	 */
	bookOrLocal: 'b',
	/**
	 * Special-key hotkey: matches a bare `Esc` press (no modifier). Used for
	 * Cancel buttons. See top-of-file comment for behavior.
	 */
	cancel: 'Escape'
} as const;

export type HotkeyLetter = (typeof HOTKEY)[keyof typeof HOTKEY];

/**
 * Dev-only registry of currently-mounted hotkey chords.
 *
 * Each `use:shortcut` action calls `register()` on mount and `unregister()`
 * on destroy. If two handlers register the same key while both are mounted,
 * `register()` console.warns. Helps catch "two visible buttons both want
 * Cmd+S" before it ships.
 *
 * No-op in production builds (registry stays empty, register() returns early).
 *
 * Escape is NOT registered here — multiple Cancel buttons co-existing is
 * normal (e.g. a Sheet inside a page that also has a Cancel) and the
 * shortcut action resolves precedence via `event.defaultPrevented`.
 */
const mounted = new Map<string, number>();

export function register(key: string): void {
	if (!import.meta.env.DEV) return;
	const next = (mounted.get(key) ?? 0) + 1;
	mounted.set(key, next);
	if (next > 1) {
		console.warn(
			`[hotkey] Cmd/Ctrl+${key.toUpperCase()} is registered ${next} times on this page. ` +
				`Only one will fire reliably. Re-check button labels and the HOTKEY map.`
		);
	}
}

export function unregister(key: string): void {
	if (!import.meta.env.DEV) return;
	const next = (mounted.get(key) ?? 1) - 1;
	if (next <= 0) mounted.delete(key);
	else mounted.set(key, next);
}

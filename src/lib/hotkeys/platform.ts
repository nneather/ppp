/**
 * Platform helpers for hotkey hints. Browser-only — `isMac()` reads
 * `navigator`, so SSR callers receive `false` until hydration.
 */

let cachedIsMac: boolean | null = null;

export function isMac(): boolean {
	if (cachedIsMac !== null) return cachedIsMac;
	if (typeof navigator === 'undefined') return false;
	const platform = (navigator.platform ?? '').toLowerCase();
	const ua = (navigator.userAgent ?? '').toLowerCase();
	cachedIsMac = platform.includes('mac') || ua.includes('mac os');
	return cachedIsMac;
}

/**
 * Format a single-letter key as a human-readable chord for tooltips and
 * `aria-keyshortcuts`. Uses the platform-appropriate modifier symbol.
 *
 * Special case: `'Escape'` renders as `Esc` with no modifier — the special
 * key matches a bare Esc press in `shortcut.svelte.ts`.
 */
export function formatChord(key: string): string {
	if (key === 'Escape') return 'Esc';
	const upper = key.toUpperCase();
	return isMac() ? `\u2318${upper}` : `Ctrl+${upper}`;
}

/**
 * Format the chord using the W3C aria-keyshortcuts grammar so screen readers
 * announce the right modifier per platform.
 *
 * https://www.w3.org/TR/wai-aria-1.2/#aria-keyshortcuts
 */
export function ariaKeyshortcuts(key: string): string {
	if (key === 'Escape') return 'Escape';
	const upper = key.toUpperCase();
	return isMac() ? `Meta+${upper}` : `Control+${upper}`;
}

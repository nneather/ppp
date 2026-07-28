/**
 * Detect mid-edit UI so SW resume / chunk recovery can defer silent reloads.
 * Used on desktop browser and installed PWA (same client listeners).
 */

const NON_TEXT_INPUT_TYPES = new Set([
	'button',
	'submit',
	'reset',
	'checkbox',
	'radio',
	'hidden',
	'file',
	'image',
	'range',
	'color'
]);

/** Minimal document surface for tests (no happy-dom / jsdom dependency). */
export type BusyDocument = {
	querySelectorAll: (selectors: string) => ArrayLike<Element>;
	activeElement: Element | null;
};

function isOpenOverlay(el: Element): boolean {
	if (el.getAttribute('aria-hidden') === 'true') return false;
	if (el.hasAttribute('data-closed')) return false;
	// bits-ui marks open sheets/dialogs with data-open; closed nodes are usually unmounted.
	if (el.hasAttribute('data-open')) return true;
	return true;
}

function hasOpenSheetOrDialog(doc: BusyDocument): boolean {
	const nodes = doc.querySelectorAll(
		'[data-slot="sheet-content"], [data-slot="dialog-content"], [role="dialog"]'
	);
	for (let i = 0; i < nodes.length; i++) {
		const el = nodes[i];
		if (el && isOpenOverlay(el)) return true;
	}
	return false;
}

function isEditableControl(el: Element | null): boolean {
	if (!el) return false;
	const html = el as HTMLElement;
	if (html.isContentEditable) return true;

	const tag = el.tagName.toUpperCase();
	if (tag === 'TEXTAREA') {
		const ta = el as HTMLTextAreaElement;
		return !ta.disabled && !ta.readOnly;
	}
	if (tag === 'SELECT') {
		return !(el as HTMLSelectElement).disabled;
	}
	if (tag === 'INPUT') {
		const input = el as HTMLInputElement;
		if (input.disabled || input.readOnly) return false;
		const type = (input.type || 'text').toLowerCase();
		return !NON_TEXT_INPUT_TYPES.has(type);
	}
	return false;
}

/**
 * True when an overlay sheet/dialog is open or focus is in an editable control.
 * Safe to call from SSR / non-DOM contexts — returns false.
 */
export function isUserBusy(
	doc: BusyDocument | null = typeof document !== 'undefined' ? document : null
): boolean {
	if (!doc) return false;
	if (hasOpenSheetOrDialog(doc)) return true;
	return isEditableControl(doc.activeElement);
}

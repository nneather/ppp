/**
 * Touch swipe on the review card — right = Confirm, left = Skip.
 * Pointer capture + ~80px threshold; no Svelte deps (testable in isolation).
 */

const INTERACTIVE_SELECTOR =
	'input, textarea, button, select, a, [contenteditable=""], [contenteditable="true"]';

const MAX_STROKE_MS = 800;

export type ReviewSwipeOptions = {
	thresholdPx?: number;
	maxOffAxisPx?: number;
	isEnabled: () => boolean;
	onConfirm: () => void;
	onSkip: () => void;
	/** Called when horizontal drag delta changes (for card transform + hints). */
	onDxChange: (dx: number) => void;
};

function isInteractiveTarget(target: EventTarget | null, root: HTMLElement | null): boolean {
	if (!target || !root) return false;
	let el: Element | null = target instanceof Element ? target : null;
	while (el && el !== root) {
		if (el.matches(INTERACTIVE_SELECTOR)) return true;
		el = el.parentElement;
	}
	return false;
}

export function createReviewSwipe(opts: ReviewSwipeOptions) {
	const thresholdPx = opts.thresholdPx ?? 80;
	const maxOffAxisPx = opts.maxOffAxisPx ?? 40;

	let rootEl: HTMLElement | null = null;
	let active = false;
	let cancelled = false;
	let startX = 0;
	let startY = 0;
	let startT = 0;
	let lastDx = 0;

	function resetDx() {
		lastDx = 0;
		opts.onDxChange(0);
	}

	function releaseCapture(e: PointerEvent) {
		if (rootEl?.hasPointerCapture(e.pointerId)) {
			try {
				rootEl.releasePointerCapture(e.pointerId);
			} catch {
				/* already released */
			}
		}
	}

	function onPointerDown(e: PointerEvent) {
		if (e.pointerType !== 'touch') return;
		if (!opts.isEnabled()) return;
		if (!rootEl || e.currentTarget !== rootEl) return;
		if (isInteractiveTarget(e.target, rootEl)) return;

		active = true;
		cancelled = false;
		startX = e.clientX;
		startY = e.clientY;
		startT = performance.now();
		lastDx = 0;
		opts.onDxChange(0);

		try {
			rootEl.setPointerCapture(e.pointerId);
		} catch {
			active = false;
		}
	}

	function onPointerMove(e: PointerEvent) {
		if (!active || cancelled) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;

		if (Math.abs(dy) > maxOffAxisPx && Math.abs(dx) < thresholdPx) {
			cancelled = true;
			releaseCapture(e);
			resetDx();
			return;
		}

		lastDx = Math.max(-100, Math.min(100, dx));
		opts.onDxChange(lastDx);
	}

	function onPointerUp(e: PointerEvent) {
		if (!active) return;
		active = false;
		releaseCapture(e);

		const elapsed = performance.now() - startT;
		const dx = lastDx;

		if (cancelled || elapsed > MAX_STROKE_MS) {
			resetDx();
			return;
		}

		if (dx >= thresholdPx) {
			resetDx();
			opts.onConfirm();
			return;
		}
		if (dx <= -thresholdPx) {
			resetDx();
			opts.onSkip();
			return;
		}

		resetDx();
	}

	function onPointerCancel(e: PointerEvent) {
		if (!active) return;
		active = false;
		cancelled = true;
		releaseCapture(e);
		resetDx();
	}

	function bindRoot(el: HTMLElement) {
		rootEl = el;
	}

	return {
		bindRoot,
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerCancel
	};
}

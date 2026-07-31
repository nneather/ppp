/** Chunk-load recovery — auto clear SW/caches + reload; card only if that already failed or mid-edit. */

import { isUserBusy } from './user-busy';

const RECOVERY_ID = 'ppp-client-recovery';
const RECOVERY_ATTEMPTED_KEY = 'ppp-chunk-recovery-at';
const RECOVERY_COUNT_KEY = 'ppp-chunk-recovery-count';
/** Query param stamped on silent recovery navigations; stripped on the next boot. */
export const RECOVER_QUERY_PARAM = '_ppp_recover';
/** If failures keep landing inside this window after max silent attempts, show the manual card. */
const RECOVERY_COOLDOWN_MS = 20_000;
/** Allow this many silent clear+reloads before surfacing the card (idle only). */
const MAX_SILENT_ATTEMPTS = 2;
/**
 * After a post-recovery boot stays up this long without another recover, drop cooldown/count
 * so a later real skew can silent-recover again (avoids banner from a transient second blip).
 */
const SETTLE_CLEAR_MS = 2_500;

let recovering = false;
/** Owner dismissed the card — don't re-show until the next full load. */
let dismissed = false;

export function isChunkLoadFailure(message: string, source?: string): boolean {
	const lower = message.toLowerCase();
	if (
		lower.includes('loading chunk') ||
		lower.includes('failed to fetch dynamically imported module') ||
		lower.includes('importing a module script failed') ||
		lower.includes('error loading dynamically imported module')
	) {
		return true;
	}
	// Opaque cross-origin script errors only — do not treat arbitrary runtime errors in
	// `/_app/immutable/*` as cache skew (that was a false-positive recovery trigger).
	const opaque = message === '' || lower === 'script error' || lower === 'script error.';
	return opaque && (source?.includes('/_app/immutable/') ?? false);
}

/** Exported for unit tests — true when a recovery reload already ran in this cooldown window. */
export function recentlyAttemptedRecovery(
	now = Date.now(),
	storage: Pick<Storage, 'getItem'> | null = typeof sessionStorage !== 'undefined'
		? sessionStorage
		: null
): boolean {
	if (!storage) return false;
	try {
		const raw = storage.getItem(RECOVERY_ATTEMPTED_KEY);
		if (!raw) return false;
		const at = Number(raw);
		if (!Number.isFinite(at)) return false;
		return now - at < RECOVERY_COOLDOWN_MS;
	} catch {
		return false;
	}
}

/** Exported for unit tests. */
export function getRecoveryAttemptCount(
	storage: Pick<Storage, 'getItem'> | null = typeof sessionStorage !== 'undefined'
		? sessionStorage
		: null
): number {
	if (!storage) return 0;
	try {
		const raw = storage.getItem(RECOVERY_COUNT_KEY);
		if (!raw) return 0;
		const n = Number(raw);
		return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
	} catch {
		return 0;
	}
}

function markRecoveryAttempt(): void {
	try {
		const prev = getRecoveryAttemptCount();
		sessionStorage.setItem(RECOVERY_ATTEMPTED_KEY, String(Date.now()));
		sessionStorage.setItem(RECOVERY_COUNT_KEY, String(prev + 1));
	} catch {
		/* best-effort */
	}
}

function clearRecoveryAttemptState(): void {
	try {
		sessionStorage.removeItem(RECOVERY_ATTEMPTED_KEY);
		sessionStorage.removeItem(RECOVERY_COUNT_KEY);
	} catch {
		/* best-effort */
	}
}

/** Exported for unit tests — remove `_ppp_recover` without a navigation. */
export function stripRecoverQueryParam(
	href: string,
	replaceState: (url: string) => void = (url) => {
		window.history.replaceState(window.history.state, '', url);
	}
): string | null {
	try {
		const url = new URL(href);
		if (!url.searchParams.has(RECOVER_QUERY_PARAM)) return null;
		url.searchParams.delete(RECOVER_QUERY_PARAM);
		const next = `${url.pathname}${url.search}${url.hash}`;
		replaceState(next);
		return next;
	} catch {
		return null;
	}
}

const btnBase =
	'padding:0.375rem 0.75rem;border:1px solid #e4e4e7;border-radius:0.375rem;font-size:0.8125rem;cursor:pointer;line-height:1.25';

function showRecoveryCard(): void {
	if (dismissed || document.getElementById(RECOVERY_ID)) return;

	const card = document.createElement('div');
	card.id = RECOVERY_ID;
	// Non-modal: owner may finish a form (e.g. time entry Save) before clearing cache.
	card.setAttribute('role', 'status');
	card.setAttribute('aria-live', 'polite');
	card.setAttribute(
		'style',
		[
			'position:fixed',
			'inset-inline:0',
			// Top — keep clear of sheet footers / sticky save bars / tab bar.
			'top:calc(env(safe-area-inset-top,0px) + 0.5rem)',
			'z-index:9998',
			'margin:0 auto',
			'max-width:22rem',
			'padding:0.5rem 0.75rem',
			'border:1px solid #e4e4e7',
			'border-radius:0.5rem',
			'background:#ffffff',
			'box-shadow:0 4px 12px -2px rgb(0 0 0 / 0.12)',
			'font-family:ui-sans-serif,system-ui,-apple-system,sans-serif',
			'font-size:0.8125rem',
			'line-height:1.4',
			'color:#18181b'
		].join(';')
	);

	const message = document.createElement('p');
	message.textContent = "App update ready — clear cache when you're done.";
	message.setAttribute('style', 'margin:0 0 0.5rem;text-align:center');

	const actions = document.createElement('div');
	actions.setAttribute(
		'style',
		'display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:0.375rem'
	);

	const clearBtn = document.createElement('button');
	clearBtn.type = 'button';
	clearBtn.textContent = 'Clear cache';
	clearBtn.setAttribute('style', `${btnBase};background:#18181b;color:#fafafa`);
	clearBtn.onclick = () => void clearCacheAndReload();

	const reloadBtn = document.createElement('button');
	reloadBtn.type = 'button';
	reloadBtn.textContent = 'Reload';
	reloadBtn.setAttribute('style', `${btnBase};background:#ffffff;color:#18181b`);
	reloadBtn.onclick = () => window.location.reload();

	const laterBtn = document.createElement('button');
	laterBtn.type = 'button';
	laterBtn.textContent = 'Later';
	laterBtn.setAttribute(
		'style',
		`${btnBase};background:transparent;border-color:transparent;color:#71717a;text-decoration:underline;text-underline-offset:2px`
	);
	laterBtn.onclick = () => {
		dismissed = true;
		recovering = false;
		card.remove();
	};

	actions.append(clearBtn, reloadBtn, laterBtn);
	card.append(message, actions);
	document.body.append(card);
}

async function clearCacheAndReload(): Promise<void> {
	try {
		if ('serviceWorker' in navigator) {
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(registrations.map((registration) => registration.unregister()));
		}
		if ('caches' in window) {
			const keys = await caches.keys();
			await Promise.all(keys.map((key) => caches.delete(key)));
		}
	} catch {
		/* best-effort */
	}
	// Full replace (not reload) + bust query so the next document load is a fresh navigation
	// after unregister — same-tab reload can stay controlled by a dying SW on some engines.
	try {
		const url = new URL(window.location.href);
		url.searchParams.set(RECOVER_QUERY_PARAM, String(Date.now()));
		window.location.replace(url.href);
	} catch {
		window.location.reload();
	}
}

async function recoverFromChunkFailure(): Promise<void> {
	if (recovering || dismissed) return;
	recovering = true;

	// Mid-edit (open sheet / focused field): never silent-reload — show the card so the
	// owner can finish (desktop tab return + mobile PWA). Idle path still auto-recovers.
	// Leave recovering=true while the card is up; Later resets it.
	if (isUserBusy()) {
		showRecoveryCard();
		return;
	}

	// After MAX_SILENT_ATTEMPTS clear+reloads in the cooldown window, stop looping and ask.
	if (getRecoveryAttemptCount() >= MAX_SILENT_ATTEMPTS && recentlyAttemptedRecovery()) {
		showRecoveryCard();
		return;
	}

	markRecoveryAttempt();
	await clearCacheAndReload();
}

export function installClientRecovery(): void {
	if (typeof window === 'undefined') return;

	stripRecoverQueryParam(window.location.href);

	// Successful boot after a silent recover: drop attempt state so a later deploy skew
	// can silent-recover again instead of immediately showing the fallback card.
	window.setTimeout(() => {
		if (!recovering && !document.getElementById(RECOVERY_ID)) {
			clearRecoveryAttemptState();
		}
	}, SETTLE_CLEAR_MS);

	window.addEventListener('error', (event) => {
		const message = event.message ?? '';
		const source = event.filename ?? undefined;
		if (isChunkLoadFailure(message, source)) void recoverFromChunkFailure();
	});

	window.addEventListener('unhandledrejection', (event) => {
		const reason = event.reason;
		const message =
			reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : String(reason);
		if (isChunkLoadFailure(message)) void recoverFromChunkFailure();
	});
}

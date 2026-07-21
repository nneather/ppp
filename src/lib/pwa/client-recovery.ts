/** Chunk-load recovery — auto clear SW/caches + reload; card only if that already failed. */

const RECOVERY_ID = 'ppp-client-recovery';
const RECOVERY_ATTEMPTED_KEY = 'ppp-chunk-recovery-at';
/** If a second chunk failure lands within this window, show the manual card (avoid reload loops). */
const RECOVERY_COOLDOWN_MS = 20_000;

let recovering = false;
/** Owner dismissed the card — don't re-show until the next full load. */
let dismissed = false;

export function isChunkLoadFailure(message: string, source?: string): boolean {
	const lower = message.toLowerCase();
	return (
		lower.includes('loading chunk') ||
		lower.includes('failed to fetch dynamically imported module') ||
		lower.includes('importing a module script failed') ||
		lower.includes('error loading dynamically imported module') ||
		(source?.includes('/_app/immutable/') ?? false)
	);
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

function markRecoveryAttempt(): void {
	try {
		sessionStorage.setItem(RECOVERY_ATTEMPTED_KEY, String(Date.now()));
	} catch {
		/* best-effort */
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
		const registration = await navigator.serviceWorker?.getRegistration();
		if (registration) await registration.unregister();
		const keys = await caches.keys();
		await Promise.all(keys.map((key) => caches.delete(key)));
	} catch {
		/* best-effort */
	}
	window.location.reload();
}

async function recoverFromChunkFailure(): Promise<void> {
	if (recovering || dismissed) return;
	recovering = true;

	if (recentlyAttemptedRecovery()) {
		showRecoveryCard();
		return;
	}

	markRecoveryAttempt();
	await clearCacheAndReload();
}

export function installClientRecovery(): void {
	if (typeof window === 'undefined') return;

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

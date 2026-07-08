/** DOM recovery UI for chunk-load / bootstrap failures — no Svelte dependency. */

const RECOVERY_ID = 'ppp-client-recovery';

let shown = false;

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

function showRecoveryCard(): void {
	if (shown || document.getElementById(RECOVERY_ID)) return;
	shown = true;

	const card = document.createElement('div');
	card.id = RECOVERY_ID;
	card.setAttribute('role', 'alertdialog');
	card.setAttribute('aria-live', 'assertive');
	card.setAttribute(
		'style',
		[
			'position:fixed',
			'inset-inline:0',
			'bottom:calc(env(safe-area-inset-bottom,0px) + 4.5rem)',
			'z-index:9998',
			'margin:0 auto',
			'max-width:24rem',
			'padding:0.75rem 1rem',
			'border:1px solid #e4e4e7',
			'border-radius:0.5rem',
			'background:#ffffff',
			'box-shadow:0 10px 15px -3px rgb(0 0 0 / 0.1)',
			'font-family:ui-sans-serif,system-ui,-apple-system,sans-serif',
			'font-size:0.875rem',
			'line-height:1.5',
			'color:#18181b'
		].join(';')
	);

	const message = document.createElement('p');
	message.textContent = 'App update failed to load. Reload or clear cached files.';
	message.setAttribute('style', 'margin:0 0 0.75rem;text-align:center');

	const actions = document.createElement('div');
	actions.setAttribute('style', 'display:flex;flex-wrap:wrap;justify-content:center;gap:0.5rem');

	const reloadBtn = document.createElement('button');
	reloadBtn.type = 'button';
	reloadBtn.textContent = 'Reload';
	reloadBtn.setAttribute(
		'style',
		'padding:0.375rem 0.75rem;border:1px solid #e4e4e7;border-radius:0.375rem;background:#18181b;color:#fafafa;font-size:0.875rem;cursor:pointer'
	);
	reloadBtn.onclick = () => window.location.reload();

	const clearBtn = document.createElement('button');
	clearBtn.type = 'button';
	clearBtn.textContent = 'Clear cache';
	clearBtn.setAttribute(
		'style',
		'padding:0.375rem 0.75rem;border:1px solid #e4e4e7;border-radius:0.375rem;background:#ffffff;color:#18181b;font-size:0.875rem;cursor:pointer'
	);
	clearBtn.onclick = () => void clearCacheAndReload();

	actions.append(reloadBtn, clearBtn);
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

export function installClientRecovery(): void {
	if (typeof window === 'undefined') return;

	window.addEventListener('error', (event) => {
		const message = event.message ?? '';
		const source = event.filename ?? undefined;
		if (isChunkLoadFailure(message, source)) showRecoveryCard();
	});

	window.addEventListener('unhandledrejection', (event) => {
		const reason = event.reason;
		const message =
			reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : String(reason);
		if (isChunkLoadFailure(message)) showRecoveryCard();
	});
}

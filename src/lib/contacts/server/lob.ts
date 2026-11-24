/**
 * Minimal Lob postcard client (server-only). Ported from HeLOS
 * `api/events/postcards/send/route.ts`: per-request timeout, bounded retry on
 * 429 / 5xx / network errors, and an Idempotency-Key so a retried request
 * returns the same postcard instead of mailing a second one.
 *
 * Keys live in env, never the DB:
 *   LOB_TEST_API_KEY=test_...   proofs (renders a PDF, mails nothing)
 *   LOB_LIVE_API_KEY=live_...   real mail
 */
import { env } from '$env/dynamic/private';

export type LobMode = 'test' | 'live';

export type LobAddress = {
	name: string;
	address_line1: string;
	address_line2?: string;
	address_city: string;
	address_state: string;
	address_zip: string;
	address_country?: 'US';
};

export type LobPostcardRequest = {
	to: LobAddress;
	from?: LobAddress;
	front: string;
	back: string;
	size: string;
	description: string;
	use_type: 'operational';
};

export type LobResult = { ok: true; id: string; url: string | null } | { ok: false; error: string };

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

/** Which keys are configured, for the screen to show (never the key itself). */
export function lobKeysConfigured(): Record<LobMode, boolean> {
	return {
		test: (env.LOB_TEST_API_KEY ?? '').startsWith('test_'),
		live: (env.LOB_LIVE_API_KEY ?? '').startsWith('live_')
	};
}

/** The key for a mode, or an error message. A key with the wrong prefix is refused. */
export function lobKey(mode: LobMode): { key: string } | { error: string } {
	const key = mode === 'test' ? env.LOB_TEST_API_KEY : env.LOB_LIVE_API_KEY;
	const name = mode === 'test' ? 'LOB_TEST_API_KEY' : 'LOB_LIVE_API_KEY';
	if (!key) return { error: `${name} is not set.` };
	if (!key.startsWith(`${mode}_`)) return { error: `${name} must start with ${mode}_.` };
	return { key };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function createLobPostcard(
	key: string,
	body: LobPostcardRequest,
	idempotencyKey: string,
	fetchImpl: typeof fetch = fetch
): Promise<LobResult> {
	let lastError = 'Lob request failed';
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		try {
			const res = await fetchImpl('https://api.lob.com/v1/postcards', {
				method: 'POST',
				headers: {
					Authorization: `Basic ${btoa(`${key}:`)}`,
					'Content-Type': 'application/json',
					'Idempotency-Key': idempotencyKey
				},
				body: JSON.stringify(body),
				signal: controller.signal
			});
			if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
				lastError = `Lob returned ${res.status}`;
				await sleep(300 * attempt);
				continue;
			}
			const data = (await res.json().catch(() => ({}))) as {
				id?: string;
				url?: string;
				error?: { message?: string };
			};
			if (!res.ok || !data.id) {
				return { ok: false, error: data.error?.message ?? `Lob returned ${res.status}` };
			}
			return { ok: true, id: data.id, url: data.url ?? null };
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
			if (attempt < MAX_ATTEMPTS) await sleep(300 * attempt);
		} finally {
			clearTimeout(timer);
		}
	}
	return { ok: false, error: lastError };
}

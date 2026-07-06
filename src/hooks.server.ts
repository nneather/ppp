import { resolveSessionUser, type SessionUser } from '$lib/server/auth-session';
import { createPerfCollector, mergeServerTimingHeaders } from '$lib/server/perf';
import { createClient } from '$lib/supabase/server';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { Handle } from '@sveltejs/kit';

const supabaseOrigin = new URL(PUBLIC_SUPABASE_URL).origin;
const supabaseWsOrigin = supabaseOrigin.replace(/^https:/, 'wss:');

/** Baseline CSP — 'unsafe-inline' retained for SvelteKit hydration; nonce tightening is a future step. */
const CONTENT_SECURITY_POLICY = [
	"default-src 'self'",
	"base-uri 'self'",
	"object-src 'none'",
	"frame-ancestors 'none'",
	"script-src 'self' 'unsafe-inline'",
	"style-src 'self' 'unsafe-inline'",
	`img-src 'self' data: blob: ${supabaseOrigin}`,
	"font-src 'self' data:",
	`connect-src 'self' ${supabaseOrigin} ${supabaseWsOrigin}`,
	"media-src 'self' blob:",
	"worker-src 'self' blob:"
].join('; ');

function applySecurityHeaders(response: Response): void {
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createClient(event.cookies);
	event.locals.perf = createPerfCollector();

	let sessionCache: { user: SessionUser | null } | null = null;

	event.locals.safeGetSession = async () => {
		if (sessionCache) return sessionCache;
		const user = await event.locals.perf.measure('auth', () =>
			resolveSessionUser(event.locals.supabase)
		);
		sessionCache = { user };
		return sessionCache;
	};

	const start = performance.now();
	const response = await resolve(event, {
		filterSerializedResponseHeaders(name) {
			return (
				name === 'content-range' ||
				name === 'x-supabase-api-version' ||
				name === 'server-timing'
			);
		}
	});

	const totalDur = Math.round(performance.now() - start);
	const header = mergeServerTimingHeaders(
		event.locals.perf.formatServerTiming(),
		`total;dur=${totalDur}`
	);
	response.headers.append('Server-Timing', header);
	applySecurityHeaders(response);

	return response;
};

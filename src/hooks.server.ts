import { createClient } from '$lib/supabase/server';
import { resolveSessionUser } from '$lib/server/auth-session';
import { createPerfCollector, mergeServerTimingHeaders } from '$lib/server/perf';
import type { Handle } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createClient(event.cookies);
	event.locals.perf = createPerfCollector();

	let sessionCache: { user: User | null } | null = null;

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

	return response;
};

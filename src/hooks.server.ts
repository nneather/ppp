import { createClient } from '$lib/supabase/server';
import type { Handle } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createClient(event.cookies);

	let sessionCache: { user: User | null } | null = null;

	event.locals.safeGetSession = async () => {
		if (sessionCache) return sessionCache;
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) {
			sessionCache = { user: null };
			return sessionCache;
		}
		sessionCache = { user };
		return sessionCache;
	};

	const start = performance.now();
	const response = await resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});

	const dur = Math.round(performance.now() - start);
	response.headers.append('Server-Timing', `total;dur=${dur}`);

	return response;
};

/// <reference lib="webworker" />
import type { PrecacheEntry } from 'workbox-precaching';
import { matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { LIBRARY_VOCAB_CACHE_PATHS } from '$lib/library/vocab-cache-paths';

declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: Array<PrecacheEntry | string>;
};

// Bump v5 (2026-07-06): NavigationRoute + NetworkOnly so failed navigations hit setCatchHandler → offline.html.
precacheAndRoute(self.__WB_MANIFEST);

/** Network-only document navigations — no HTML cache; failures fall through to setCatchHandler. */
registerRoute(
	new NavigationRoute(
		new NetworkOnly({
			networkTimeoutSeconds: 10
		})
	)
);

const vocabMatcher = ({ url, request }: { url: URL; request: Request }) => {
	if (request.method !== 'GET') return false;
	return (LIBRARY_VOCAB_CACHE_PATHS as readonly string[]).includes(url.pathname);
};

registerRoute(
	vocabMatcher,
	new StaleWhileRevalidate({
		cacheName: 'ppp-library-vocab-v1',
		plugins: [
			new ExpirationPlugin({
				maxEntries: 16,
				maxAgeSeconds: 60 * 60
			})
		]
	})
);

setCatchHandler(async ({ request }) => {
	if (request.mode === 'navigate') {
		const offline = await matchPrecache('/offline.html');
		if (offline) return offline;
	}
	return Response.error();
});

/**
 * If HTML navigate caching is reintroduced, bypass auth/login and SvelteKit form actions:
 * `/auth/*`, `/login`, and URLs whose search starts with `?/`.
 * SvelteKit SSR + authenticated routes should not use StaleWhileRevalidate on documents.
 */

self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		void self.skipWaiting();
	}
});

self.addEventListener('activate', (event) => {
	event.waitUntil(caches.delete('ppp-routes-v1').then(() => self.clients.claim()));
});

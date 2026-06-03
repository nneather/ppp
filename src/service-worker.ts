/// <reference lib="webworker" />
import type { PrecacheEntry } from 'workbox-precaching';
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: Array<PrecacheEntry | string>;
};

// Bump v3 (2026-06-03): SWR for static library vocab JSON only (not HTML / not mutations).
precacheAndRoute(self.__WB_MANIFEST);

const vocabMatcher = ({ url, request }: { url: URL; request: Request }) => {
	if (request.method !== 'GET') return false;
	const p = url.pathname;
	return (
		p === '/library/people.json' ||
		p === '/library/series.json' ||
		p === '/library/topic-counts.json' ||
		p === '/library/ancient-texts.json'
	);
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

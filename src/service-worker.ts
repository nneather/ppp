/// <reference lib="webworker" />
import type { PrecacheEntry } from 'workbox-precaching';
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: Array<PrecacheEntry | string>;
};

// Bump this comment (or any byte in this file) to force a new SW install + in-app refresh toast.
// Content-hashed `/_app/immutable/*` + other client assets: precache (cache-first + Workbox precache updates).
precacheAndRoute(self.__WB_MANIFEST);

function isBypass(url: URL): boolean {
	return (
		url.pathname.startsWith('/auth/') ||
		url.pathname === '/login' ||
		url.pathname.startsWith('/login/') ||
		url.search.startsWith('?/')
	);
}

registerRoute(
	({ url, request, sameOrigin }) =>
		sameOrigin && request.mode === 'navigate' && request.method === 'GET' && !isBypass(url),
	new NetworkFirst({
		cacheName: 'ppp-routes-v1',
		networkTimeoutSeconds: 3,
		plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 })]
	})
);

self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		void self.skipWaiting();
	}
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

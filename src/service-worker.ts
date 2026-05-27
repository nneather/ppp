/// <reference lib="webworker" />
import type { PrecacheEntry } from 'workbox-precaching';
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: Array<PrecacheEntry | string>;
};

// Bump v2 (2026-05-26): removed HTML navigate caching — broke iOS PWA Invoicing/Library tabs.
// Content-hashed `/_app/immutable/*` + other client assets: precache only (no route HTML cache).
precacheAndRoute(self.__WB_MANIFEST);

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

<script lang="ts">
	import { get } from 'svelte/store';
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import { Button } from '$lib/components/ui/button';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';

	const SW_UPDATE_INTERVAL_MS = 60 * 60 * 1000;

	let swRegistration = $state<ServiceWorkerRegistration | undefined>(undefined);
	/** After background → foreground, auto-apply a waiting update instead of waiting for a tap. */
	let autoApplyOnResume = $state(false);
	let suppressToast = $state(false);
	let applying = $state(false);
	/** True after the document was hidden — gates window `focus` so we don't treat in-page focus as resume. */
	let wasBackgrounded = $state(false);

	const { needRefresh, updateServiceWorker, offlineReady } = useRegisterSW({
		onRegisterError(error) {
			console.warn('[pwa] service worker registration failed', error);
		},
		onRegisteredSW(_swUrl, registration) {
			swRegistration = registration ?? undefined;
		}
	});

	$effect(() => {
		const registration = swRegistration;
		if (!registration) return;

		const checkForUpdate = () => {
			if (navigator.onLine) void registration.update();
		};

		/**
		 * Resume path (082/111): apply immediately when a worker is already waiting
		 * (Later-dismissed toast or iOS missed needRefresh), otherwise poll for a new SW
		 * and auto-apply when needRefresh flips.
		 */
		const onResume = () => {
			autoApplyOnResume = true;
			if (registration.waiting || get(needRefresh)) {
				void applyUpdate();
				return;
			}
			checkForUpdate();
		};

		const intervalId = window.setInterval(checkForUpdate, SW_UPDATE_INTERVAL_MS);

		const onVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				wasBackgrounded = true;
				return;
			}
			if (document.visibilityState !== 'visible') return;
			if (wasBackgrounded) {
				wasBackgrounded = false;
				onResume();
			}
		};

		// iOS standalone sometimes restores from bfcache without a clean visibility flip.
		const onPageShow = (event: PageTransitionEvent) => {
			if (event.persisted) onResume();
		};

		// Fallback when visibilitychange is flaky after app-switcher return.
		const onWindowFocus = () => {
			if (document.visibilityState !== 'visible' || !wasBackgrounded) return;
			wasBackgrounded = false;
			onResume();
		};

		document.addEventListener('visibilitychange', onVisibilityChange);
		window.addEventListener('pageshow', onPageShow);
		window.addEventListener('focus', onWindowFocus);

		return () => {
			window.clearInterval(intervalId);
			document.removeEventListener('visibilitychange', onVisibilityChange);
			window.removeEventListener('pageshow', onPageShow);
			window.removeEventListener('focus', onWindowFocus);
		};
	});

	$effect(() => {
		if (!$needRefresh || !autoApplyOnResume) return;
		autoApplyOnResume = false;
		void applyUpdate();
	});

	function dismiss() {
		needRefresh.set(false);
		offlineReady.set(false);
	}

	async function applyUpdate() {
		if (applying) return;
		applying = true;
		suppressToast = true;
		try {
			await updateServiceWorker(true);
		} finally {
			// Page should reload; reset if skipWaiting/reload does not run (iOS edge cases).
			applying = false;
		}
	}
</script>

{#if $needRefresh && !suppressToast}
	<div
		class="fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[60] mx-auto flex w-full max-w-sm flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-card-foreground shadow-lg"
		role="status"
		aria-live="polite"
	>
		<p class="text-center text-xs leading-snug sm:text-sm">New version available — refresh when ready</p>
		<div class="flex flex-wrap items-center justify-center gap-2">
			<Button type="button" variant="default" size="sm" hotkey="u" onclick={() => void applyUpdate()}>
				<HotkeyLabel label="Update now" mnemonic="u" />
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				hotkey="Escape"
				label="Later"
				onclick={dismiss}
			/>
		</div>
	</div>
{/if}

<script lang="ts">
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import { Button } from '$lib/components/ui/button';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';

	const SW_UPDATE_INTERVAL_MS = 60 * 60 * 1000;

	let swRegistration = $state<ServiceWorkerRegistration | undefined>(undefined);
	/** After background → foreground, auto-apply a waiting update instead of waiting for a tap. */
	let autoApplyOnResume = $state(false);
	let suppressToast = $state(false);

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

		const intervalId = window.setInterval(checkForUpdate, SW_UPDATE_INTERVAL_MS);
		const onVisibilityChange = () => {
			if (document.visibilityState !== 'visible') return;
			// Flag so a waiting (or soon-detected) update applies without a tap.
			autoApplyOnResume = true;
			checkForUpdate();
		};

		document.addEventListener('visibilitychange', onVisibilityChange);

		return () => {
			window.clearInterval(intervalId);
			document.removeEventListener('visibilitychange', onVisibilityChange);
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
		suppressToast = true;
		await updateServiceWorker(true);
	}
</script>

{#if $needRefresh && !suppressToast}
	<div
		class="fixed inset-x-0 bottom-tabbar z-[60] mx-auto flex w-full max-w-md flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg md:bottom-6"
		role="status"
		aria-live="polite"
	>
		<p class="text-center leading-snug">New version available — refresh</p>
		<div class="flex flex-wrap items-center justify-center gap-2">
			<Button type="button" variant="default" hotkey="u" onclick={() => void applyUpdate()}>
				<HotkeyLabel label="Update now" mnemonic="u" />
			</Button>
			<Button type="button" variant="outline" hotkey="Escape" label="Dismiss" onclick={dismiss} />
		</div>
	</div>
{/if}

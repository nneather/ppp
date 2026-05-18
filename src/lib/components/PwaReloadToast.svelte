<script lang="ts">
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import { Button } from '$lib/components/ui/button';
	import HotkeyLabel from '$lib/components/hotkey-label.svelte';

	const { needRefresh, updateServiceWorker, offlineReady } = useRegisterSW({
		onRegisterError(error) {
			console.warn('[pwa] service worker registration failed', error);
		}
	});

	function dismiss() {
		needRefresh.set(false);
		offlineReady.set(false);
	}

	async function applyUpdate() {
		await updateServiceWorker(true);
	}
</script>

{#if $needRefresh}
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

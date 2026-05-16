<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { tick, onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		fetchOpenLibraryPrefill,
		LIBRARY_OL_PREFILL_KEY,
		type OpenLibraryBookPrefill
	} from '$lib/library/open-library-prefill';
	import { parseIsbnWithChecksum } from '$lib/library/isbn';
	import { markScanSessionForNewBook } from '$lib/library/scan-session';
	import { BrowserMultiFormatReader } from '@zxing/browser';
	import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Barcode from '@lucide/svelte/icons/scan-barcode';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	const hints = new Map<DecodeHintType, BarcodeFormat[]>();
	hints.set(DecodeHintType.POSSIBLE_FORMATS, [
		BarcodeFormat.EAN_13,
		BarcodeFormat.EAN_8,
		BarcodeFormat.UPC_A,
		BarcodeFormat.UPC_E,
		BarcodeFormat.CODE_128
	]);

	const DECODE_CONFIRM_MS = 650;

	let manualIsbn = $state('');
	let statusMessage = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let lookupPending = $state(false);
	let scanActive = $state(false);
	let cameraTipDismissed = $state(false);
	let permissionHint = $state<string | null>(null);

	let videoEl = $state<HTMLVideoElement | null>(null);
	let controlsStop: (() => void) | null = null;
	/** One reader per page mount; avoids orphaning streams across rescans. */
	let scanReader: BrowserMultiFormatReader | null = null;

	let lastDecode: { digits: string; t: number } | null = null;
	let cameraAutoStartAttempted = $state(false);

	function stopScan() {
		try {
			controlsStop?.();
		} catch {
			/* noop */
		}
		controlsStop = null;
		BrowserMultiFormatReader.releaseAllStreams();
		if (videoEl) {
			try {
				const stream = videoEl.srcObject;
				if (stream instanceof MediaStream) {
					for (const track of stream.getTracks()) {
						try {
							track.stop();
						} catch {
							/* noop */
						}
					}
				}
				videoEl.srcObject = null;
			} catch {
				/* noop */
			}
		}
		scanActive = false;
		lastDecode = null;
	}

	function noteDecodeForConfirm(digits: string): boolean {
		const now = Date.now();
		if (lastDecode && lastDecode.digits === digits && now - lastDecode.t <= DECODE_CONFIRM_MS) {
			lastDecode = null;
			return true;
		}
		lastDecode = { digits, t: now };
		statusMessage = 'Hold steady — confirming barcode…';
		return false;
	}

	async function applyOpenLibraryAndGo(isbnRaw: string) {
		stopScan();
		errorMessage = null;
		statusMessage = null;
		const validated = parseIsbnWithChecksum(isbnRaw);
		if (!validated) {
			errorMessage =
				'That barcode is not a valid ISBN (wrong length or check digit). Keep scanning or use manual entry.';
			return;
		}
		lookupPending = true;
		try {
			const prefill: OpenLibraryBookPrefill = await fetchOpenLibraryPrefill(validated);
			if (browser) {
				sessionStorage.setItem(LIBRARY_OL_PREFILL_KEY, JSON.stringify(prefill));
				markScanSessionForNewBook();
			}
			goto('/library/books/new');
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Lookup failed.';
		} finally {
			lookupPending = false;
		}
	}

	async function onManualLookup() {
		const validated = parseIsbnWithChecksum(manualIsbn);
		if (!validated) {
			errorMessage =
				'Enter a valid ISBN-10 or ISBN-13 (digits and check letter X if needed). Check digit did not match.';
			return;
		}
		await applyOpenLibraryAndGo(validated);
	}

	async function startScan() {
		if (!browser || !videoEl) return;
		stopScan();
		errorMessage = null;
		statusMessage = 'Point the camera at the barcode…';
		scanActive = true;
		lastDecode = null;
		scanReader ??= new BrowserMultiFormatReader(hints);
		try {
			const controls = await scanReader.decodeFromVideoDevice(undefined, videoEl, (result, err) => {
				if (err) {
					if (err instanceof NotFoundException) return;
					errorMessage = err instanceof Error ? err.message : 'Scan error.';
					return;
				}
				if (!result) return;
				const text = result.getText();
				const validated = parseIsbnWithChecksum(text);
				if (!validated) {
					return;
				}
				if (!noteDecodeForConfirm(validated)) {
					return;
				}
				void applyOpenLibraryAndGo(validated);
			});
			controlsStop = () => controls.stop();
		} catch (e) {
			scanActive = false;
			errorMessage =
				e instanceof Error
					? e.message.includes('Permission') || e.message.includes('NotAllowed')
						? 'Camera access was denied. Use manual ISBN below, or allow the camera for this site in browser settings.'
						: e.message
					: 'Could not start the camera.';
		}
	}

	onMount(() => {
		if (!browser) return;
		try {
			const p = navigator.permissions?.query?.({ name: 'camera' as PermissionName });
			void p?.then((status) => {
				if (status.state === 'denied') {
					permissionHint =
						'Camera is blocked for this site. Open your browser’s site settings and set Camera to Allow to scan without being prompted each time (when the browser allows it).';
				}
			});
		} catch {
			/* Permissions API unsupported or camera name not in this browser */
		}
	});

	$effect(() => {
		if (!browser || !videoEl || lookupPending || cameraAutoStartAttempted) return;
		cameraAutoStartAttempted = true;
		void tick().then(() => {
			void startScan();
		});
	});

	$effect(() => {
		return () => {
			stopScan();
		};
	});
</script>

<svelte:head>
	<title>Add by ISBN — Library — ppp</title>
</svelte:head>

<div class="mx-auto max-w-lg px-4 py-6 md:px-6 md:py-8">
	<a
		href="/library"
		class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> Library
	</a>

	<header class="mt-4 flex items-center gap-2 text-muted-foreground">
		<Barcode class="size-6" />
		<h1 class="text-2xl font-semibold tracking-tight text-foreground">Add by ISBN</h1>
	</header>
	<p class="mt-2 text-sm text-muted-foreground">
		Scan a book barcode or type an ISBN. We fetch metadata from
		<a
			href="https://openlibrary.org"
			class="font-medium text-primary underline-offset-4 hover:underline"
			target="_blank"
			rel="noreferrer">Open Library</a
		>
		then open the new-book form so you can review everything before saving.
	</p>

	{#if permissionHint}
		<p class="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
			{permissionHint}
		</p>
	{/if}

	{#if !cameraTipDismissed}
		<details class="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
			<summary class="cursor-pointer font-medium text-foreground">Camera tips</summary>
			<p class="mt-2">
				The browser controls camera access. For fewer prompts, use this site over HTTPS, avoid private
				browsing, and set this site’s camera permission to <strong class="text-foreground">Allow</strong>
				(not “Ask every time”) in site settings (lock or tune icon in the address bar on desktop; Safari
				<strong class="text-foreground">Settings → Safari → Camera</strong> on iOS for per-site behavior).
			</p>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				class="mt-2 h-8 px-2 text-xs"
				onclick={() => (cameraTipDismissed = true)}
			>
				Dismiss
			</Button>
		</details>
	{/if}

	{#if errorMessage}
		<p
			class="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
			role="alert"
		>
			{errorMessage}
		</p>
	{/if}
	{#if statusMessage && !errorMessage}
		<p class="mt-4 text-sm text-muted-foreground" aria-live="polite">{statusMessage}</p>
	{/if}

	<section class="mt-6 space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
		<h2 class="text-sm font-semibold tracking-tight text-foreground">Scan barcode</h2>
		<div class="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-black/80">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video bind:this={videoEl} class="h-full w-full object-cover" playsinline muted></video>
			{#if !scanActive && !lookupPending}
				<button
					type="button"
					class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 px-4 text-center text-sm font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-white"
					onclick={() => void startScan()}
				>
					<Barcode class="size-10 opacity-90" aria-hidden="true" />
					<span>Tap to start camera</span>
				</button>
			{/if}
		</div>
		<div class="flex flex-wrap gap-2">
			{#if scanActive}
				<Button type="button" variant="outline" class="min-h-11" onclick={() => stopScan()}>
					Stop camera
				</Button>
			{:else}
				<Button
					type="button"
					class="min-h-11"
					disabled={lookupPending}
					onclick={() => void startScan()}
				>
					{#if lookupPending}
						<Loader2 class="size-4 animate-spin" /> Looking up…
					{:else}
						<Barcode class="size-4" /> Start camera scan
					{/if}
				</Button>
			{/if}
		</div>
	</section>

	<section class="mt-8 space-y-3">
		<h2 class="text-sm font-semibold tracking-tight text-foreground">Manual ISBN</h2>
		<div class="space-y-2">
			<Label for="manual-isbn">ISBN-10 or ISBN-13</Label>
			<Input
				id="manual-isbn"
				type="text"
				inputmode="numeric"
				autocomplete="off"
				bind:value={manualIsbn}
				placeholder="978… or 0-…"
				class="h-12 min-h-11 text-base"
				disabled={lookupPending}
			/>
		</div>
		<Button
			type="button"
			class="min-h-11 w-full sm:w-auto"
			disabled={lookupPending}
			onclick={() => void onManualLookup()}
		>
			{#if lookupPending}
				<Loader2 class="size-4 animate-spin" /> Looking up…
			{:else}
				<BookOpen class="size-4" /> Look up &amp; open form
			{/if}
		</Button>
	</section>
</div>

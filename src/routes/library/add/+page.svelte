<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		fetchOpenLibraryPrefill,
		LIBRARY_OL_PREFILL_KEY,
		normalizeIsbnDigits,
		type OpenLibraryBookPrefill
	} from '$lib/library/open-library-prefill';
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

	let manualIsbn = $state('');
	let statusMessage = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let lookupPending = $state(false);
	let scanActive = $state(false);

	let videoEl = $state<HTMLVideoElement | null>(null);
	let controlsStop: (() => void) | null = null;

	function stopScan() {
		try {
			controlsStop?.();
		} catch {
			/* noop */
		}
		controlsStop = null;
		BrowserMultiFormatReader.releaseAllStreams();
		scanActive = false;
	}

	async function applyOpenLibraryAndGo(isbnRaw: string) {
		stopScan();
		errorMessage = null;
		statusMessage = null;
		lookupPending = true;
		try {
			const prefill: OpenLibraryBookPrefill = await fetchOpenLibraryPrefill(isbnRaw);
			if (browser) {
				sessionStorage.setItem(LIBRARY_OL_PREFILL_KEY, JSON.stringify(prefill));
			}
			goto('/library/books/new');
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Lookup failed.';
		} finally {
			lookupPending = false;
		}
	}

	async function onManualLookup() {
		const n = normalizeIsbnDigits(manualIsbn);
		if (!n) {
			errorMessage = 'Enter a 10- or 13-digit ISBN (digits only or dashed).';
			return;
		}
		await applyOpenLibraryAndGo(n);
	}

	async function startScan() {
		if (!browser || !videoEl) return;
		errorMessage = null;
		statusMessage = 'Point the camera at the barcode…';
		scanActive = true;
		const reader = new BrowserMultiFormatReader(hints);
		try {
			const controls = await reader.decodeFromVideoDevice(undefined, videoEl, (result, err) => {
				if (err) {
					if (err instanceof NotFoundException) return;
					errorMessage = err instanceof Error ? err.message : 'Scan error.';
					return;
				}
				if (!result) return;
				const text = result.getText();
				const isbn = normalizeIsbnDigits(text);
				if (!isbn) {
					errorMessage = `Scanned "${text}" — not a usable ISBN. Try manual entry.`;
					stopScan();
					return;
				}
				void applyOpenLibraryAndGo(isbn);
			});
			controlsStop = () => controls.stop();
		} catch (e) {
			scanActive = false;
			errorMessage =
				e instanceof Error
					? e.message.includes('Permission') || e.message.includes('NotAllowed')
						? 'Camera access was denied. Use manual ISBN below.'
						: e.message
					: 'Could not start the camera.';
		}
	}

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
		<div class="aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-black/80">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video bind:this={videoEl} class="h-full w-full object-cover" playsinline muted></video>
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

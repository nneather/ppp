<script lang="ts" module>
	export type OlApplyKey =
		| 'title'
		| 'subtitle'
		| 'publisher'
		| 'publisher_location'
		| 'year'
		| 'edition'
		| 'page_count'
		| 'isbn'
		| 'genre';
</script>

<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		fetchOpenLibraryPrefill,
		type OpenLibraryBookPrefill
	} from '$lib/library/open-library-prefill';
	import { parseIsbnWithChecksum } from '$lib/library/isbn';
	import { BrowserMultiFormatReader } from '@zxing/browser';
	import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import Barcode from '@lucide/svelte/icons/scan-barcode';

	type CurrentSnapshot = {
		title: string;
		subtitle: string;
		publisher: string;
		publisher_location: string;
		year: string;
		edition: string;
		page_count: string;
		isbn: string;
		genre: string;
	};

	let {
		open = $bindable(false),
		initialIsbn = '',
		current,
		onApply
	}: {
		open?: boolean;
		initialIsbn?: string;
		current: CurrentSnapshot;
		onApply: (keys: OlApplyKey[], data: OpenLibraryBookPrefill) => void;
	} = $props();

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
	let videoEl = $state<HTMLVideoElement | null>(null);
	let controlsStop: (() => void) | null = null;
	/** One reader per dialog instance; avoids orphaning streams across rescans. */
	let scanReader: BrowserMultiFormatReader | null = null;
	let lastDecode: { digits: string; t: number } | null = null;

	let prefill = $state<OpenLibraryBookPrefill | null>(null);
	let pickTitle = $state(false);
	let pickSubtitle = $state(false);
	let pickPublisher = $state(false);
	let pickPublisherLocation = $state(false);
	let pickYear = $state(false);
	let pickEdition = $state(false);
	let pickPageCount = $state(false);
	let pickIsbn = $state(false);
	let pickGenre = $state(false);

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

	function resetPicks() {
		prefill = null;
		pickTitle = false;
		pickSubtitle = false;
		pickPublisher = false;
		pickPublisherLocation = false;
		pickYear = false;
		pickEdition = false;
		pickPageCount = false;
		pickIsbn = false;
		pickGenre = false;
	}

	function defaultPick(
		incoming: string | null | number | undefined,
		currentStr: string
	): boolean {
		if (incoming == null || incoming === '') return false;
		const inc =
			typeof incoming === 'number'
				? String(incoming)
				: typeof incoming === 'string'
					? incoming.trim()
					: '';
		if (!inc) return false;
		const cur = (currentStr ?? '').trim();
		if (!cur) return true;
		return cur === inc;
	}

	function setPicksFromPrefill(p: OpenLibraryBookPrefill) {
		pickTitle = defaultPick(p.title, current.title);
		pickSubtitle = defaultPick(p.subtitle, current.subtitle);
		pickPublisher = defaultPick(p.publisher, current.publisher);
		pickPublisherLocation = defaultPick(p.publisher_location, current.publisher_location);
		pickYear = p.year != null && defaultPick(String(p.year), current.year);
		pickEdition = defaultPick(p.edition, current.edition);
		pickPageCount =
			p.page_count != null && defaultPick(String(p.page_count), current.page_count);
		pickIsbn = defaultPick(p.isbn, current.isbn);
		pickGenre =
			Boolean(p.genreSuggested) &&
			(!current.genre.trim() || current.genre === (p.genreSuggested as string));
	}

	$effect(() => {
		if (!open) {
			stopScan();
			errorMessage = null;
			statusMessage = null;
			lookupPending = false;
			resetPicks();
			return;
		}
		manualIsbn = initialIsbn.trim();
		errorMessage = null;
		statusMessage = null;
		prefill = null;
		resetPicks();
	});

	onMount(() => {
		return () => stopScan();
	});

	async function runLookup(isbnRaw: string) {
		stopScan();
		errorMessage = null;
		statusMessage = null;
		const validated = parseIsbnWithChecksum(isbnRaw);
		if (!validated) {
			errorMessage =
				'That value is not a valid ISBN (wrong length or check digit). Try again or enter digits manually.';
			return;
		}
		lookupPending = true;
		try {
			const p = await fetchOpenLibraryPrefill(validated);
			prefill = p;
			setPicksFromPrefill(p);
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Lookup failed.';
		} finally {
			lookupPending = false;
		}
	}

	async function onManualLookup() {
		await runLookup(manualIsbn);
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
				if (!validated) return;
				if (!noteDecodeForConfirm(validated)) return;
				manualIsbn = validated;
				void runLookup(validated);
			});
			controlsStop = () => controls.stop();
		} catch (e) {
			scanActive = false;
			errorMessage =
				e instanceof Error
					? e.message.includes('Permission') || e.message.includes('NotAllowed')
						? 'Camera access was denied. Use manual ISBN entry below.'
						: e.message
					: 'Could not start the camera.';
		}
	}

	function submitApply() {
		if (!prefill) return;
		const keys: OlApplyKey[] = [];
		if (pickTitle) keys.push('title');
		if (pickSubtitle) keys.push('subtitle');
		if (pickPublisher) keys.push('publisher');
		if (pickPublisherLocation) keys.push('publisher_location');
		if (pickYear) keys.push('year');
		if (pickEdition) keys.push('edition');
		if (pickPageCount) keys.push('page_count');
		if (pickIsbn) keys.push('isbn');
		if (pickGenre && prefill.genreSuggested) keys.push('genre');
		if (keys.length === 0) {
			errorMessage = 'Select at least one field to update.';
			return;
		}
		onApply(keys, prefill);
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Refresh from Open Library</Dialog.Title>
			<Dialog.Description class="text-muted-foreground text-sm">
				Look up an ISBN and choose which fields to copy into this book. Authors are not changed
				here.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-4 py-2">
			{#if !prefill && !lookupPending}
				<div class="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-black/80">
					<video bind:this={videoEl} class="h-full w-full object-cover" playsinline muted></video>
					{#if !scanActive}
						<div
							class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 p-4 text-center text-sm text-white"
						>
							<p>Camera starts automatically when available.</p>
							<Button type="button" variant="secondary" class="gap-2" onclick={startScan}>
								<Barcode class="size-4" /> Start camera scan
							</Button>
						</div>
					{/if}
				</div>
			{/if}

			<div class="space-y-2">
				<Label for="ol-refresh-isbn">ISBN-10 or ISBN-13</Label>
				<div class="flex flex-wrap gap-2">
					<Input
						id="ol-refresh-isbn"
						bind:value={manualIsbn}
						class="min-w-[12rem] flex-1 font-mono text-sm"
						autocomplete="off"
					/>
					<Button type="button" onclick={onManualLookup} disabled={lookupPending} class="gap-2">
						{#if lookupPending}
							<Loader2 class="size-4 animate-spin" /> Fetching…
						{:else}
							Fetch
						{/if}
					</Button>
				</div>
			</div>

			{#if errorMessage}
				<p class="text-sm text-destructive" role="alert">{errorMessage}</p>
			{/if}
			{#if statusMessage}
				<p class="text-sm text-muted-foreground">{statusMessage}</p>
			{/if}

			{#if prefill}
				<div class="space-y-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
					<p class="font-medium text-foreground">Choose fields to apply</p>
					<label class="flex cursor-pointer items-start gap-2">
						<input type="checkbox" bind:checked={pickTitle} class="mt-1 size-4 shrink-0" />
						<span>
							<span class="font-medium">Title</span>
							<span class="block text-muted-foreground">{prefill.title ?? '—'}</span>
						</span>
					</label>
					<label class="flex cursor-pointer items-start gap-2">
						<input type="checkbox" bind:checked={pickSubtitle} class="mt-1 size-4 shrink-0" />
						<span>
							<span class="font-medium">Subtitle</span>
							<span class="block text-muted-foreground">{prefill.subtitle ?? '—'}</span>
						</span>
					</label>
					<label class="flex cursor-pointer items-start gap-2">
						<input type="checkbox" bind:checked={pickPublisher} class="mt-1 size-4 shrink-0" />
						<span>
							<span class="font-medium">Publisher</span>
							<span class="block text-muted-foreground">{prefill.publisher ?? '—'}</span>
						</span>
					</label>
					<label class="flex cursor-pointer items-start gap-2">
						<input
							type="checkbox"
							bind:checked={pickPublisherLocation}
							class="mt-1 size-4 shrink-0"
						/>
						<span>
							<span class="font-medium">Publisher location</span>
							<span class="block text-muted-foreground">{prefill.publisher_location ?? '—'}</span>
						</span>
					</label>
					<label class="flex cursor-pointer items-start gap-2">
						<input type="checkbox" bind:checked={pickYear} class="mt-1 size-4 shrink-0" />
						<span>
							<span class="font-medium">Year</span>
							<span class="block text-muted-foreground">{prefill.year ?? '—'}</span>
						</span>
					</label>
					<label class="flex cursor-pointer items-start gap-2">
						<input type="checkbox" bind:checked={pickEdition} class="mt-1 size-4 shrink-0" />
						<span>
							<span class="font-medium">Edition</span>
							<span class="block text-muted-foreground">{prefill.edition ?? '—'}</span>
						</span>
					</label>
					<label class="flex cursor-pointer items-start gap-2">
						<input type="checkbox" bind:checked={pickPageCount} class="mt-1 size-4 shrink-0" />
						<span>
							<span class="font-medium">Page count</span>
							<span class="block text-muted-foreground">{prefill.page_count ?? '—'}</span>
						</span>
					</label>
					<label class="flex cursor-pointer items-start gap-2">
						<input type="checkbox" bind:checked={pickIsbn} class="mt-1 size-4 shrink-0" />
						<span>
							<span class="font-medium">ISBN (normalized)</span>
							<span class="block font-mono text-muted-foreground">{prefill.isbn}</span>
						</span>
					</label>
					{#if prefill.genreSuggested}
						<label class="flex cursor-pointer items-start gap-2">
							<input type="checkbox" bind:checked={pickGenre} class="mt-1 size-4 shrink-0" />
							<span>
								<span class="font-medium">Genre (suggested)</span>
								<span class="block text-muted-foreground">{prefill.genreSuggested}</span>
							</span>
						</label>
					{/if}
				</div>
			{/if}
		</div>

		<Dialog.Footer class="flex-col gap-2 sm:flex-row sm:justify-end">
			<Button type="button" variant="outline" hotkey="Escape" label="Cancel" onclick={() => (open = false)} />
			<Button
				type="button"
				disabled={!prefill || lookupPending}
				hotkey="u"
				label="Update fields"
				onclick={submitApply}
			/>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

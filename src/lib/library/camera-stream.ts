/**
 * Module-scoped camera stream for library barcode flows.
 * Keeps a single warm MediaStream across navigations so iOS standalone PWA
 * does not re-prompt on every /library/add remount. Tracks are stopped only
 * on explicit release, idle timeout, or document visibility hidden.
 */

let cachedStream: MediaStream | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
let visibilityListenerBound = false;

function clearReleaseTimer() {
	if (releaseTimer != null) {
		clearTimeout(releaseTimer);
		releaseTimer = null;
	}
}

function ensureVisibilityListener() {
	if (visibilityListenerBound || typeof document === 'undefined') return;
	visibilityListenerBound = true;
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			releaseCameraStreamNow();
		}
	});
}

function streamHasLiveVideoTrack(stream: MediaStream | null): boolean {
	if (!stream) return false;
	return stream.getVideoTracks().some((t) => t.readyState === 'live');
}

/**
 * Returns the cached stream if still live, otherwise acquires via getUserMedia.
 * SSR: throws — only call from the browser after `browser` checks.
 */
export async function acquireCameraStream(): Promise<MediaStream> {
	if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
		throw new Error('Camera not available');
	}
	clearReleaseTimer();
	ensureVisibilityListener();
	if (streamHasLiveVideoTrack(cachedStream)) {
		return cachedStream as MediaStream;
	}
	if (cachedStream) {
		releaseCameraStreamNow();
	}
	const stream = await navigator.mediaDevices.getUserMedia({
		video: { facingMode: { ideal: 'environment' } },
		audio: false
	});
	cachedStream = stream;
	return stream;
}

/** After idleMs with no acquire, stops tracks and clears cache. */
export function scheduleReleaseCameraStream(idleMs = 15_000): void {
	if (typeof window === 'undefined') return;
	clearReleaseTimer();
	releaseTimer = setTimeout(() => {
		releaseTimer = null;
		releaseCameraStreamNow();
	}, idleMs);
}

/** Stops all tracks immediately and clears cache. */
export function releaseCameraStreamNow(): void {
	clearReleaseTimer();
	if (!cachedStream) return;
	try {
		for (const track of cachedStream.getTracks()) {
			try {
				track.stop();
			} catch {
				/* noop */
			}
		}
	} catch {
		/* noop */
	}
	cachedStream = null;
}

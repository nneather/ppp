<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { createClient } from '$lib/supabase/client';
	import { transcribeStudyAudio } from '$lib/studies/transcribe-client';
	import {
		MAX_AUDIO_MS,
		pickRecorderFormat,
		recordingRejectReason
	} from '$lib/studies/voice-capture';

	let {
		keywords,
		disabled = false,
		busy = $bindable(false),
		onText
	}: {
		keywords: string[];
		disabled?: boolean;
		busy?: boolean;
		onText: (text: string) => void;
	} = $props();

	let phase = $state<'idle' | 'recording' | 'transcribing'>('idle');
	let seconds = $state(0);
	let error = $state<string | null>(null);

	let recorder: MediaRecorder | null = null;
	let stream: MediaStream | null = null;
	let chunks: Blob[] = [];
	let startedAt = 0;
	let stopTimer: ReturnType<typeof setTimeout> | null = null;
	let tickTimer: ReturnType<typeof setInterval> | null = null;
	let disposed = false;
	let generation = 0;

	function setPhase(next: 'idle' | 'recording' | 'transcribing') {
		phase = next;
		busy = next !== 'idle';
	}

	function clearTimers() {
		if (stopTimer) clearTimeout(stopTimer);
		if (tickTimer) clearInterval(tickTimer);
		stopTimer = null;
		tickTimer = null;
	}

	function releaseStream() {
		stream?.getTracks().forEach((track) => track.stop());
		stream = null;
		recorder = null;
	}

	async function finish(blob: Blob, format: NonNullable<ReturnType<typeof pickRecorderFormat>>, elapsedMs: number) {
		if (disposed) return;
		setPhase('transcribing');
		const reason = recordingRejectReason({ bytes: blob.size, elapsedMs });
		if (reason) {
			setPhase('idle');
			error = reason;
			return;
		}
		const supabase = createClient();
		const { data } = await supabase.auth.getSession();
		const userId = data.session?.user.id;
		if (!userId) {
			setPhase('idle');
			error = 'Sign in again, then record.';
			return;
		}
		const result = await transcribeStudyAudio({
			supabase,
			userId,
			blob,
			ext: format.ext,
			uploadMime: format.uploadMime,
			keywords
		});
		if (disposed) return;
		setPhase('idle');
		if (!result.ok) {
			error = result.message;
			return;
		}
		onText(result.text);
	}

	function stop() {
		generation += 1;
		clearTimers();
		if (recorder && recorder.state !== 'inactive') {
			recorder.stop();
			return;
		}
		releaseStream();
		if (phase === 'recording') setPhase('idle');
	}

	async function start() {
		if (phase !== 'idle') return;
		error = null;
		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
			error = 'This browser cannot record audio.';
			return;
		}
		const format = pickRecorderFormat((mime) => MediaRecorder.isTypeSupported(mime));
		if (!format) {
			error = 'This browser cannot record audio.';
			return;
		}
		const gen = ++generation;
		setPhase('recording');
		seconds = 0;
		let media: MediaStream;
		try {
			media = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch {
			if (gen === generation && !disposed) {
				setPhase('idle');
				error = 'Microphone permission is blocked.';
			}
			return;
		}
		if (disposed || gen !== generation) {
			media.getTracks().forEach((track) => track.stop());
			return;
		}
		stream = media;
		chunks = [];
		const rec = new MediaRecorder(media, { mimeType: format.recorderMime });
		recorder = rec;
		rec.ondataavailable = (event) => {
			if (event.data.size > 0) chunks.push(event.data);
		};
		rec.onstop = () => {
			const blob = new Blob(chunks, { type: format.uploadMime });
			const elapsedMs = Date.now() - startedAt;
			releaseStream();
			void finish(blob, format, elapsedMs);
		};
		startedAt = Date.now();
		tickTimer = setInterval(() => {
			seconds = Math.min(60, Math.round((Date.now() - startedAt) / 1000));
		}, 250);
		stopTimer = setTimeout(() => stop(), MAX_AUDIO_MS);
		rec.start();
	}

	onDestroy(() => {
		disposed = true;
		clearTimers();
		if (recorder && recorder.state !== 'inactive') recorder.stop();
		releaseStream();
	});

	const label = $derived(
		phase === 'recording' ? `Stop ${seconds}s` : phase === 'transcribing' ? 'Transcribing…' : 'Record'
	);
</script>

<div
	class="inline-flex flex-col gap-1"
	data-ppp-recording={phase !== 'idle' ? '' : undefined}
>
	<Button
		type="button"
		variant="outline"
		label={label}
		disabled={disabled || phase === 'transcribing'}
		aria-pressed={phase === 'recording'}
		onclick={() => (phase === 'recording' ? stop() : start())}
	/>
	{#if error}
		<p class="text-xs text-destructive" role="alert">{error}</p>
	{/if}
</div>

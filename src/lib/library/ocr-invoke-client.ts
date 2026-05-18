import type { SupabaseClient } from '@supabase/supabase-js';
import type { OcrScriptureExtractResponse } from '$lib/library/ocr-scripture-refs';

/** Edge Functions return `{ error: string }` on non-2xx; supabase-js may surface it on `data`. */
export function ocrInvokeDataError(data: unknown): string | null {
	if (data && typeof data === 'object' && data !== null && 'error' in data) {
		const e = (data as { error: unknown }).error;
		if (typeof e === 'string' && e.length > 0) return e;
	}
	return null;
}

/** Non-2xx invokes set `error` with generic text; real `{ error }` JSON is on `context` (Response). */
export async function readEdgeErrorBody(
	err: unknown
): Promise<{ status: number | null; message: string | null }> {
	if (!err || typeof err !== 'object') return { status: null, message: null };
	const ctx = (err as { context?: unknown }).context;
	if (!(ctx instanceof Response)) return { status: null, message: null };
	const status = ctx.status;
	try {
		const j: unknown = await ctx.clone().json();
		if (
			j &&
			typeof j === 'object' &&
			'error' in j &&
			typeof (j as { error: unknown }).error === 'string'
		) {
			return { status, message: (j as { error: string }).error };
		}
	} catch {
		/* not json */
	}
	try {
		const t = (await ctx.clone().text()).trim();
		if (t && !t.startsWith('<')) return { status, message: t.slice(0, 500) };
	} catch {
		/* ignore */
	}
	return { status, message: null };
}

export type InvokeOcrScriptureRefsArgs = {
	object_path: string;
	mime_type: string;
	book_id: string;
};

export type InvokeOcrScriptureRefsResult =
	| { ok: true; data: OcrScriptureExtractResponse }
	| { ok: false; message: string };

/** Call `ocr_scripture_refs` from browser or server — user JWT must be on the Supabase client session. */
export async function invokeOcrScriptureRefs(
	supabase: SupabaseClient,
	args: InvokeOcrScriptureRefsArgs
): Promise<InvokeOcrScriptureRefsResult> {
	const { data: ocrData, error: ocrErr } = await supabase.functions.invoke('ocr_scripture_refs', {
		body: args
	});

	if (ocrErr) {
		const { status, message } = await readEdgeErrorBody(ocrErr);
		const detail =
			message ??
			ocrInvokeDataError(ocrData) ??
			(ocrErr instanceof Error ? ocrErr.message : String(ocrErr)) ??
			'OCR request failed.';
		const suffix = status ? ` (HTTP ${status})` : '';
		return { ok: false, message: `${detail}${suffix}` };
	}

	const msgFromData = ocrInvokeDataError(ocrData);
	if (msgFromData) {
		return { ok: false, message: msgFromData };
	}

	const payload = ocrData as Partial<OcrScriptureExtractResponse> | null;
	if (!payload || typeof payload.rawText !== 'string' || !Array.isArray(payload.candidates)) {
		return { ok: false, message: 'Unexpected response from OCR service.' };
	}

	return {
		ok: true,
		data: { rawText: payload.rawText, candidates: payload.candidates }
	};
}

const NETWORK_ABORT_MESSAGES = new Set([
	'load failed',
	'failed to fetch',
	'networkerror when attempting to fetch resource',
	'the network connection was lost',
	'network request failed'
]);

/** Map WebKit/Safari generic fetch aborts to actionable OCR copy. */
export function formatOcrPipelineError(err: unknown): string {
	if (!(err instanceof Error)) return 'Pipeline failed.';
	const normalized = err.message.trim().toLowerCase();
	if (NETWORK_ABORT_MESSAGES.has(normalized)) {
		return 'OCR request timed out or lost connection. Multi-page PDFs can take 1–3 minutes — try splitting the PDF, or retry on Wi‑Fi.';
	}
	return err.message;
}

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

export type OcrInvokeBaseArgs = {
	object_path: string;
	mime_type: string;
	book_id: string;
};

export type InvokeOcrScriptureRefsArgs = OcrInvokeBaseArgs & {
	pdf_page_index?: number;
};

export type InvokeOcrScriptureRefsResult =
	| { ok: true; data: OcrScriptureExtractResponse }
	| { ok: false; message: string };

export type GetPdfPageCountResult =
	| { ok: true; page_count: number }
	| { ok: false; message: string };

function formatEdgeInvokeFailure(
	detail: string,
	status: number | null,
	mimeType?: string
): string {
	const lower = detail.toLowerCase();
	if (
		status === 504 ||
		lower.includes('failed to send a request to the edge function') ||
		lower.includes('gateway timeout')
	) {
		if (mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp') {
			return 'OCR timed out on the server (~150s limit per page). This page is very dense — retry, or photograph half the page in Genius Scan.';
		}
		return 'OCR timed out on the server (~150s limit per page). Multi-page PDFs are processed one page at a time — wait for each page to finish, or split the scan.';
	}
	const suffix = status ? ` (HTTP ${status})` : '';
	return `${detail}${suffix}`;
}

async function invokeOcrFunction(
	supabase: SupabaseClient,
	body: Record<string, unknown>
): Promise<{ data: unknown; error: unknown }> {
	const { data, error } = await supabase.functions.invoke('ocr_scripture_refs', { body });
	return { data, error };
}

async function parseInvokeFailure(
	data: unknown,
	err: unknown,
	mimeType?: string
): Promise<{ ok: false; message: string }> {
	if (err) {
		const { status, message } = await readEdgeErrorBody(err);
		const detail =
			message ??
			ocrInvokeDataError(data) ??
			(err instanceof Error ? err.message : String(err)) ??
			'OCR request failed.';
		return { ok: false, message: formatEdgeInvokeFailure(detail, status, mimeType) };
	}
	const msgFromData = ocrInvokeDataError(data);
	if (msgFromData) {
		return { ok: false, message: msgFromData };
	}
	return { ok: false, message: 'OCR request failed.' };
}

/** Fast page count for an uploaded PDF in storage (no Anthropic call). */
export async function getPdfPageCount(
	supabase: SupabaseClient,
	args: OcrInvokeBaseArgs
): Promise<GetPdfPageCountResult> {
	const { data, error } = await invokeOcrFunction(supabase, {
		...args,
		op: 'pdf_page_count'
	});
	if (error || ocrInvokeDataError(data)) {
		const fail = await parseInvokeFailure(data, error, args.mime_type);
		return fail;
	}
	const payload = data as { page_count?: unknown } | null;
	if (!payload || typeof payload.page_count !== 'number' || !Number.isFinite(payload.page_count)) {
		return { ok: false, message: 'Unexpected response from OCR page-count.' };
	}
	const page_count = Math.max(1, Math.trunc(payload.page_count));
	return { ok: true, page_count };
}

/** Call `ocr_scripture_refs` from browser or server — user JWT must be on the Supabase client session. */
export async function invokeOcrScriptureRefs(
	supabase: SupabaseClient,
	args: InvokeOcrScriptureRefsArgs
): Promise<InvokeOcrScriptureRefsResult> {
	const body: Record<string, unknown> = {
		object_path: args.object_path,
		mime_type: args.mime_type,
		book_id: args.book_id,
		op: 'extract'
	};
	if (args.pdf_page_index != null) {
		body.pdf_page_index = args.pdf_page_index;
	}

	const { data: ocrData, error: ocrErr } = await invokeOcrFunction(supabase, body);

	if (ocrErr || ocrInvokeDataError(ocrData)) {
		return parseInvokeFailure(ocrData, ocrErr, args.mime_type);
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
		return 'OCR request timed out or lost connection. Multi-page PDFs are processed one page at a time — wait for each page to finish, or retry on Wi‑Fi.';
	}
	return err.message;
}

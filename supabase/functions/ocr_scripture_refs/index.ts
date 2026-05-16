/** OCR scripture refs — returns structured candidates only; never writes DB rows. */

import { createClient } from '@supabase/supabase-js';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { BIBLE_BOOK_SET, BIBLE_BOOK_NAMES } from './bible-book-allowlist.ts';

const corsHeaders: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const SCRIPTURE_IMAGES_BUCKET = 'library-scripture-images';
/** ~4.5 MiB raw keeps base64 payload under typical 5–8 MiB API limits after encoding. */
const MAX_IMAGE_BYTES = 4_718_592;
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' }
	});
}

/** Resolves the current user id via GoTrue (supports ES256); avoids local JWT verify in Edge. */
async function getUserIdFromAuthApi(
	supabaseUrl: string,
	anonKey: string,
	authHeader: string
): Promise<string | null> {
	const base = supabaseUrl.replace(/\/$/, '');
	const res = await fetch(`${base}/auth/v1/user`, {
		headers: {
			Authorization: authHeader,
			apikey: anonKey
		}
	});
	if (!res.ok) return null;
	let body: unknown;
	try {
		body = await res.json();
	} catch {
		return null;
	}
	if (!body || typeof body !== 'object') return null;
	const id = (body as { id?: unknown }).id;
	return typeof id === 'string' && id.length > 0 ? id : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pathMatchesUserAndBook(objectPath: string, userId: string, bookId: string): boolean {
	const segments = objectPath.split('/').filter((s) => s.length > 0);
	if (segments.length < 3) return false;
	return segments[0] === userId && segments[1] === bookId;
}

function anthropicMediaType(mime: string): string | null {
	const m = mime.toLowerCase().split(';')[0]?.trim() ?? '';
	if (m === 'image/jpeg' || m === 'image/jpg') return 'image/jpeg';
	if (m === 'image/png') return 'image/png';
	if (m === 'image/webp') return 'image/webp';
	if (m === 'image/gif') return 'image/gif';
	return null;
}

function stripJsonFences(text: string): string {
	let t = text.trim();
	if (t.startsWith('```')) {
		const firstNl = t.indexOf('\n');
		if (firstNl !== -1) t = t.slice(firstNl + 1);
		const fence = t.lastIndexOf('```');
		if (fence !== -1) t = t.slice(0, fence).trim();
	}
	return t.trim();
}

function parseModelJson(text: string): unknown {
	const stripped = stripJsonFences(text);
	try {
		return JSON.parse(stripped);
	} catch {
		const startObj = stripped.indexOf('{');
		const startArr = stripped.indexOf('[');
		let start = -1;
		if (startObj === -1) start = startArr;
		else if (startArr === -1) start = startObj;
		else start = Math.min(startObj, startArr);
		if (start === -1) throw new Error('No JSON object or array in model output.');
		const slice = stripped.slice(start);
		return JSON.parse(slice);
	}
}

function asFiniteNumber(v: unknown): number | null {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v === 'string' && v.trim() !== '') {
		const n = Number(v.trim());
		if (Number.isFinite(n)) return n;
	}
	return null;
}

function asOptionalInt(v: unknown, max: number): number | null {
	const n = asFiniteNumber(v);
	if (n == null) return null;
	const i = Math.trunc(n);
	if (i < 0 || i > max) return null;
	return i;
}

function asOptionalPageText(v: unknown): string | null {
	if (v == null) return null;
	const s = String(v).trim();
	if (s.length === 0) return null;
	if (s.length > 50) return s.slice(0, 50);
	return s;
}

type OcrCandidate = {
	bible_book: string;
	chapter_start?: number | null;
	verse_start?: number | null;
	chapter_end?: number | null;
	verse_end?: number | null;
	page_start?: string | null;
	page_end?: string | null;
	confidence_score: number;
};

function normalizeCandidate(raw: unknown): OcrCandidate | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const book = typeof o.bible_book === 'string' ? o.bible_book.trim() : '';
	if (!book || !BIBLE_BOOK_SET.has(book)) return null;

	const confRaw = asFiniteNumber(o.confidence_score);
	const confidence_score =
		confRaw == null ? 0.5 : Math.min(1, Math.max(0, confRaw));

	return {
		bible_book: book,
		chapter_start: asOptionalInt(o.chapter_start, 199),
		verse_start: asOptionalInt(o.verse_start, 999),
		chapter_end: asOptionalInt(o.chapter_end, 199),
		verse_end: asOptionalInt(o.verse_end, 999),
		page_start: asOptionalPageText(o.page_start),
		page_end: asOptionalPageText(o.page_end),
		confidence_score
	};
}

function parseExtractPayload(parsed: unknown): { rawText: string; candidates: OcrCandidate[] } {
	let rawText = '';
	let list: unknown[] = [];

	if (Array.isArray(parsed)) {
		list = parsed;
	} else if (parsed && typeof parsed === 'object') {
		const o = parsed as Record<string, unknown>;
		if (typeof o.rawText === 'string') rawText = o.rawText;
		if (Array.isArray(o.candidates)) list = o.candidates;
		else if (Array.isArray(o.refs)) list = o.refs;
		else if (Array.isArray(o.scripture_references)) list = o.scripture_references;
	}

	const candidates: OcrCandidate[] = [];
	for (const item of list) {
		const c = normalizeCandidate(item);
		if (c) candidates.push(c);
	}
	return { rawText, candidates };
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	if (req.method !== 'POST') {
		return jsonResponse({ error: 'Method not allowed' }, 405);
	}

	const supabaseUrl = Deno.env.get('SUPABASE_URL');
	const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
	const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
	const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
	const model = Deno.env.get('ANTHROPIC_OCR_MODEL')?.trim() || DEFAULT_ANTHROPIC_MODEL;

	if (!supabaseUrl || !anonKey) {
		return jsonResponse({ error: 'Server configuration error' }, 500);
	}
	if (!serviceRoleKey) {
		return jsonResponse({ error: 'Server configuration error: missing service role.' }, 500);
	}
	if (!anthropicKey) {
		return jsonResponse({ error: 'OCR is not configured (missing ANTHROPIC_API_KEY).' }, 503);
	}

	const authHeader = req.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	const userId = await getUserIdFromAuthApi(supabaseUrl, anonKey, authHeader);
	if (!userId) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	let body: { object_path?: string; mime_type?: string; book_id?: string };
	try {
		body = await req.json();
	} catch {
		return jsonResponse({ error: 'Invalid JSON body' }, 400);
	}

	const object_path = typeof body.object_path === 'string' ? body.object_path.trim() : '';
	const mime_type = typeof body.mime_type === 'string' ? body.mime_type.trim() : '';
	const book_id = typeof body.book_id === 'string' ? body.book_id.trim() : '';

	if (!object_path || !mime_type || !book_id) {
		return jsonResponse(
			{ error: 'object_path, mime_type, and book_id are required.' },
			400
		);
	}
	if (!UUID_RE.test(book_id)) {
		return jsonResponse({ error: 'Invalid book_id.' }, 400);
	}
	if (!pathMatchesUserAndBook(object_path, userId, book_id)) {
		return jsonResponse({ error: 'object_path does not match your account or book.' }, 403);
	}

	const mediaType = anthropicMediaType(mime_type);
	if (!mediaType) {
		return jsonResponse(
			{
				error:
					'Unsupported image type for OCR. Use JPEG, PNG, WebP, or GIF (HEIC is not supported by the vision API).'
			},
			415
		);
	}

	const supabase = createClient(supabaseUrl, serviceRoleKey, {
		auth: { persistSession: false, autoRefreshToken: false }
	});

	const { data: blob, error: dlErr } = await supabase.storage
		.from(SCRIPTURE_IMAGES_BUCKET)
		.download(object_path);

	if (dlErr || !blob) {
		console.error('[ocr_scripture_refs] storage download', dlErr);
		return jsonResponse(
			{ error: dlErr?.message ?? 'Could not read image from storage.' },
			502
		);
	}

	const buf = new Uint8Array(await blob.arrayBuffer());
	if (buf.byteLength > MAX_IMAGE_BYTES) {
		return jsonResponse(
			{ error: 'Image is too large for OCR after upload. Try a smaller photo or stronger downscale.' },
			413
		);
	}

	const imageB64 = encodeBase64(buf);

	const allowlistBlock = BIBLE_BOOK_NAMES.join(', ');

	const systemPrompt = `You extract Protestant Bible scripture citations from photos of printed commentary pages.
Return ONLY valid JSON (no markdown fences, no commentary). Shape must be:
{"rawText": string, "candidates": Candidate[]}
Candidate: {"bible_book": string, "chapter_start"?: number, "verse_start"?: number, "chapter_end"?: number, "verse_end"?: number, "page_start"?: string, "page_end"?: string, "confidence_score": number}
Rules:
- bible_book MUST be exactly one of these names (case-sensitive): ${allowlistBlock}
- Omit chapter/verse keys when not visible; use integers only.
- page_start/page_end are printed page numbers as strings (Roman numerals ok), max 50 chars, omit if unreadable.
- confidence_score is 0–1 for how sure you are of that row's parse.
- rawText: brief plain-text summary of visible citations (can be empty if none).
- Include one candidate per distinct citation you can read; skip duplicates.`;

	const userText = `Extract all scripture references from this page image. Book context UUID (for your reasoning only): ${book_id}`;

	let anthropicRes: Response;
	try {
		anthropicRes = await fetch(ANTHROPIC_URL, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-api-key': anthropicKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model,
				max_tokens: 4096,
				temperature: 0,
				system: systemPrompt,
				messages: [
					{
						role: 'user',
						content: [
							{
								type: 'image',
								source: {
									type: 'base64',
									media_type: mediaType,
									data: imageB64
								}
							},
							{ type: 'text', text: userText }
						]
					}
				]
			})
		});
	} catch (e) {
		console.error('[ocr_scripture_refs] Anthropic fetch', e);
		return jsonResponse({ error: 'Vision provider request failed.' }, 502);
	}

	if (!anthropicRes.ok) {
		let detail = anthropicRes.statusText;
		try {
			const errBody = await anthropicRes.json();
			if (errBody && typeof errBody === 'object' && 'error' in errBody) {
				const inner = (errBody as { error?: { message?: string } }).error;
				if (inner?.message) detail = inner.message;
			}
		} catch {
			try {
				detail = await anthropicRes.text();
			} catch {
				/* ignore */
			}
		}
		console.error('[ocr_scripture_refs] Anthropic HTTP', anthropicRes.status, detail);
		return jsonResponse({ error: `Vision provider error: ${detail}` }, 502);
	}

	let anthropicJson: {
		content?: Array<{ type?: string; text?: string }>;
	};
	try {
		anthropicJson = await anthropicRes.json();
	} catch {
		return jsonResponse({ error: 'Vision provider returned invalid JSON.' }, 502);
	}

	const textBlock = anthropicJson.content?.find((c) => c.type === 'text' && typeof c.text === 'string')
		?.text;
	if (!textBlock || textBlock.trim().length === 0) {
		return jsonResponse({ error: 'Vision provider returned no text content.' }, 502);
	}

	let parsed: unknown;
	try {
		parsed = parseModelJson(textBlock);
	} catch (e) {
		console.error('[ocr_scripture_refs] JSON parse', e, textBlock.slice(0, 500));
		return jsonResponse(
			{ error: 'Could not parse structured citations from vision model output.' },
			502
		);
	}

	const { rawText, candidates } = parseExtractPayload(parsed);
	return jsonResponse({ rawText, candidates });
});

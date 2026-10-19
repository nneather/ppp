/** OCR scripture refs — returns structured candidates only; never writes DB rows. */

import { createClient } from '@supabase/supabase-js';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { PDFDocument } from 'pdf-lib';
import { BIBLE_BOOK_SET, BIBLE_BOOK_NAMES } from './bible-book-allowlist.ts';
import { normalizeSectionPageFields } from './section-pointer.ts';

/**
 * Per-user UTC-day cap. Phone batches stay far under this.
 * Index mode spends 6 calls per leaf (3 columns × 2 passes); Turretin vol. 3 is ~252.
 */
const OCR_DAILY_CAP = 300;

function resolveCorsOrigin(req: Request): string | null {
	const origin = req.headers.get('Origin');
	if (!origin) return null;
	const site = Deno.env.get('SITE_URL')?.replace(/\/$/, '');
	if (site && origin === site) return origin;
	const extras = Deno.env.get('CORS_ALLOWED_ORIGINS')?.split(',').map((s) => s.trim()) ?? [];
	if (extras.includes(origin)) return origin;
	if (origin.endsWith('.vercel.app')) return origin;
	return null;
}

function corsHeadersFor(req: Request): Record<string, string> {
	const origin = resolveCorsOrigin(req);
	return {
		...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
		'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
		Vary: 'Origin'
	};
}

const SCRIPTURE_IMAGES_BUCKET = 'library-scripture-images';
/** ~25 MiB — matches storage bucket cap; Anthropic document blocks accept up to 32 MiB. */
const MAX_PAYLOAD_BYTES = 26_214_400;
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

function jsonResponse(req: Request, body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' }
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

type AnthropicVisionInput =
	| { kind: 'image'; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }
	| { kind: 'document'; mediaType: 'application/pdf' };

function anthropicVisionInput(mime: string): AnthropicVisionInput | null {
	const m = mime.toLowerCase().split(';')[0]?.trim() ?? '';
	if (m === 'image/jpeg' || m === 'image/jpg') return { kind: 'image', mediaType: 'image/jpeg' };
	if (m === 'image/png') return { kind: 'image', mediaType: 'image/png' };
	if (m === 'image/webp') return { kind: 'image', mediaType: 'image/webp' };
	if (m === 'image/gif') return { kind: 'image', mediaType: 'image/gif' };
	if (m === 'application/pdf') return { kind: 'document', mediaType: 'application/pdf' };
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
	/** Volume token from set indexes (e.g. "2" when printed as 2:620). */
	volume?: string | null;
	/** Version tag (`cf Vg`) or edition marker (`PA`, `VG`, `VL`). Not part of the locator. */
	review_note?: string | null;
	confidence_score: number;
	continuation_from_previous_page?: boolean;
	/** 0-based page index within a multi-page PDF input; omit for single images. */
	source_page_index?: number | null;
};

function normalizeCandidate(raw: unknown): OcrCandidate | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const cont = o.continuation_from_previous_page === true;
	const book = typeof o.bible_book === 'string' ? o.bible_book.trim() : '';

	if (cont && book === '') {
		// continuation row — bible book filled client-side from prior page / user
	} else if (!book || !BIBLE_BOOK_SET.has(book)) {
		return null;
	}

	const confRaw = asFiniteNumber(o.confidence_score);
	const confidence_score =
		confRaw == null ? 0.5 : Math.min(1, Math.max(0, confRaw));

	const out: OcrCandidate = {
		bible_book: book,
		chapter_start: asOptionalInt(o.chapter_start, 199),
		verse_start: asOptionalInt(o.verse_start, 999),
		chapter_end: asOptionalInt(o.chapter_end, 199),
		verse_end: asOptionalInt(o.verse_end, 999),
		page_start: asOptionalPageText(o.page_start),
		page_end: asOptionalPageText(o.page_end),
		confidence_score
	};
	const volRaw = typeof o.volume === 'string' ? o.volume.trim() : '';
	if (volRaw && volRaw.length <= 10) out.volume = volRaw;
	const noteRaw = typeof o.review_note === 'string' ? o.review_note.trim() : '';
	if (noteRaw) out.review_note = noteRaw.slice(0, 300);
	if (cont) out.continuation_from_previous_page = true;
	const spi = asOptionalInt(o.source_page_index, 999);
	if (spi != null) out.source_page_index = spi;
	return normalizePageRangeInCandidate(out);
}

/** Split literal "14-15" / "14–15" in page_start when model did not set page_end. */
const PAGE_RANGE_RE = /^(\d+)\s*[-–—]\s*(\d+)$/;

function normalizePageRangeInCandidate(c: OcrCandidate): OcrCandidate {
	const ps = c.page_start?.trim() ?? '';
	const pe = c.page_end?.trim() ?? '';
	if (!ps) return c;
	const section = normalizeSectionPageFields(ps, pe || null);
	if (section) {
		return { ...c, page_start: section.pageStart, page_end: section.pageEnd };
	}
	if (pe) return c;
	const m = PAGE_RANGE_RE.exec(ps);
	if (!m) return c;
	const first = Number(m[1]);
	const second = Number(m[2]);
	if (!Number.isFinite(first) || !Number.isFinite(second)) return c;
	if (second <= first || second - first > 50) return c;
	return { ...c, page_start: String(first), page_end: String(second) };
}

/** Split "VI, 7; VIII, 10; XV, 30" in page_start into one candidate per segment. */
function splitSemicolonPointers(c: OcrCandidate): OcrCandidate[] {
	const ps = c.page_start?.trim() ?? '';
	if (!ps.includes(';')) return [c];
	const segments = ps
		.split(';')
		.map((s) => s.trim())
		.filter((s) => s.length > 0 && s.length <= 50);
	if (segments.length < 2) return [c];
	return segments.map((seg) => ({ ...c, page_start: seg, page_end: null }));
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
		if (!c) continue;
		for (const split of splitSemicolonPointers(c)) {
			candidates.push(normalizePageRangeInCandidate(split));
		}
	}
	return { rawText, candidates };
}

function stampPdfPageIndex(candidates: OcrCandidate[], pdfPageIndex: number): OcrCandidate[] {
	return candidates.map((c) => ({
		...c,
		source_page_index: c.source_page_index ?? pdfPageIndex
	}));
}

async function pdfPageCountFromBytes(buf: Uint8Array): Promise<number> {
	const doc = await PDFDocument.load(buf);
	return doc.getPageCount();
}

async function extractSinglePdfPageBytes(buf: Uint8Array, pageIndex: number): Promise<Uint8Array> {
	const src = await PDFDocument.load(buf);
	const pageCount = src.getPageCount();
	if (pageIndex < 0 || pageIndex >= pageCount) {
		throw new Error(`pdf_page_index out of range (0..${pageCount - 1}).`);
	}
	const out = await PDFDocument.create();
	const [copied] = await out.copyPages(src, [pageIndex]);
	out.addPage(copied);
	return new Uint8Array(await out.save());
}

async function assertLibraryAccess(
	supabaseUrl: string,
	anonKey: string,
	authHeader: string,
	bookId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
	const userClient = createClient(supabaseUrl, anonKey, {
		auth: { persistSession: false, autoRefreshToken: false },
		global: { headers: { Authorization: authHeader } }
	});
	const { data: canRead, error: permErr } = await userClient.rpc('app_has_module_read', {
		p_module: 'library'
	});
	if (permErr || canRead !== true) {
		return { ok: false, status: 403, message: 'Library access required.' };
	}
	const { data: book, error: bookErr } = await userClient
		.from('books')
		.select('id')
		.eq('id', bookId)
		.is('deleted_at', null)
		.maybeSingle();
	if (bookErr || !book) {
		return { ok: false, status: 404, message: 'Book not found or not accessible.' };
	}
	return { ok: true };
}

async function bumpOcrUsage(
	supabase: ReturnType<typeof createClient>,
	userId: string
): Promise<{ allowed: true } | { allowed: false }> {
	const usageDate = new Date().toISOString().slice(0, 10);
	const { data: row, error: readErr } = await supabase
		.from('library_ocr_usage')
		.select('call_count')
		.eq('user_id', userId)
		.eq('usage_date', usageDate)
		.maybeSingle();
	if (readErr) {
		console.error('[ocr_scripture_refs] usage read', readErr);
		return { allowed: false };
	}
	const current = (row as { call_count?: number } | null)?.call_count ?? 0;
	if (current >= OCR_DAILY_CAP) return { allowed: false };
	const { error: upsertErr } = await supabase.from('library_ocr_usage').upsert(
		{
			user_id: userId,
			usage_date: usageDate,
			call_count: current + 1
		},
		{ onConflict: 'user_id,usage_date' }
	);
	if (upsertErr) console.error('[ocr_scripture_refs] usage bump', upsertErr);
	return { allowed: true };
}

Deno.serve(async (req) => {
	const cors = corsHeadersFor(req);
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: cors });
	}

	if (req.method !== 'POST') {
		return jsonResponse(req, { error: 'Method not allowed' }, 405);
	}

	const supabaseUrl = Deno.env.get('SUPABASE_URL');
	const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
	const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
	const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
	const model = Deno.env.get('ANTHROPIC_OCR_MODEL')?.trim() || DEFAULT_ANTHROPIC_MODEL;

	if (!supabaseUrl || !anonKey) {
		return jsonResponse(req, { error: 'Server configuration error' }, 500);
	}
	if (!serviceRoleKey) {
		return jsonResponse(req, { error: 'Server configuration error: missing service role.' }, 500);
	}
	const authHeader = req.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		return jsonResponse(req, { error: 'Unauthorized' }, 401);
	}

	const userId = await getUserIdFromAuthApi(supabaseUrl, anonKey, authHeader);
	if (!userId) {
		return jsonResponse(req, { error: 'Unauthorized' }, 401);
	}

	let body: {
		object_path?: string;
		mime_type?: string;
		book_id?: string;
		op?: string;
		pdf_page_index?: unknown;
		index_mode?: unknown;
		index_pass?: unknown;
	};
	try {
		body = await req.json();
	} catch {
		return jsonResponse(req, { error: 'Invalid JSON body' }, 400);
	}

	const object_path = typeof body.object_path === 'string' ? body.object_path.trim() : '';
	const mime_type = typeof body.mime_type === 'string' ? body.mime_type.trim() : '';
	const book_id = typeof body.book_id === 'string' ? body.book_id.trim() : '';
	const opRaw = typeof body.op === 'string' ? body.op.trim() : 'extract';
	const op = opRaw === 'pdf_page_count' ? 'pdf_page_count' : 'extract';
	const pdf_page_index = asOptionalInt(body.pdf_page_index, 999);
	const indexMode = body.index_mode === true;
	const indexPass = body.index_pass === 2 ? 2 : 1;

	if (!object_path || !mime_type || !book_id) {
		return jsonResponse(req,
			{ error: 'object_path, mime_type, and book_id are required.' },
			400
		);
	}
	if (!UUID_RE.test(book_id)) {
		return jsonResponse(req, { error: 'Invalid book_id.' }, 400);
	}
	if (!pathMatchesUserAndBook(object_path, userId, book_id)) {
		return jsonResponse(req, { error: 'object_path does not match your account or book.' }, 403);
	}

	const access = await assertLibraryAccess(supabaseUrl, anonKey, authHeader, book_id);
	if (!access.ok) {
		return jsonResponse(req, { error: access.message }, access.status);
	}

	const visionInput = anthropicVisionInput(mime_type);
	if (!visionInput) {
		return jsonResponse(req,
			{
				error:
					'Unsupported file type for OCR. Use JPEG, PNG, WebP, GIF, or PDF (HEIC is not supported by the vision API).'
			},
			415
		);
	}

	const supabase = createClient(supabaseUrl, serviceRoleKey, {
		auth: { persistSession: false, autoRefreshToken: false }
	});

	if (op === 'extract') {
		const usage = await bumpOcrUsage(supabase, userId);
		if (!usage.allowed) {
			return jsonResponse(
				req,
				{ error: `Daily OCR limit reached (${OCR_DAILY_CAP} calls). Try again tomorrow.` },
				429
			);
		}
	}

	const { data: blob, error: dlErr } = await supabase.storage
		.from(SCRIPTURE_IMAGES_BUCKET)
		.download(object_path);

	if (dlErr || !blob) {
		console.error('[ocr_scripture_refs] storage download', dlErr);
		return jsonResponse(req,
			{ error: dlErr?.message ?? 'Could not read file from storage.' },
			502
		);
	}

	const buf = new Uint8Array(await blob.arrayBuffer());
	if (buf.byteLength > MAX_PAYLOAD_BYTES) {
		return jsonResponse(req,
			{
				error:
					'File is too large for OCR (max 25 MiB). For images try stronger downscale; for PDFs re-export from your scanner at lower quality.'
			},
			413
		);
	}

	if (op === 'pdf_page_count') {
		if (visionInput.kind !== 'document') {
			return jsonResponse(req, { error: 'pdf_page_count is only valid for PDF files.' }, 400);
		}
		try {
			const page_count = await pdfPageCountFromBytes(buf);
			return jsonResponse(req, { page_count });
		} catch (e) {
			console.error('[ocr_scripture_refs] pdf_page_count', e);
			return jsonResponse(req, { error: 'Could not read PDF page count.' }, 502);
		}
	}

	if (!anthropicKey) {
		return jsonResponse(req, { error: 'OCR is not configured (missing ANTHROPIC_API_KEY).' }, 503);
	}

	let payloadBytes = buf;
	let effectivePdfPageIndex: number | null = null;

	if (visionInput.kind === 'document') {
		let pageCount: number;
		try {
			pageCount = await pdfPageCountFromBytes(buf);
		} catch (e) {
			console.error('[ocr_scripture_refs] PDF load', e);
			return jsonResponse(req, { error: 'Could not read PDF for OCR.' }, 502);
		}
		if (pageCount > 1) {
			if (pdf_page_index == null) {
				return jsonResponse(req,
					{
						error:
							'Multi-page PDF requires per-page OCR. Call pdf_page_count, then extract with pdf_page_index for each page.'
					},
					400
				);
			}
			try {
				payloadBytes = await extractSinglePdfPageBytes(buf, pdf_page_index);
				effectivePdfPageIndex = pdf_page_index;
			} catch (e) {
				console.error('[ocr_scripture_refs] PDF page extract', e);
				return jsonResponse(req,
					{
						error:
							e instanceof Error ? e.message : 'Could not extract PDF page for OCR.'
					},
					400
				);
			}
		} else if (pdf_page_index != null && pdf_page_index !== 0) {
			return jsonResponse(req, { error: 'pdf_page_index must be 0 for a single-page PDF.' }, 400);
		}
	}

	const payloadB64 = encodeBase64(payloadBytes);

	const allowlistBlock = BIBLE_BOOK_NAMES.join(', ');

	const systemPrompt = indexMode
		? `You extract Protestant Bible scripture citations from a SCRIPTURE INDEX page (a dense two- or three-column list, or one column cropped from that page).
Return ONLY valid JSON (no markdown fences, no commentary). Shape must be:
{"rawText": string, "candidates": Candidate[]}
Candidate: {"bible_book": string, "chapter_start"?: number, "verse_start"?: number, "chapter_end"?: number, "verse_end"?: number, "page_start"?: string, "page_end"?: string, "volume"?: string, "review_note"?: string, "confidence_score": number, "continuation_from_previous_page"?: boolean, "source_page_index"?: number}
Rules:
- Emit candidates in PRINTED ORDER (top-to-bottom within a column, columns left to right). A one-column crop is only that column. NEVER merge adjacent printed entries. A repeated identical printed line is two candidates; do not drop the second.
- bible_book MUST be exactly one of these names (case-sensitive): ${allowlistBlock}
  Exception: continuation lines without a book name → bible_book "" and continuation_from_previous_page true.
- Omit chapter/verse keys when not visible; use integers only. A whole-chapter line ("8—2:424") omits verse keys.
- When the index cites a multi-volume set as "2:620" or "II, 620", set volume="2" (or "II") and page_start="620". Do not put "2:620" in page_start when volume is set. The printed form "6:4—2:365, 546, 3:382" is verse 6:4, then volume 2 pages 365 and 546, then volume 3 page 382.
- page_start/page_end are where the citation points in the volume — page numbers, note tokens like "106n21", or ranges "14-15" as page_start="14" page_end="15".
- Institutes-style section locators (Book.chapter.section) are printed as Arabic "1.13.7" (Book 1, chapter 13, section 7) or Roman "III.2.12". Put the full token in page_start and leave volume empty. The leading number is the Institutes book, not a set volume. Do not turn "1.13.7" into volume 1 and a page.
- A printed section range "1.13.7–9" or "III.2.12–14" is ONE candidate: page_start="1.13.7", page_end="1.13.9" (expand a shortened end). Do not split the range into two candidates.
- A whole-chapter citation in a section index ("ch. 1", "chs. 1; 2") is ONE candidate. Set chapter_start (and chapter_end when a second chapter is printed) and omit verse_start. That semicolon is not two Institutes pointers.
- A verse range inside one chapter (printed "1:3-4" or "8:31-33" or a comma pair "6:3, 4" / "8:29, 30") sets chapter_start, verse_start, chapter_end (same chapter), and verse_end. One candidate range, not two candidates. The verse numbers are the English numbers printed in the index.
- Version tags on the biblical citation (p., EV, Vg., LXX, Gr., Comm., "cf Vg") go in review_note only. Do not append them to page_start or change the verse number.
- PA (Prefatory Address), VG (French 1560), and VL (Latin 1559) are not locators in this edition. Put the abbreviation in review_note. Leave any printed section token in page_start.
- Multiple page pointers for the SAME verse (e.g. "73, 101, 112"): one Candidate per page. In a volume:page index, a semicolon between page numbers ("3:21; 35, 122") is another page in the current volume, same as a comma.
- Semicolon-separated Institutes or patristic pointers in the locator column: one Candidate per pointer. Do not apply this to a biblical chapter list ("chs. 1; 2").
- confidence_score 0–1; below 0.80 when glyphs are uncertain.
- rawText: ONE short sentence (<= 200 chars), e.g. "Scripture index page". Do NOT echo citations there.
- One candidate per distinct printed citation; do not invent rows.`
		: `You extract Protestant Bible scripture citations from photos or PDF pages of printed commentary / index material.
Return ONLY valid JSON (no markdown fences, no commentary). Shape must be:
{"rawText": string, "candidates": Candidate[]}
Candidate: {"bible_book": string, "chapter_start"?: number, "verse_start"?: number, "chapter_end"?: number, "verse_end"?: number, "page_start"?: string, "page_end"?: string, "confidence_score": number, "continuation_from_previous_page"?: boolean, "source_page_index"?: number}
Rules:
- bible_book MUST be exactly one of these names (case-sensitive): ${allowlistBlock}
  Exception: if the printed line continues a citation from the previous page WITHOUT naming the book (only chapter/verse and/or page), output bible_book as "" (empty string), set "continuation_from_previous_page": true, and still fill chapter/verse/page fields you can read.
- Omit chapter/verse keys when not visible; use integers only.
- page_start/page_end are where this citation appears in the source — typically a page number, but for patristic/classical works can be a printed book/section pointer such as "VI, 7" (book VI, section 7). Strings, max 50 chars; omit if unreadable. Roman numerals ok for pages and sections.
- Page + footnote / endnote tokens: preserve the full token in page_start when the print uses note notation, e.g. "106n21" means page 106 note 21 — keep "106n21" as a single string (do not split or strip the "n21" part).
- Printed contiguous page ranges (e.g. "14-15", "14–15", "14—15" with hyphen / en-dash / em-dash) emit as ONE Candidate with page_start="14" and page_end="15". Do NOT split a printed range into two Candidates.
- Multiple printed page pointers for the SAME verse/range (e.g. "Ps 27:4 — pp. 73, 101, 112"): emit separate Candidate objects with the same bible_book/chapter/verse but different page_start for each page (leave page_end empty for each). NOT for printed ranges — see contiguous page-range rule above.
- Semicolon-separated section pointers (e.g. "Matt 22:40 — VI, 7; VIII, 10; XV, 30"): emit one Candidate per pointer, with the same bible_book/chapter/verse and the printed pointer text verbatim as page_start (leave page_end empty for each). This is the patristic-index analog of the comma-separated page-list rule.
- When the input is a multi-page PDF, set source_page_index (0-based) on every Candidate for the PDF page where that citation appears. When the input is a single image, omit source_page_index. The continuation_from_previous_page rule still applies between adjacent pages within the same PDF.
- Pay extra attention near page corners, margins, and the top/bottom 10% of each page. If a citation token is partially cropped, smudged, or visually uncertain, set confidence_score below 0.80 so a human can review.
- confidence_score is 0–1 for how sure you are of that row's parse.
- rawText: ONE short sentence (<= 200 chars) describing what kind of page this is (e.g. "Scripture index page" or "Commentary on Matthew 5"). Do NOT echo individual citations here — those go in candidates only.
- Include one candidate per distinct citation you can read; skip duplicates (but NOT when splitting multi-page pointers per the rule above — those are not duplicates).`;

	const pageHint =
		effectivePdfPageIndex != null
			? ` This is PDF page ${effectivePdfPageIndex + 1} (0-based index ${effectivePdfPageIndex}). Set source_page_index=${effectivePdfPageIndex} on every Candidate.`
			: '';
	const userText = indexMode
		? indexPass === 2
			? `Second read of this scripture index. Prefer a careful digit (3/8, 1/7) over an invented verse. Keep every printed line, including a repeated identical line. Emit printed order only. Book context UUID (reasoning only): ${book_id}.${pageHint}`
			: `Extract every scripture-index entry from this page in printed order. Book context UUID (reasoning only): ${book_id}.${pageHint}`
		: `Extract all scripture references from this document (image or PDF). Book context UUID (for your reasoning only): ${book_id}.${pageHint}`;

	const visionBlock =
		visionInput.kind === 'image'
			? {
					type: 'image' as const,
					source: {
						type: 'base64' as const,
						media_type: visionInput.mediaType,
						data: payloadB64
					}
				}
			: {
					type: 'document' as const,
					source: {
						type: 'base64' as const,
						media_type: 'application/pdf' as const,
						data: payloadB64
					}
				};

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
				max_tokens: visionInput.kind === 'image' ? 32768 : 64000,
				temperature: 0,
				system: systemPrompt,
				messages: [
					{
						role: 'user',
						content: [visionBlock, { type: 'text', text: userText }]
					}
				]
			})
		});
	} catch (e) {
		console.error('[ocr_scripture_refs] Anthropic fetch', e);
		return jsonResponse(req, { error: 'Vision provider request failed.' }, 502);
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
		return jsonResponse(req, { error: `Vision provider error: ${detail}` }, 502);
	}

	let anthropicJson: {
		content?: Array<{ type?: string; text?: string }>;
		stop_reason?: string;
	};
	try {
		anthropicJson = await anthropicRes.json();
	} catch {
		return jsonResponse(req, { error: 'Vision provider returned invalid JSON.' }, 502);
	}

	if (anthropicJson.stop_reason === 'max_tokens') {
		console.error('[ocr_scripture_refs] Anthropic stop_reason=max_tokens');
		return jsonResponse(req,
			{
				error:
					'Vision provider hit the output token limit on this document (more than ~1,800 citations). Split into smaller PDFs or shorter image batches.'
			},
			422
		);
	}

	const textBlock = anthropicJson.content?.find((c) => c.type === 'text' && typeof c.text === 'string')
		?.text;
	if (!textBlock || textBlock.trim().length === 0) {
		return jsonResponse(req, { error: 'Vision provider returned no text content.' }, 502);
	}

	let parsed: unknown;
	try {
		parsed = parseModelJson(textBlock);
	} catch (e) {
		console.error('[ocr_scripture_refs] JSON parse', e, textBlock.slice(0, 500));
		if (!textBlock.includes('{') && !textBlock.includes('[')) {
			return jsonResponse(req, { rawText: textBlock.slice(0, 500), candidates: [] });
		}
		return jsonResponse(req,
			{ error: 'Could not parse structured citations from vision model output.' },
			502
		);
	}

	let { rawText, candidates } = parseExtractPayload(parsed);
	if (effectivePdfPageIndex != null) {
		candidates = stampPdfPageIndex(candidates, effectivePdfPageIndex);
	}
	return jsonResponse(req, { rawText, candidates });
});

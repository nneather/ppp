/**
 * Index-mode OCR for the page-index gold gate.
 * Splits each local page image into columns, runs the two production passes,
 * and writes gold/page-0N.ocr.json.
 *
 *   npx tsx scripts/ocr-index-eval/page-ocr.ts
 *
 * Images live in scripts/ocr-index-eval/images/page-0N-full.png (gitignored).
 * Env: ANTHROPIC_API_KEY (optional ANTHROPIC_OCR_MODEL). Loaded from .env.local.
 *
 * The system prompt below is the one that produced gold/page-0N.ocr.json
 * on 2026-10-19 (99.610%). The edge function's index_mode prompt also
 * includes the Calvin locator rules from decision 262.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { BIBLE_BOOK_NAMES } from '../../src/lib/library/bible-book-names.ts';
import { columnSpansFromInk } from '../../src/lib/library/column-spans.ts';
import { mergeOcrConsensus } from '../../src/lib/library/scripture-ocr-consensus.ts';
import type { OcrScriptureCandidate } from '../../src/lib/library/ocr-scripture-refs.ts';

const here = dirname(fileURLToPath(import.meta.url));
const goldDir = join(here, 'gold');
const imageDir = join(here, 'images');

function loadEnvLocal(): void {
	const path = join(here, '../../.env.local');
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq < 1) continue;
		const key = trimmed.slice(0, eq);
		if (process.env[key]) continue;
		let value = trimmed.slice(eq + 1);
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		process.env[key] = value;
	}
}

loadEnvLocal();

const model = process.env.ANTHROPIC_OCR_MODEL?.trim() || 'claude-sonnet-4-6';
const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
if (!apiKey) {
	console.error('ANTHROPIC_API_KEY is required');
	process.exit(1);
}

type Rgb = { width: number; height: number; rows: Uint8Array[] };

function decodePng(path: string): Rgb {
	const data = readFileSync(path);
	let pos = 8;
	let width = 0;
	let height = 0;
	let colorType = 0;
	const idat: Buffer[] = [];
	while (pos < data.length) {
		const length = data.readUInt32BE(pos);
		const typ = data.toString('ascii', pos + 4, pos + 8);
		const chunk = data.subarray(pos + 8, pos + 8 + length);
		pos += 12 + length;
		if (typ === 'IHDR') {
			width = chunk.readUInt32BE(0);
			height = chunk.readUInt32BE(4);
			colorType = chunk[9] ?? 0;
		} else if (typ === 'IDAT') idat.push(chunk);
		else if (typ === 'IEND') break;
	}
	const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
	if (!bpp) throw new Error(`Unsupported PNG color type ${colorType} in ${path}`);
	const raw = inflateSync(Buffer.concat(idat));
	const stride = width * bpp;
	const rows: Uint8Array[] = [];
	let i = 0;
	let prev = new Uint8Array(stride);
	const paeth = (a: number, b: number, c: number) => {
		const p = a + b - c;
		const pa = Math.abs(p - a);
		const pb = Math.abs(p - b);
		const pc = Math.abs(p - c);
		return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
	};
	for (let y = 0; y < height; y++) {
		const filt = raw[i] ?? 0;
		i += 1;
		const row = Uint8Array.from(raw.subarray(i, i + stride));
		i += stride;
		if (filt === 1) {
			for (let x = 0; x < row.length; x++) row[x] = (row[x]! + (x >= bpp ? row[x - bpp]! : 0)) & 255;
		} else if (filt === 2) {
			for (let x = 0; x < row.length; x++) row[x] = (row[x]! + prev[x]!) & 255;
		} else if (filt === 3) {
			for (let x = 0; x < row.length; x++) {
				const left = x >= bpp ? row[x - bpp]! : 0;
				row[x] = (row[x]! + Math.floor((left + prev[x]!) / 2)) & 255;
			}
		} else if (filt === 4) {
			for (let x = 0; x < row.length; x++) {
				const a = x >= bpp ? row[x - bpp]! : 0;
				const b = prev[x]!;
				const c = x >= bpp ? prev[x - bpp]! : 0;
				row[x] = (row[x]! + paeth(a, b, c)) & 255;
			}
		} else if (filt !== 0) throw new Error(`PNG filter ${filt}`);
		prev = row;
		rows.push(row);
	}
	return { width, height, rows };
}

function encodePng(width: number, height: number, bpp: number, rows: Uint8Array[]): Buffer {
	const crcTable = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		crcTable[n] = c;
	}
	const crc32 = (buf: Buffer) => {
		let c = 0xffffffff;
		for (const b of buf) c = crcTable[(c ^ b) & 255]! ^ (c >>> 8);
		return (c ^ 0xffffffff) >>> 0;
	};
	const chunk = (tag: string, payload: Buffer) => {
		const body = Buffer.concat([Buffer.from(tag), payload]);
		const out = Buffer.alloc(12 + payload.length);
		out.writeUInt32BE(payload.length, 0);
		body.copy(out, 4);
		out.writeUInt32BE(crc32(body), 8 + payload.length);
		return out;
	};
	const raw = Buffer.alloc(rows.reduce((n, r) => n + 1 + r.length, 0));
	let o = 0;
	for (const row of rows) {
		raw[o++] = 0;
		raw.set(row, o);
		o += row.length;
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = bpp === 4 ? 6 : 2;
	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

function cropPng(img: Rgb, x0: number, x1: number): Buffer {
	const bpp = img.rows[0]!.length / img.width;
	const w = x1 - x0;
	const rows = img.rows.map((row) => row.subarray(x0 * bpp, x1 * bpp));
	return encodePng(w, img.height, bpp, rows);
}

function inkHistogram(img: Rgb): number[] {
	const bpp = img.rows[0]!.length / img.width;
	const y0 = Math.floor(img.height * 0.08);
	const y1 = Math.floor(img.height * 0.92);
	const ink = new Array<number>(img.width).fill(0);
	for (let y = y0; y < y1; y += 2) {
		const row = img.rows[y]!;
		for (let x = 0; x < img.width; x++) {
			if (row[x * bpp]! < 180) ink[x] = (ink[x] ?? 0) + 1;
		}
	}
	return ink;
}

function systemPrompt(): string {
	const allowlist = BIBLE_BOOK_NAMES.join(', ');
	return `You extract Protestant Bible scripture citations from a SCRIPTURE INDEX page (a dense two- or three-column list, or one column cropped from that page).
Return ONLY valid JSON (no markdown fences, no commentary). Shape must be:
{"rawText": string, "candidates": Candidate[]}
Candidate: {"bible_book": string, "chapter_start"?: number, "verse_start"?: number, "chapter_end"?: number, "verse_end"?: number, "page_start"?: string, "page_end"?: string, "volume"?: string, "confidence_score": number, "continuation_from_previous_page"?: boolean, "source_page_index"?: number}
Rules:
- Emit candidates in PRINTED ORDER (top-to-bottom within a column, columns left to right). A one-column crop is only that column. NEVER merge adjacent printed entries.
- bible_book MUST be exactly one of these names (case-sensitive): ${allowlist}
  Exception: continuation lines without a book name → bible_book "" and continuation_from_previous_page true.
- Omit chapter/verse keys when not visible; use integers only. A whole-chapter line ("8—2:424") omits verse keys.
- When the index cites a multi-volume set as "2:620" or "II, 620", set volume="2" (or "II") and page_start="620". Do not put "2:620" in page_start when volume is set. The printed form "6:4—2:365, 546, 3:382" is verse 6:4, then volume 2 pages 365 and 546, then volume 3 page 382.
- page_start/page_end are where the citation points in the volume — page numbers, note tokens like "106n21", or ranges "14-15" as page_start="14" page_end="15".
- Institutes-style section locators (Book.chapter.section), printed as "III.2.12" or "I.14.1": put the full token in page_start and leave volume empty. The leading roman numeral is the book of the Institutes, not a set volume. Do not convert the locator into a page number.
- A printed section range "III.2.12–14" or "III.2.12-14" is ONE candidate: page_start="III.2.12", page_end="III.2.14". Expand a shortened end so page_end is a full locator. Do not split the range into two candidates.
- A verse range inside one chapter (printed "1:3-4" or "8:31-33" or a comma pair "6:3, 4" / "8:29, 30") sets chapter_start, verse_start, chapter_end (same chapter), and verse_end. One candidate range, not two candidates.
- Multiple page pointers for the SAME verse (e.g. "73, 101, 112"): one Candidate per page. In a volume:page index, a semicolon between page numbers ("3:21; 35, 122") is another page in the current volume, same as a comma.
- Semicolon-separated section pointers: one Candidate per pointer.
- confidence_score 0–1; below 0.80 when glyphs are uncertain.
- rawText: ONE short sentence (<= 200 chars), e.g. "Scripture index page". Do NOT echo citations there.
- One candidate per distinct printed citation; do not invent rows.`;
}

const prompt = systemPrompt();

function normalize(raw: unknown): OcrScriptureCandidate | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const book = typeof o.bible_book === 'string' ? o.bible_book.trim() : '';
	const num = (k: string): number | undefined => {
		const v = o[k];
		if (typeof v === 'number' && Number.isFinite(v)) return v;
		if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
		return undefined;
	};
	const str = (k: string): string | undefined => {
		const v = o[k];
		if (typeof v === 'number' && Number.isFinite(v)) return String(v);
		if (typeof v === 'string' && v.trim()) return v.trim();
		return undefined;
	};
	const score = num('confidence_score') ?? 0.5;
	const row: OcrScriptureCandidate = {
		bible_book: book,
		confidence_score: score
	};
	const ch = num('chapter_start');
	const vs = num('verse_start');
	const ce = num('chapter_end');
	const ve = num('verse_end');
	if (ch != null) row.chapter_start = ch;
	if (vs != null) row.verse_start = vs;
	if (ce != null) row.chapter_end = ce;
	if (ve != null) row.verse_end = ve;
	const ps = str('page_start');
	const pe = str('page_end');
	const vol = str('volume');
	if (ps) row.page_start = ps;
	if (pe) row.page_end = pe;
	if (vol) row.volume = vol;
	if (o.continuation_from_previous_page === true) row.continuation_from_previous_page = true;
	if (!book && ch == null && !ps) return null;
	return row;
}

async function ocrPng(bytes: Buffer, pass: 1 | 2): Promise<OcrScriptureCandidate[]> {
	const user =
		pass === 2
			? 'Second read of this scripture index column. Prefer fewer rows over guessed digits (3/8, 1/7). Emit printed order only.'
			: 'Extract every scripture-index entry from this column in printed order.';
	let res: Response | null = null;
	for (let attempt = 1; attempt <= 4; attempt++) {
		res = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-api-key': apiKey!,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model,
				max_tokens: 32000,
				temperature: 0,
				system: prompt,
				messages: [
					{
						role: 'user',
						content: [
							{
								type: 'image',
								source: {
									type: 'base64',
									media_type: 'image/png',
									data: bytes.toString('base64')
								}
							},
							{ type: 'text', text: user }
						]
					}
				]
			})
		});
		if (res.status !== 429 && res.status !== 529) break;
		const wait = attempt * 8000;
		console.warn(`  rate limit ${res.status}, waiting ${wait}ms`);
		await new Promise((r) => setTimeout(r, wait));
	}
	if (!res?.ok) {
		const body = await res!.text();
		throw new Error(`Anthropic ${res?.status}: ${body.slice(0, 400)}`);
	}
	const payload = (await res.json()) as {
		stop_reason?: string;
		content?: { type: string; text?: string }[];
	};
	if (payload.stop_reason === 'max_tokens') {
		console.warn('  stop_reason=max_tokens — column output truncated');
	}
	const text = payload.content?.find((c) => c.type === 'text')?.text ?? '';
	const jsonStart = text.indexOf('{');
	const jsonEnd = text.lastIndexOf('}');
	if (jsonStart < 0 || jsonEnd < jsonStart) throw new Error(`No JSON: ${text.slice(0, 240)}`);
	const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { candidates?: unknown[] };
	return (parsed.candidates ?? [])
		.map(normalize)
		.filter((r): r is OcrScriptureCandidate => r != null);
}

async function ocrPage(id: string): Promise<void> {
	const path = join(imageDir, `${id}-full.png`);
	if (!existsSync(path)) throw new Error(`Missing ${path}`);
	const started = Date.now();
	const img = decodePng(path);
	const spans = columnSpansFromInk(inkHistogram(img), img.width);
	console.log(
		`${id}: ${spans.length} column(s) ${spans.map((s) => `${s.x0}-${s.x1}`).join(', ')}`
	);
	const merged: OcrScriptureCandidate[] = [];
	for (let i = 0; i < spans.length; i++) {
		const span = spans[i]!;
		const png = cropPng(img, span.x0, span.x1);
		const t0 = Date.now();
		const [passA, passB] = await Promise.all([ocrPng(png, 1), ocrPng(png, 2)]);
		const rows = mergeOcrConsensus(passA, passB);
		console.log(
			`  col ${i + 1}: pass ${passA.length}/${passB.length} → ${rows.length} in ${((Date.now() - t0) / 1000).toFixed(0)}s`
		);
		merged.push(...rows);
	}
	const out = join(goldDir, `${id}.ocr.json`);
	writeFileSync(out, JSON.stringify({ candidates: merged }, null, 2) + '\n');
	const minutes = (Date.now() - started) / 60000;
	console.log(`${id}: ${merged.length} candidates, ${minutes.toFixed(1)} min → ${out}`);
}

const ids = ['page-01', 'page-02', 'page-03'];
for (const id of ids) {
	await ocrPage(id);
}

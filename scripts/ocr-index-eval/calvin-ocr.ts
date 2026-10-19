/**
 * Typeset the Calvin practice gold pages and OCR them with the index-mode
 * prompt. Writes gold/calvin/page-NN.ocr.json.
 *
 *   npx tsx scripts/ocr-index-eval/calvin-ocr.ts
 *
 * Env: ANTHROPIC_API_KEY (optional ANTHROPIC_OCR_MODEL).
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIBLE_BOOK_NAMES } from '../../src/lib/library/bible-book-names.ts';
import {
	normalizeSectionPageFields,
	parseSectionPointer
} from '../../src/lib/library/section-pointer.ts';

type GoldRow = {
	bible_book: string;
	chapter_start?: number | null;
	verse_start?: number | null;
	chapter_end?: number | null;
	verse_end?: number | null;
	page_start?: string | null;
	page_end?: string | null;
};

type GoldFile = { id: string; rows: GoldRow[] };

const here = dirname(fileURLToPath(import.meta.url));
const goldDir = join(here, 'gold', 'calvin');
const model = process.env.ANTHROPIC_OCR_MODEL?.trim() || 'claude-sonnet-4-6';
const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
if (!apiKey) {
	console.error('ANTHROPIC_API_KEY is required');
	process.exit(1);
}

function verseLabel(row: GoldRow): string {
	const ch = row.chapter_start ?? '';
	const vs = row.verse_start ?? '';
	const ve = row.verse_end;
	if (ve != null && ve !== vs) return `${ch}:${vs}-${ve}`;
	return `${ch}:${vs}`;
}

function pointerLabel(row: GoldRow): string {
	if (row.page_end && row.page_end !== row.page_start) {
		const end = row.page_end.split('.').pop();
		return `${row.page_start}-${end}`;
	}
	return row.page_start ?? '';
}

/** One-page Courier PDF. ASCII only — no pdf-lib dependency in this script. */
function pagePdf(lines: string[]): Uint8Array {
	const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
	const cmds = ['BT', '/F1 12 Tf', '72 740 Td', '22 TL'];
	lines.forEach((line, i) => {
		cmds.push(i === 0 ? `(${esc(line)}) Tj` : `T* (${esc(line)}) Tj`);
	});
	cmds.push('ET');
	const stream = cmds.join('\n');
	const objects = [
		'1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
		'2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
		'3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n',
		`4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream\nendobj\n`,
		'5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj\n'
	];
	let body = '%PDF-1.4\n';
	const offsets = [0];
	for (const obj of objects) {
		offsets.push(body.length);
		body += obj;
	}
	const xrefAt = body.length;
	let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (let i = 1; i < offsets.length; i++) {
		xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
	}
	body += xref;
	body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
	return new TextEncoder().encode(body);
}

function systemPrompt(): string {
	const allowlist = BIBLE_BOOK_NAMES.join(', ');
	return `You extract Protestant Bible scripture citations from a SCRIPTURE INDEX page (dense two-column list).
Return ONLY valid JSON (no markdown fences, no commentary). Shape must be:
{"rawText": string, "candidates": Candidate[]}
Candidate: {"bible_book": string, "chapter_start"?: number, "verse_start"?: number, "chapter_end"?: number, "verse_end"?: number, "page_start"?: string, "page_end"?: string, "volume"?: string, "confidence_score": number}
Rules:
- Emit candidates in PRINTED ORDER. NEVER merge adjacent printed entries.
- bible_book MUST be exactly one of these names (case-sensitive): ${allowlist}
- Omit chapter/verse keys when not visible; use integers only.
- When the index cites a multi-volume set as "2:620", set volume and page_start separately.
- page_start/page_end are page numbers, note tokens, or ranges "14-15" as page_start="14" page_end="15".
- Institutes-style section locators (Book.chapter.section), printed as "III.2.12" or "I.14.1": put the full token in page_start and leave volume empty. The leading roman numeral is the book of the Institutes, not a set volume. Do not convert the locator into a page number.
- A printed section range "III.2.12-14" or "III.2.12–14" is ONE candidate: page_start="III.2.12", page_end="III.2.14". Expand a shortened end so page_end is a full locator. Do not split the range into two candidates.
- A verse range inside one chapter (printed "1:3-4") sets chapter_start, verse_start, chapter_end (same chapter), and verse_end.
- confidence_score 0-1.
- rawText: ONE short sentence (<= 200 chars). Do NOT echo citations there.`;
}

function normalizeCandidate(raw: unknown): GoldRow | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const book = typeof o.bible_book === 'string' ? o.bible_book.trim() : '';
	if (!book) return null;
	const num = (k: string): number | undefined => {
		const v = o[k];
		if (typeof v === 'number' && Number.isFinite(v)) return v;
		return undefined;
	};
	let pageStart = typeof o.page_start === 'string' ? o.page_start.trim() : '';
	let pageEnd = typeof o.page_end === 'string' ? o.page_end.trim() : '';
	const section = normalizeSectionPageFields(pageStart, pageEnd || null);
	if (section) {
		pageStart = section.pageStart;
		pageEnd = section.pageEnd ?? '';
	}
	let volume = typeof o.volume === 'string' ? o.volume.trim() : '';
	if (parseSectionPointer(pageStart, pageEnd || null)) volume = '';
	const row: GoldRow & { volume?: string } = {
		bible_book: book,
		chapter_start: num('chapter_start'),
		verse_start: num('verse_start'),
		chapter_end: num('chapter_end'),
		verse_end: num('verse_end'),
		page_start: pageStart || undefined,
		page_end: pageEnd || undefined
	};
	if (volume) row.volume = volume;
	return row;
}

async function ocrPdf(bytes: Uint8Array): Promise<GoldRow[]> {
	const b64 = Buffer.from(bytes).toString('base64');
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': apiKey!,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model,
			max_tokens: 4000,
			temperature: 0,
			system: systemPrompt(),
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'document',
							source: { type: 'base64', media_type: 'application/pdf', data: b64 }
						},
						{
							type: 'text',
							text: 'Extract every scripture-index entry from this page in printed order.'
						}
					]
				}
			]
		})
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Anthropic ${res.status}: ${body.slice(0, 400)}`);
	}
	const payload = (await res.json()) as {
		content?: { type: string; text?: string }[];
	};
	const text = payload.content?.find((c) => c.type === 'text')?.text ?? '';
	const jsonStart = text.indexOf('{');
	const jsonEnd = text.lastIndexOf('}');
	if (jsonStart < 0 || jsonEnd < jsonStart) throw new Error(`No JSON in model text: ${text.slice(0, 200)}`);
	const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { candidates?: unknown[] };
	return (parsed.candidates ?? [])
		.map(normalizeCandidate)
		.filter((r): r is GoldRow => r != null);
}

const files = readdirSync(goldDir)
	.filter((f) => /^page-\d+\.json$/.test(f))
	.sort();

for (const name of files) {
	const gold = JSON.parse(readFileSync(join(goldDir, name), 'utf8')) as GoldFile;
	const heading = gold.rows[0]?.bible_book ?? 'Scripture';
	const lines = [
		'INDEX OF SCRIPTURE REFERENCES',
		'',
		heading,
		...gold.rows.map((row) => {
			const left = verseLabel(row).padEnd(14, '.');
			return `  ${left} ${pointerLabel(row)}`;
		})
	];
	const pdf = pagePdf(lines);
	const candidates = await ocrPdf(pdf);
	const out = join(goldDir, name.replace(/\.json$/, '.ocr.json'));
	writeFileSync(out, JSON.stringify({ candidates }, null, 2) + '\n');
	console.log(`${name}: ${candidates.length} candidates → ${out}`);
}

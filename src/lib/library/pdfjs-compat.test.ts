/**
 * Smoke test for the pdf.js API surface used by pdf-page-render.ts and
 * scripts/ocr-index-eval/parse-turretin-text.ts (getDocument, numPages,
 * getPage, getViewport, render({ canvas, viewport }), getTextContent).
 * Runs in Node via the legacy build + @napi-rs/canvas (pdfjs-dist optional dep).
 */
import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Build a tiny valid PDF (with correct xref offsets) containing `pages` text pages. */
function makePdf(texts: string[]): Uint8Array {
	const objs: string[] = [];
	const n = texts.length;
	const fontId = 3 + n * 2;
	const kids = texts.map((_, i) => `${3 + i * 2} 0 R`).join(' ');
	objs.push('<< /Type /Catalog /Pages 2 0 R >>');
	objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
	texts.forEach((t, i) => {
		const contentId = 4 + i * 2;
		objs.push(
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
		);
		const stream = `BT /F1 24 Tf 20 100 Td (${t}) Tj ET`;
		objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
	});
	objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

	let out = '%PDF-1.4\n';
	const offsets: number[] = [];
	objs.forEach((body, i) => {
		offsets.push(out.length);
		out += `${i + 1} 0 obj\n${body}\nendobj\n`;
	});
	const xref = out.length;
	out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
	for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
	out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return new TextEncoder().encode(out);
}

describe('pdfjs-dist API compatibility', () => {
	it('reads page count and text content', async () => {
		const task = getDocument({ data: makePdf(['Romans 8:28', 'John 3:16']) });
		const doc = await task.promise;
		expect(doc.numPages).toBe(2);
		const page = await doc.getPage(2);
		const tc = await page.getTextContent();
		const text = tc.items.map((it) => ('str' in it ? it.str : '')).join('');
		expect(text).toContain('John 3:16');
		await task.destroy();
	});

	it('renders a page to a canvas with render({ canvas, viewport })', async () => {
		const { createCanvas } = await import('@napi-rs/canvas');
		const task = getDocument({ data: makePdf(['Psalm 23']) });
		const doc = await task.promise;
		const page = await doc.getPage(1);
		const viewport = page.getViewport({ scale: 1 });
		expect(viewport.width).toBe(300);
		const canvas = createCanvas(viewport.width, viewport.height);
		await page.render({
			canvas: canvas as unknown as HTMLCanvasElement,
			viewport
		}).promise;
		const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
		let dark = 0;
		for (let i = 0; i < data.length; i += 4) if (data[i] < 128 && data[i + 3] > 0) dark++;
		expect(dark).toBeGreaterThan(50);
		await task.destroy();
	});
});

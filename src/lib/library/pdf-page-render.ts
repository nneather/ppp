/**
 * Client-side PDF page rasterization for scripture OCR.
 * Loaded only when the user queues a PDF (dynamic import of pdfjs-dist).
 */

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const MAX_LONG_EDGE = 2048;
const JPEG_QUALITY = 0.85;

type PdfJsModule = typeof import('pdfjs-dist');

let pdfjsModule: PdfJsModule | null = null;

async function getPdfJs(): Promise<PdfJsModule> {
	if (!pdfjsModule) {
		pdfjsModule = await import('pdfjs-dist');
		pdfjsModule.GlobalWorkerOptions.workerSrc = workerUrl;
	}
	return pdfjsModule;
}

async function loadPdfDocument(file: File) {
	const pdfjs = await getPdfJs();
	const data = new Uint8Array(await file.arrayBuffer());
	return pdfjs.getDocument({ data }).promise;
}

/** Page count from a local PDF file (no upload / Edge call). */
export async function getPdfPageCountFromFile(file: File): Promise<number> {
	const doc = await loadPdfDocument(file);
	return doc.numPages;
}

/** Render one 0-based PDF page to a JPEG blob (~2048px long edge). */
export async function renderPdfPageToJpegBlob(
	file: File,
	pageIndex: number,
	maxLongEdge = MAX_LONG_EDGE,
	quality = JPEG_QUALITY
): Promise<Blob> {
	const doc = await loadPdfDocument(file);
	if (pageIndex < 0 || pageIndex >= doc.numPages) {
		throw new Error(`PDF page index out of range (0..${doc.numPages - 1}).`);
	}
	const page = await doc.getPage(pageIndex + 1);
	const baseViewport = page.getViewport({ scale: 1 });
	const scale = Math.min(maxLongEdge / baseViewport.width, maxLongEdge / baseViewport.height, 1);
	const viewport = page.getViewport({ scale });

	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.floor(viewport.width));
	canvas.height = Math.max(1, Math.floor(viewport.height));
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Canvas is not available for PDF rendering.');
	}

	await page.render({ canvasContext: ctx, viewport }).promise;

	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, 'image/jpeg', quality)
	);
	if (!blob) {
		throw new Error('Could not encode PDF page as JPEG.');
	}
	return blob;
}

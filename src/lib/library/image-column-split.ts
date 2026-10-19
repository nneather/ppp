/**
 * Split an index-page image into column crops for denser OCR ([252]).
 * Two or three columns, from the ink histogram ([column-spans.ts]). Browser-only.
 */

import { columnSpansFromInk } from '$lib/library/column-spans';

/**
 * Reading-order column JPEGs. Overlap sits in the gutter so a wrapped token
 * on the column edge is less likely to be clipped.
 */
export async function splitImageIntoColumns(
	blob: Blob,
	overlapRatio = 0.04,
	quality = 0.9
): Promise<Blob[]> {
	const bitmap = await createImageBitmap(blob);
	try {
		const w = bitmap.width;
		const h = bitmap.height;
		const sample = document.createElement('canvas');
		sample.width = w;
		sample.height = h;
		const sctx = sample.getContext('2d', { willReadFrequently: true });
		if (!sctx) throw new Error('Canvas unavailable for column split.');
		sctx.drawImage(bitmap, 0, 0);
		const y0 = Math.floor(h * 0.08);
		const y1 = Math.floor(h * 0.92);
		const data = sctx.getImageData(0, y0, w, Math.max(1, y1 - y0)).data;
		const ink = new Array<number>(w).fill(0);
		const rowStride = w * 4;
		for (let y = 0; y < y1 - y0; y += 2) {
			const off = y * rowStride;
			for (let x = 0; x < w; x++) {
				if ((data[off + x * 4] ?? 255) < 180) ink[x] = (ink[x] ?? 0) + 1;
			}
		}
		const spans = columnSpansFromInk(ink, w, overlapRatio);

		async function crop(sx: number, sw: number): Promise<Blob> {
			const canvas = document.createElement('canvas');
			canvas.width = Math.max(1, sw);
			canvas.height = h;
			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('Canvas unavailable for column split.');
			ctx.drawImage(bitmap, sx, 0, sw, h, 0, 0, sw, h);
			const out = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, 'image/jpeg', quality)
			);
			if (!out) throw new Error('Could not encode column crop.');
			return out;
		}

		return Promise.all(spans.map((span) => crop(span.x0, span.x1 - span.x0)));
	} finally {
		bitmap.close();
	}
}

/** Downscale / re-encode an image blob to a target long-edge (default 3000 for index mode). */
export async function resizeImageLongEdge(
	blob: Blob,
	maxLongEdge = 3000,
	quality = 0.9
): Promise<Blob> {
	const bitmap = await createImageBitmap(blob);
	try {
		const scale = Math.min(1, maxLongEdge / Math.max(bitmap.width, bitmap.height));
		const w = Math.max(1, Math.floor(bitmap.width * scale));
		const h = Math.max(1, Math.floor(bitmap.height * scale));
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas unavailable for resize.');
		ctx.drawImage(bitmap, 0, 0, w, h);
		const out = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, 'image/jpeg', quality)
		);
		if (!out) throw new Error('Could not encode resized image.');
		return out;
	} finally {
		bitmap.close();
	}
}

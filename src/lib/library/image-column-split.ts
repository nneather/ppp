/**
 * Split a two-column index page image into left/right crops for denser OCR ([252]).
 * Browser-only (uses createImageBitmap + canvas).
 */

export type ColumnCropBlobs = { left: Blob; right: Blob };

/**
 * Split an image blob into left and right halves (slight overlap in the middle
 * so mid-column wrap-around tokens are less likely to be lost).
 */
export async function splitImageIntoColumns(
	blob: Blob,
	overlapRatio = 0.04,
	quality = 0.9
): Promise<ColumnCropBlobs> {
	const bitmap = await createImageBitmap(blob);
	try {
		const w = bitmap.width;
		const h = bitmap.height;
		const overlap = Math.floor(w * overlapRatio);
		const mid = Math.floor(w / 2);

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

		const leftW = mid + overlap;
		const rightX = Math.max(0, mid - overlap);
		const rightW = w - rightX;
		const [left, right] = await Promise.all([crop(0, leftW), crop(rightX, rightW)]);
		return { left, right };
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

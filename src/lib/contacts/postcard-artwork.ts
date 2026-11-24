/**
 * Lob postcard artwork helpers, ported from HeLOS
 * (`helos_app/src/app/events/postcards/lobArtwork.ts`, checked there against a
 * real Lob print).
 *
 * - Postcards are LANDSCAPE. Full bleed = trim + 0.125in on every edge.
 * - An HTML `back` is rendered by Lob at the card size, in inches, and is
 *   capped at 10,000 characters.
 * - Lob auto-prints the recipient address, return address, postage and
 *   barcode in a reserved bottom-right box on the back. The message has to
 *   stay clear of it; nothing else is needed.
 */

export const POSTCARD_SIZES = ['4x6', '5x7', '6x9', '6x11'] as const;
export type PostcardSize = (typeof POSTCARD_SIZES)[number];

export function isPostcardSize(v: unknown): v is PostcardSize {
	return typeof v === 'string' && (POSTCARD_SIZES as readonly string[]).includes(v);
}

export const LOB_HTML_MAX_CHARS = 10_000;

export const SIZE_DIMENSIONS: Record<
	PostcardSize,
	{ widthIn: number; heightIn: number; label: string }
> = {
	'4x6': { widthIn: 6.25, heightIn: 4.25, label: '6.25 × 4.25 in (1875 × 1275 px)' },
	// 5x7 isn't in Lob's public size list but works (proven in HeLOS).
	'5x7': { widthIn: 7.25, heightIn: 5.25, label: '7.25 × 5.25 in (2175 × 1575 px)' },
	'6x9': { widthIn: 9.25, heightIn: 6.25, label: '9.25 × 6.25 in (2775 × 1875 px)' },
	'6x11': { widthIn: 11.25, heightIn: 6.25, label: '11.25 × 6.25 in (3375 × 1875 px)' }
};

/** Lob's reserved address box on the back, bottom-right. */
function inkFreeBox(size: PostcardSize): { widthIn: number; heightIn: number } {
	return size === '4x6' ? { widthIn: 3.2835, heightIn: 2.375 } : { widthIn: 4, heightIn: 2.375 };
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/** Escape, then keep line breaks; blank lines become paragraph spacing. */
function messageToHtml(message: string): string {
	return escapeHtml(message.trim()).replaceAll('\n', '<br/>');
}

/**
 * Text-message back. The message sits in a left column sized to clear the
 * address box (same geometry as the HeLOS render that was verified on a real
 * 5x7 print). Set in Lora at 12pt.
 */
export function buildBackHtml(message: string, size: PostcardSize): string {
	const d = SIZE_DIMENSIONS[size];
	const box = inkFreeBox(size);
	const messageWidth = (d.widthIn - box.widthIn - 0.5).toFixed(3);
	return `<html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css?family=Lora" rel="stylesheet"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{position:relative;width:${d.widthIn}in;height:${d.heightIn}in;font-family:'Lora',Georgia,serif;color:#1a1a1a;background:#ffffff}
#message{position:absolute;top:0.45in;left:0.4in;width:${messageWidth}in;font-size:12pt;line-height:1.5;white-space:normal}
#ink-free{position:absolute;right:0.275in;bottom:0.25in;width:${box.widthIn}in;height:${box.heightIn}in}
</style></head><body><div id="message">${messageToHtml(message)}</div><div id="ink-free"></div></body></html>`;
}

/** The address box, for drawing a guide over the on-screen preview (inches). */
export function inkFreeGuide(size: PostcardSize) {
	const box = inkFreeBox(size);
	return { right: 0.275, bottom: 0.25, ...box };
}

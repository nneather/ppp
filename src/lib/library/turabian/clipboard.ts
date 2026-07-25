import type { CitationFormatted } from './types';
import { normalizeCitationText } from './text-normalize';

/** Write Turabian HTML + plain-text to the clipboard (Q4 resolution). */
export async function copyCitationToClipboard(citation: CitationFormatted): Promise<void> {
	const plain = normalizeCitationText(citation.plain.trim());
	const html = normalizeCitationText(citation.html.trim());
	if (!plain && !html) {
		throw new Error('Nothing to copy');
	}

	if (typeof navigator !== 'undefined' && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
		const items: Record<string, Blob> = {
			'text/plain': new Blob([plain], { type: 'text/plain' })
		};
		if (html) {
			items['text/html'] = new Blob([html], { type: 'text/html' });
		}
		await navigator.clipboard.write([new ClipboardItem(items)]);
		return;
	}

	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(plain);
		return;
	}

	throw new Error('Clipboard unavailable');
}

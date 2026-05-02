/**
 * ISBN normalization + check-digit validation (scan + manual entry).
 * Rejects many partial / mis-read barcodes that still have length 10/13.
 */

/** Strip non-digits; accept ISBN-10 (incl. trailing X) / ISBN-13. */
export function normalizeIsbnDigits(raw: string): string | null {
	const d = raw.replace(/[^0-9X]/gi, '').toUpperCase();
	if (d.length === 13 && /^\d{13}$/.test(d)) return d;
	if (d.length === 10 && /^\d{9}[\dX]$/.test(d)) return d;
	return null;
}

function isbn13ChecksumOk(s: string): boolean {
	let sum = 0;
	for (let i = 0; i < 12; i++) {
		const n = s.charCodeAt(i) - 48;
		sum += n * (i % 2 === 0 ? 1 : 3);
	}
	const check = (10 - (sum % 10)) % 10;
	return check === s.charCodeAt(12) - 48;
}

function isbn10ChecksumOk(s: string): boolean {
	let sum = 0;
	for (let i = 0; i < 9; i++) {
		sum += (s.charCodeAt(i) - 48) * (10 - i);
	}
	const last = s[9]!;
	const checkVal = last === 'X' ? 10 : last.charCodeAt(0) - 48;
	if (last !== 'X' && (checkVal < 0 || checkVal > 9)) return false;
	sum += checkVal;
	return sum % 11 === 0;
}

/** True when `normalized` is 10 or 13 chars and the standard check digit matches. */
export function isValidIsbnChecksum(normalized: string): boolean {
	if (normalized.length === 13) return isbn13ChecksumOk(normalized);
	if (normalized.length === 10) return isbn10ChecksumOk(normalized);
	return false;
}

/**
 * Normalize raw scan/text and require a valid ISBN-10 or ISBN-13 check digit.
 * Returns null if length is wrong or checksum fails.
 */
export function parseIsbnWithChecksum(raw: string): string | null {
	const n = normalizeIsbnDigits(raw);
	if (!n) return null;
	return isValidIsbnChecksum(n) ? n : null;
}

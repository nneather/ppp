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
 * Convert a normalized ISBN-10 to ISBN-13 (`978` + first 9 + new check digit).
 * Returns null if the input is not a 10-char ISBN-10 shape.
 */
export function isbn10ToIsbn13(isbn10: string): string | null {
	if (isbn10.length !== 10 || !/^\d{9}[\dX]$/i.test(isbn10)) return null;
	const body = `978${isbn10.slice(0, 9)}`;
	let sum = 0;
	for (let i = 0; i < 12; i++) {
		const n = body.charCodeAt(i) - 48;
		sum += n * (i % 2 === 0 ? 1 : 3);
	}
	const check = (10 - (sum % 10)) % 10;
	return `${body}${check}`;
}

/**
 * All comparable digit strings for matching (raw normalized form + ISBN-10↔13 twin).
 * Does not require a valid check digit — Goodreads cells are sometimes dirty.
 */
export function isbnMatchKeys(normalized: string): string[] {
	const keys = new Set<string>([normalized]);
	if (normalized.length === 10) {
		const as13 = isbn10ToIsbn13(normalized);
		if (as13) keys.add(as13);
	} else if (normalized.length === 13 && normalized.startsWith('978')) {
		const core = normalized.slice(3, 12);
		if (/^\d{9}$/.test(core)) {
			let sum = 0;
			for (let i = 0; i < 9; i++) {
				sum += (core.charCodeAt(i) - 48) * (10 - i);
			}
			const rem = sum % 11;
			const check = rem === 0 ? '0' : rem === 1 ? 'X' : String(11 - rem);
			keys.add(`${core}${check}`);
		}
	}
	return [...keys];
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

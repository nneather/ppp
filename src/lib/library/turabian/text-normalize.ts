/**
 * Normalize citation text for display + clipboard.
 * NFC composes Greek base+breathing+accent into precomposed letters so
 * browsers and Word do not stack combining marks incorrectly.
 */
export function normalizeCitationText(value: string): string {
	return value.normalize('NFC');
}

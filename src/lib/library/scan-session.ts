/** Set when navigating from barcode scan → new book; consumed once on `/library/books/new`. */
export const LIBRARY_SCAN_SESSION_KEY = 'library_scan_session_v1';

export function markScanSessionForNewBook(): void {
	try {
		sessionStorage.setItem(LIBRARY_SCAN_SESSION_KEY, '1');
	} catch {
		/* private mode / quota */
	}
}

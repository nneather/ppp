/**
 * Pure helpers for project deferred_until (intentional park).
 * Active while deferred_until is set and strictly after Chicago today.
 */

/** True when the project is intentionally parked past today (Chicago civil). */
export function isProjectDeferred(
	deferredUntil: string | null | undefined,
	todayYmd: string
): boolean {
	return deferredUntil != null && deferredUntil > todayYmd;
}

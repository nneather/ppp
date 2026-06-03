/**
 * Projects week math — civil Sunday as week start in America/Chicago.
 * Different from invoicing's Monday–Sunday "week containing" convention.
 */
import {
	ymdInChicago,
	utcNoonFromYmd,
	ymdFromUtcNoon
} from '$lib/invoicing/chicago-date';

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseYmd(ymd: string): string | null {
	const t = ymd.trim();
	return YMD_RE.test(t) ? t : null;
}

/** Civil Sunday on or before `ymd` (Chicago civil date). */
export function sundayContaining(ymd: string): string {
	const mid = utcNoonFromYmd(ymd);
	if (!mid) return ymd;
	const dow = mid.getUTCDay();
	const sun = new Date(mid);
	sun.setUTCDate(sun.getUTCDate() - dow);
	return ymdFromUtcNoon(sun);
}

/** Current week's Sunday in Chicago. */
export function currentSundayChicago(): string {
	return sundayContaining(ymdInChicago());
}

/** Previous Sunday before `weekOf` (must be a Sunday YMD). */
export function previousSunday(weekOf: string): string {
	const mid = utcNoonFromYmd(weekOf);
	if (!mid) return weekOf;
	const prev = new Date(mid);
	prev.setUTCDate(prev.getUTCDate() - 7);
	return ymdFromUtcNoon(prev);
}

export function formatWeekLabel(weekOf: string): string {
	const mid = utcNoonFromYmd(weekOf);
	if (!mid) return weekOf;
	return new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Chicago',
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	}).format(mid);
}

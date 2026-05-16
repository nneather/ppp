/**
 * Invoicing uses America/Chicago for “today,” period defaults, and all user-visible
 * date/datetime formatting. DB stores civil YYYY-MM-DD and ISO instants unchanged.
 */
export const INVOICING_TIME_ZONE = 'America/Chicago' as const;

const chicagoYmdParts = new Intl.DateTimeFormat('en-US', {
	timeZone: INVOICING_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

function partsToYmd(parts: Iterable<Intl.DateTimeFormatPart>): string {
	let y = '';
	let mo = '';
	let d = '';
	for (const p of parts) {
		if (p.type === 'year') y = p.value;
		else if (p.type === 'month') mo = p.value;
		else if (p.type === 'day') d = p.value;
	}
	return `${y}-${mo}-${d}`;
}

/** Civil calendar YYYY-MM-DD for this instant in America/Chicago. */
export function ymdInChicago(isoInstant: Date = new Date()): string {
	return partsToYmd(chicagoYmdParts.formatToParts(isoInstant));
}

/** UTC noon on a civil YMD — stable weekday and day arithmetic (avoids DST edges). */
export function utcNoonFromYmd(ymd: string): Date | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
	if (!m) return null;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const day = Number(m[3]);
	const d = new Date(Date.UTC(y, mo - 1, day, 12, 0, 0));
	if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== day) return null;
	return d;
}

export function ymdFromUtcNoon(d: Date): string {
	const y = d.getUTCFullYear();
	const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	return `${y}-${mo}-${day}`;
}

/** Monday–Sunday week (Gregorian) containing this civil date. */
export function mondaySundayWeekContainingYmd(ymd: string): { start: string; end: string } {
	const mid = utcNoonFromYmd(ymd);
	if (!mid) return { start: ymd, end: ymd };
	const dow = mid.getUTCDay();
	const diffToMonday = (dow + 6) % 7;
	const mon = new Date(mid);
	mon.setUTCDate(mon.getUTCDate() - diffToMonday);
	const sun = new Date(mon);
	sun.setUTCDate(sun.getUTCDate() + 6);
	return { start: ymdFromUtcNoon(mon), end: ymdFromUtcNoon(sun) };
}

/** Previous Monday–Sunday relative to Chicago “today”. */
export function previousMondaySundayWeekChicago(): { start: string; end: string } {
	const today = ymdInChicago();
	const week = mondaySundayWeekContainingYmd(today);
	const thisMon = utcNoonFromYmd(week.start);
	if (!thisMon) return { start: today, end: today };
	thisMon.setUTCDate(thisMon.getUTCDate() - 7);
	const prevSun = new Date(thisMon);
	prevSun.setUTCDate(prevSun.getUTCDate() + 6);
	return { start: ymdFromUtcNoon(thisMon), end: ymdFromUtcNoon(prevSun) };
}

/** First day of the calendar month through `todayYmd` (inclusive). */
export function firstOfMonthThroughYmd(todayYmd: string): { start: string; end: string } {
	const mid = utcNoonFromYmd(todayYmd);
	if (!mid) return { start: todayYmd, end: todayYmd };
	const start = new Date(Date.UTC(mid.getUTCFullYear(), mid.getUTCMonth(), 1, 12, 0, 0));
	return { start: ymdFromUtcNoon(start), end: todayYmd };
}

/** Calendar-month span covering min..max civil dates (first of min month through last of max month). */
export function monthSpanFromMinMaxYmd(minYmd: string, maxYmd: string): { start: string; end: string } {
	const minMid = utcNoonFromYmd(minYmd);
	const maxMid = utcNoonFromYmd(maxYmd);
	if (!minMid || !maxMid) {
		return firstOfMonthThroughYmd(ymdInChicago());
	}
	const start = new Date(Date.UTC(minMid.getUTCFullYear(), minMid.getUTCMonth(), 1, 12, 0, 0));
	const end = new Date(Date.UTC(maxMid.getUTCFullYear(), maxMid.getUTCMonth() + 1, 0, 12, 0, 0));
	return { start: ymdFromUtcNoon(start), end: ymdFromUtcNoon(end) };
}

export function formatYmdLongChicago(ymd: string): string {
	const d = utcNoonFromYmd(ymd);
	if (!d) return ymd;
	return new Intl.DateTimeFormat('en-US', {
		timeZone: INVOICING_TIME_ZONE,
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	}).format(d);
}

export function formatYmdMonthYearChicago(ymd: string): string {
	const d = utcNoonFromYmd(ymd);
	if (!d) return ymd;
	return new Intl.DateTimeFormat('en-US', {
		timeZone: INVOICING_TIME_ZONE,
		month: 'long',
		year: 'numeric'
	}).format(d);
}

export function formatYmdShortChicago(ymd: string): string {
	const d = utcNoonFromYmd(ymd);
	if (!d) return ymd;
	return new Intl.DateTimeFormat('en-US', {
		timeZone: INVOICING_TIME_ZONE,
		month: 'short',
		day: 'numeric'
	}).format(d);
}

export function formatYmdMediumChicago(ymd: string): string {
	const d = utcNoonFromYmd(ymd);
	if (!d) return ymd;
	return new Intl.DateTimeFormat('en-US', {
		timeZone: INVOICING_TIME_ZONE,
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	}).format(d);
}

export function formatInstantInChicago(iso: string, opts?: { dateOnly?: boolean }): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	const base: Intl.DateTimeFormatOptions = {
		timeZone: INVOICING_TIME_ZONE,
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	};
	if (!opts?.dateOnly) {
		base.hour = 'numeric';
		base.minute = '2-digit';
	}
	return new Intl.DateTimeFormat('en-US', base).format(d);
}

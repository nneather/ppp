/** Snap billable hours to the nearest quarter (0.25). */
export function snapHoursToQuarter(hours: number): number {
	return Math.round(hours * 4) / 4;
}

/** Format snapped hours for a number input (no trailing zeros). */
export function formatHoursForInput(hours: number): string {
	const n = snapHoursToQuarter(hours);
	return Number.isInteger(n) ? String(n) : String(n);
}

/** Parse user text; returns null when not a positive finite number. */
export function parseHoursInput(raw: string): number | null {
	const t = raw.trim();
	if (!t) return null;
	const n = Number(t.replace(',', '.'));
	if (!Number.isFinite(n) || n <= 0 || n > 99999) return null;
	return n;
}

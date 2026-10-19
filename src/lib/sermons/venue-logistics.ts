import { HYMNALS, HYMNAL_LABELS, type Hymnal } from '$lib/types/sermons';

const CLOCK_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const DRIVE_MIN = 1;
const DRIVE_MAX = 600;
const NOTES_MAX = 2000;

export function parseHymnal(raw: string | null | undefined): Hymnal | null {
	if (!raw) return null;
	return (HYMNALS as readonly string[]).includes(raw) ? (raw as Hymnal) : null;
}

/** `HH:MM` for `<input type="time">`. Accepts `HH:MM:SS` from Postgres. */
export function clockForInput(value: string | null | undefined): string {
	const parsed = parseClock(value);
	if (!parsed.ok || !parsed.value) return '';
	return parsed.value.slice(0, 5);
}

/** Display clock: `9:30 AM`, `11 AM`. */
export function formatClock(value: string | null | undefined): string | null {
	const parsed = parseClock(value);
	if (!parsed.ok || !parsed.value) return null;
	const [hh, mm] = parsed.value.split(':');
	let hour = Number(hh);
	const suffix = hour >= 12 ? 'PM' : 'AM';
	hour = hour % 12;
	if (hour === 0) hour = 12;
	return mm === '00' ? `${hour} ${suffix}` : `${hour}:${mm} ${suffix}`;
}

export function formatVenueLogistics(venue: {
	service_start: string | null;
	drive_minutes: number | null;
	depart_by: string | null;
	hymnal: Hymnal | null;
}): string | null {
	const parts: string[] = [];
	const start = formatClock(venue.service_start);
	if (start) parts.push(start);
	const leave = formatClock(venue.depart_by);
	if (leave) parts.push(`leave by ${leave}`);
	if (venue.drive_minutes != null) parts.push(`${venue.drive_minutes} min drive`);
	if (venue.hymnal) parts.push(HYMNAL_LABELS[venue.hymnal]);
	return parts.length > 0 ? parts.join(' · ') : null;
}

export type ParsedVenueLogistics = {
	/** `HH:MM:SS` or null. */
	service_start: string | null;
	drive_minutes: number | null;
	/** `HH:MM:SS` or null. */
	depart_by: string | null;
	hymnal: Hymnal | null;
	notes: string | null;
};

/**
 * Parse posted venue logistics. Empty fields clear to null.
 * `ok: false` is a validation error; callers map it to a form failure.
 */
export function parseVenueLogisticsFields(input: {
	serviceStart: string | null;
	driveMinutes: string | null;
	departBy: string | null;
	hymnal: string | null;
	notes: string | null;
}): { ok: true; value: ParsedVenueLogistics } | { ok: false; message: string } {
	const service = parseClock(input.serviceStart);
	if (!service.ok) return { ok: false, message: 'Service start must be a time of day.' };
	const depart = parseClock(input.departBy);
	if (!depart.ok) return { ok: false, message: 'Leave by must be a time of day.' };

	const drive = parseDriveMinutes(input.driveMinutes);
	if (!drive.ok) {
		return { ok: false, message: `Drive must be ${DRIVE_MIN}–${DRIVE_MAX} minutes.` };
	}

	if (input.hymnal && !parseHymnal(input.hymnal)) {
		return { ok: false, message: 'Pick a hymnal from the list.' };
	}

	const notes = input.notes?.trim() ? input.notes.trim() : null;
	if (notes && notes.length > NOTES_MAX) {
		return { ok: false, message: 'Notes are too long.' };
	}

	return {
		ok: true,
		value: {
			service_start: service.value,
			drive_minutes: drive.value,
			depart_by: depart.value,
			hymnal: parseHymnal(input.hymnal),
			notes
		}
	};
}

function parseClock(
	raw: string | null | undefined
): { ok: true; value: string | null } | { ok: false } {
	if (raw == null || raw.trim() === '') return { ok: true, value: null };
	const match = CLOCK_RE.exec(raw.trim());
	if (!match) return { ok: false };
	const hour = Number(match[1]);
	const minute = Number(match[2]);
	const second = match[3] != null ? Number(match[3]) : 0;
	if (hour > 23 || minute > 59 || second > 59) return { ok: false };
	const hh = String(hour).padStart(2, '0');
	const mm = String(minute).padStart(2, '0');
	const ss = String(second).padStart(2, '0');
	return { ok: true, value: `${hh}:${mm}:${ss}` };
}

function parseDriveMinutes(
	raw: string | null | undefined
): { ok: true; value: number | null } | { ok: false } {
	if (raw == null || raw.trim() === '') return { ok: true, value: null };
	if (!/^\d+$/.test(raw.trim())) return { ok: false };
	const n = Number(raw.trim());
	if (n < DRIVE_MIN || n > DRIVE_MAX) return { ok: false };
	return { ok: true, value: n };
}

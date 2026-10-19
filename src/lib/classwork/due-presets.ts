/**
 * Due-date presets for assignment reschedule (mirrors task Defer presets,
 * but mutates assignments.due_date — past dates allowed).
 */
import { addDaysYmd, nextMondayYmdChicago } from '$lib/invoicing/chicago-date';

export type AssignmentDuePreset = 'tomorrow' | 'monday' | 'week';

export function dueDateForPreset(
	preset: AssignmentDuePreset,
	todayYmd: string
): string | null {
	if (preset === 'tomorrow') return addDaysYmd(todayYmd, 1);
	if (preset === 'week') return addDaysYmd(todayYmd, 7);
	if (preset === 'monday') return nextMondayYmdChicago(todayYmd);
	return null;
}

export function parseAssignmentDuePreset(raw: string | null | undefined): AssignmentDuePreset | null {
	const t = (raw ?? '').trim();
	if (t === 'tomorrow' || t === 'monday' || t === 'week') return t;
	return null;
}

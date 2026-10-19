/**
 * Weekly project check-in ritual helpers.
 * The MYN series with ritual_kind = weekly_project_checkin mirrors
 * countMissingWeekCheckIns === 0 for the Chicago Sunday week.
 */
import { addDaysYmd } from '$lib/invoicing/chicago-date';

export const WEEKLY_PROJECT_CHECKIN_RITUAL = 'weekly_project_checkin' as const;

/** Inclusive end of the Sunday-start Chicago week (Saturday). */
export function sundayWeekEndYmd(weekOf: string): string | null {
	return addDaysYmd(weekOf, 6);
}

/** True when startDate falls in [weekOf, weekOf+6] (Chicago civil YMDs). */
export function startDateInSundayWeek(startDate: string, weekOf: string): boolean {
	const end = sundayWeekEndYmd(weekOf);
	if (!end) return false;
	return startDate >= weekOf && startDate <= end;
}

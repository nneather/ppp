import { describe, expect, it } from 'vitest';
import { reduceCarryForwardUpdates, type CarryForwardRow } from '$lib/projects/carry-forward';

function row(
	overrides: Partial<CarryForwardRow> & Pick<CarryForwardRow, 'project_id' | 'week_of' | 'health_status'>
): CarryForwardRow {
	return {
		reason: null,
		next_steps: null,
		progress_value: null,
		progress_max: null,
		progress_note: null,
		...overrides
	};
}

describe('reduceCarryForwardUpdates', () => {
	it('keeps the newest week per project when rows are ordered desc', () => {
		const map = reduceCarryForwardUpdates([
			row({ project_id: 'a', week_of: '2026-06-08', health_status: 'watch' }),
			row({ project_id: 'b', week_of: '2026-06-08', health_status: 'critical' }),
			row({ project_id: 'a', week_of: '2026-06-01', health_status: 'excellent' })
		]);
		expect(map.get('a')?.health_status).toBe('watch');
		expect(map.get('b')?.health_status).toBe('critical');
	});

	it('skips a gap week and uses the latest row before the selected week', () => {
		const map = reduceCarryForwardUpdates([
			row({ project_id: 'a', week_of: '2026-05-25', health_status: 'serious', reason: 'blocked' })
		]);
		expect(map.get('a')).toEqual({
			health_status: 'serious',
			reason: 'blocked',
			next_steps: null,
			progress_value: null,
			progress_max: null,
			progress_note: null
		});
	});

	it('ignores invalid health_status values', () => {
		const invalid = {
			project_id: 'a',
			week_of: '2026-06-01',
			health_status: 'not-a-status',
			reason: null,
			next_steps: null,
			progress_value: null,
			progress_max: null,
			progress_note: null
		};
		const map = reduceCarryForwardUpdates([invalid as CarryForwardRow]);
		expect(map.size).toBe(0);
	});
});

import { describe, expect, it } from 'vitest';
import { formatStudyNotesCopy, type NoteCopyInput } from '../notes-copy';

const notes: NoteCopyInput[] = [
	{
		sourceKey: 'towner',
		sourceLabel: 'Towner, The Pastoral Epistles',
		page: '215',
		passageDisplay: '1 Timothy 2:12',
		body: 'women teach in the gathered church',
		createdAt: '2026-10-24T20:00:00Z'
	},
	{
		sourceKey: '',
		sourceLabel: null,
		page: null,
		passageDisplay: null,
		body: 'a margin note with no book',
		createdAt: '2026-10-24T21:00:00Z'
	},
	{
		sourceKey: 'towner',
		sourceLabel: 'Towner, The Pastoral Epistles',
		page: '10',
		passageDisplay: null,
		body: 'the introduction',
		createdAt: '2026-10-23T20:00:00Z'
	}
];

describe('formatStudyNotesCopy', () => {
	it('puts unattached notes first and pages a source in order', () => {
		expect(formatStudyNotesCopy(notes)).toBe(
			[
				'Unattached: a margin note with no book',
				'',
				'Towner, The Pastoral Epistles, 10: the introduction',
				'Towner, The Pastoral Epistles, 215 (1 Timothy 2:12): women teach in the gathered church'
			].join('\n')
		);
	});
});

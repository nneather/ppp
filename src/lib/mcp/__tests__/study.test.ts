import { describe, expect, it } from 'vitest';
import { resolveStudy, studyLabel, studySuggestions, type StudyResolveInput } from '../study';

const studies: StudyResolveInput[] = [
	{
		id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
		kind: 'paper',
		label: 'Romans 8',
		title: 'Romans 8 exegesis',
		passage: 'Romans 8',
		topic: null
	},
	{
		id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
		kind: 'sermon',
		label: 'Philemon 1',
		title: null,
		passage: 'Philemon 1',
		topic: 'Partnership'
	},
	{
		id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
		kind: 'paper',
		label: 'Union with Christ',
		title: 'Union with Christ',
		passage: null,
		topic: 'Union'
	}
];

describe('studyLabel', () => {
	it('lets the passage lead a paper and a sermon', () => {
		expect(
			studyLabel({ kind: 'paper', title: 'Exegesis', passage: 'Romans 8', topic: null })
		).toBe('Romans 8');
		expect(
			studyLabel({ kind: 'sermon', title: null, passage: null, topic: 'Hope' })
		).toBe('Hope');
	});
});

describe('resolveStudy', () => {
	it('matches a uuid and a unique passage or title', () => {
		expect(resolveStudy(studies[0]!.id, studies)?.kind).toBe('paper');
		expect(resolveStudy('philemon 1', studies)?.kind).toBe('sermon');
		expect(resolveStudy('Union with Christ', studies)?.id).toBe(studies[2]!.id);
	});

	it('resolves a unique prefix and returns null when ambiguous or unknown', () => {
		expect(resolveStudy('Partnership', studies)?.id).toBe(studies[1]!.id);
		expect(resolveStudy('Rom', studies)?.id).toBe(studies[0]!.id);
		const collide: StudyResolveInput[] = [
			{ ...studies[0]!, id: '1', label: 'Romans 8', passage: 'Romans 8' },
			{
				...studies[1]!,
				id: '2',
				kind: 'sermon',
				label: 'Romans 9',
				passage: 'Romans 9',
				topic: null
			}
		];
		expect(resolveStudy('Romans', collide)).toBeNull();
		expect(resolveStudy('xyzzy', studies)).toBeNull();
		expect(resolveStudy('', studies)).toBeNull();
	});
});

describe('studySuggestions', () => {
	it('lists labels that contain the query', () => {
		expect(studySuggestions('rom', studies)).toEqual(['Romans 8 (paper)']);
	});
});

import { describe, expect, it } from 'vitest';
import {
	bibleBooksInDisplay,
	buildImportChecklist,
	importGroupName,
	parseImportTarget,
	parsePaperListShow,
	setIdForGroupName,
	suggestResourceSets,
	type ImportSetSummary
} from '../import-suggest';
import { nextStudyUsage, includeInCompiledBibliography } from '../source-usage';
import { paperDisplayLead } from '../paper-display';

const sets: ImportSetSummary[] = [
	{
		id: 'set-rom',
		name: 'Commentaries: Romans',
		kind: 'bible_book',
		rules: [{ kind: 'bible_book', value: 'Romans' }]
	},
	{
		id: 'set-ps',
		name: 'Commentaries: Psalms',
		kind: 'bible_book',
		rules: [{ kind: 'bible_book', value: 'Psalms' }]
	},
	{
		id: 'set-nt',
		name: 'NT language tools',
		kind: 'language',
		rules: [{ kind: 'genre', value: 'Greek Language Tools' }]
	},
	{
		id: 'set-ot',
		name: 'OT language tools',
		kind: 'language',
		rules: [{ kind: 'genre', value: 'Hebrew Language Tools' }]
	},
	{
		id: 'set-st',
		name: 'Systematic Theology',
		kind: 'custom',
		rules: []
	},
	{
		id: 'set-cov',
		name: 'Covenant theology',
		kind: 'custom',
		rules: [{ kind: 'topic', value: 'covenant' }]
	}
];

describe('suggestResourceSets', () => {
	it('suggests commentary, testament tools, and systematics for an expository passage', () => {
		const suggested = suggestResourceSets(
			{ topical: false, passageDisplay: 'Romans 8:28–30', topic: null },
			sets
		);
		expect(suggested.map((s) => [s.name, s.reason])).toEqual([
			['Commentaries: Romans', 'passage'],
			['NT language tools', 'testament'],
			['Systematic Theology', 'expository']
		]);
	});

	it('suggests both testaments when the passage names OT and NT books', () => {
		const suggested = suggestResourceSets(
			{ topical: false, passageDisplay: 'Psalm 110 and Hebrews 1', topic: null },
			sets
		);
		expect(suggested.map((s) => s.name)).toEqual([
			'Commentaries: Psalms',
			'OT language tools',
			'NT language tools',
			'Systematic Theology'
		]);
	});

	it('suggests topic sets for a topical paper, and the commentary when a passage is set', () => {
		const suggested = suggestResourceSets(
			{ topical: true, passageDisplay: 'Romans 9', topic: 'Covenant and election' },
			sets
		);
		expect(suggested.map((s) => [s.name, s.reason])).toEqual([
			['Covenant theology', 'topical'],
			['Commentaries: Romans', 'passage']
		]);
	});

	it('does not treat a short topic fragment as a match', () => {
		const suggested = suggestResourceSets(
			{ topical: true, passageDisplay: null, topic: 'sin' },
			sets
		);
		expect(suggested).toEqual([]);
	});
});

describe('bibleBooksInDisplay', () => {
	it('prefers 1 John over John', () => {
		expect(bibleBooksInDisplay('1 John 4:8')).toEqual(['1 John']);
	});
});

describe('import checklist', () => {
	it('names groups after the set or prior paper', () => {
		expect(importGroupName('set', 'Commentaries: Romans')).toBe('Commentaries: Romans');
		expect(importGroupName('paper', 'Psalm 110 exegesis')).toBe('From: Psalm 110 exegesis');
	});

	it('marks already-attached rows and keeps notes', () => {
		const rows = buildImportChecklist(
			[
				{ bookId: 'b1', essayId: null, title: 'Already', notes: 'keep me' },
				{ bookId: null, essayId: 'e1', title: 'New essay', notes: null }
			],
			['b1'],
			[]
		);
		expect(rows.map((r) => [r.title, r.attached, r.notes])).toEqual([
			['Already', true, 'keep me'],
			['New essay', false, null]
		]);
	});

	it('maps an import group name back to its set', () => {
		expect(setIdForGroupName('Commentaries: Romans', sets)).toBe('set-rom');
		expect(setIdForGroupName('From: Psalm 110', sets)).toBeNull();
	});
});

describe('parse helpers', () => {
	it('reads archived show and import targets', () => {
		expect(parsePaperListShow('archived')).toBe('archived');
		expect(parsePaperListShow(null)).toBe('active');
		expect(parseImportTarget('set:11111111-1111-4111-8111-111111111111')).toEqual({
			kind: 'set',
			id: '11111111-1111-4111-8111-111111111111'
		});
		expect(parseImportTarget('nope')).toBeNull();
	});
});

describe('usage and display', () => {
	it('cycles usage and keeps candidates out of the default bibliography', () => {
		expect(nextStudyUsage('candidate')).toBe('consulted');
		expect(nextStudyUsage('consulted')).toBe('cited');
		expect(nextStudyUsage('cited')).toBe('candidate');
		expect(includeInCompiledBibliography('candidate', false)).toBe(false);
		expect(includeInCompiledBibliography('consulted', false)).toBe(true);
		expect(includeInCompiledBibliography('candidate', true)).toBe(true);
	});

	it('leads with the passage when one is set', () => {
		expect(paperDisplayLead({ title: 'Exegesis', passage_display: 'Psalm 110' })).toEqual({
			lead: 'Psalm 110',
			detail: 'Exegesis'
		});
		expect(paperDisplayLead({ title: 'Exegesis', passage_display: null })).toEqual({
			lead: 'Exegesis',
			detail: null
		});
	});
});

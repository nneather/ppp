import { describe, expect, it } from 'vitest';
import { matchPublisher, normalizePublisherName } from '$lib/library/match';
import type { PublisherRow } from '$lib/types/library';

const rows: PublisherRow[] = [
	{
		id: '1',
		canonical_name: 'Eerdmans',
		parent_id: null,
		default_location: 'Grand Rapids, MI',
		aliases: ['Wm. B. Eerdmans Publishing Co.', 'Eerdmans Publishing'],
		notes: null
	},
	{
		id: '2',
		canonical_name: 'IVP Academic',
		parent_id: '3',
		default_location: 'Downers Grove, IL',
		parent_default_location: 'Downers Grove, IL',
		aliases: ['InterVarsity Press Academic'],
		notes: null
	},
	{
		id: '3',
		canonical_name: 'IVP',
		parent_id: null,
		default_location: 'Downers Grove, IL',
		aliases: ['InterVarsity Press', 'Inter-Varsity Press'],
		notes: null
	}
];

describe('normalizePublisherName', () => {
	it('strips publishing suffixes and punctuation', () => {
		expect(normalizePublisherName('Wm. B. Eerdmans Publishing Co.')).toBe('wm b eerdmans');
		expect(normalizePublisherName('Baker Academic, a division of Baker Publishing Group')).toBe(
			'baker academic a of baker'
		);
	});
});

describe('matchPublisher', () => {
	it('matches canonical name', () => {
		expect(matchPublisher('Eerdmans', rows)?.canonical_name).toBe('Eerdmans');
	});

	it('matches alias', () => {
		expect(matchPublisher('Wm. B. Eerdmans Publishing Co.', rows)?.id).toBe('1');
	});

	it('matches imprint over parent when alias is specific', () => {
		expect(matchPublisher('InterVarsity Press Academic', rows)?.canonical_name).toBe(
			'IVP Academic'
		);
	});

	it('returns null for unknown', () => {
		expect(matchPublisher('Random House', rows)).toBeNull();
	});
});

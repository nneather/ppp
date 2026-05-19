import { describe, expect, it } from 'vitest';
import { matchPublisher, normalizePublisherName } from '$lib/library/match';
import { publisherDefaultLocationForRow } from '$lib/library/publisher-resolve';
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

const bakerRows: PublisherRow[] = [
	{
		id: 'baker-parent',
		canonical_name: 'Baker Publishing Group',
		parent_id: null,
		default_location: 'Grand Rapids, MI',
		aliases: ['Baker Publishing', 'Baker Publishing Group'],
		notes: null
	},
	{
		id: 'baker-academic',
		canonical_name: 'Baker Academic',
		parent_id: 'baker-parent',
		default_location: 'Grand Rapids, MI',
		parent_default_location: 'Grand Rapids, MI',
		aliases: [
			'Baker Academic, a division of Baker Publishing Group',
			'Baker Academic Books'
		],
		notes: null
	}
];

describe('matchPublisher — Baker family', () => {
	it('prefers Baker Academic over Baker Publishing Group', () => {
		expect(matchPublisher('Baker Academic', bakerRows)?.canonical_name).toBe('Baker Academic');
	});

	it('matches division alias to Baker Academic', () => {
		expect(
			matchPublisher('Baker Academic, a division of Baker Publishing Group', bakerRows)
				?.canonical_name
		).toBe('Baker Academic');
	});

	it('inherits parent default location when child default_location is null', () => {
		const child: PublisherRow = {
			id: 'baker-academic-null-loc',
			canonical_name: 'Baker Academic',
			parent_id: 'baker-parent',
			default_location: null,
			parent_default_location: 'Grand Rapids, MI',
			aliases: [],
			notes: null
		};
		expect(publisherDefaultLocationForRow(child)).toBe('Grand Rapids, MI');
	});
});

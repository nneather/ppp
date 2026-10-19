import { describe, expect, it } from 'vitest';
import {
	routeIndexRowToVolume,
	stripVolumeFromPageToken
} from '../systematics-set-routing';

const vols = [
	{ bookId: 'v1', volumeNumber: '1', pageMin: 1, pageMax: 400 },
	{ bookId: 'v2', volumeNumber: '2', pageMin: 1, pageMax: 700 },
	{ bookId: 'v3', volumeNumber: '3', pageMin: 1, pageMax: 800 }
];

describe('routeIndexRowToVolume', () => {
	it('routes explicit vol:page to the volume book', () => {
		const r = routeIndexRowToVolume(vols, { pageStart: '2:620' }, 'v3');
		expect(r.bookId).toBe('v2');
		expect(r.reason).toBe('explicit_volume');
	});

	it('routes by outline page when no volume token', () => {
		const single = [{ bookId: 'v2', volumeNumber: '2', pageMin: 600, pageMax: 650 }];
		const r = routeIndexRowToVolume(single, { pageStart: '620' }, 'v1');
		expect(r.bookId).toBe('v2');
		expect(r.reason).toBe('outline_page');
	});

	it('falls back to default', () => {
		const r = routeIndexRowToVolume(vols, { pageStart: '9999' }, 'v3');
		expect(r.bookId).toBe('v3');
		expect(r.reason).toBe('default');
	});

	it('does not treat an Institutes section locator as a page or volume', () => {
		const r = routeIndexRowToVolume(vols, { volume: 'III', pageStart: 'III.2.12' }, 'v2');
		expect(r.bookId).toBe('v2');
		expect(r.reason).toBe('section_locator');
		expect(stripVolumeFromPageToken('III.2.12–14')).toBe('III.2.12–14');
	});

	it('places an arabic Institutes locator on the volume that owns that chapter', () => {
		const calvin = [
			{
				bookId: 'v1',
				volumeNumber: '1',
				pageMin: 3,
				pageMax: 849,
				locators: ['I.13', 'I.14', 'III.2', 'III.19']
			},
			{
				bookId: 'v2',
				volumeNumber: '2',
				pageMin: 850,
				pageMax: 1734,
				locators: ['III.20', 'IV.1']
			}
		];
		const book1 = routeIndexRowToVolume(
			calvin,
			{ volume: '1', pageStart: '1.13.7' },
			'v2'
		);
		expect(book1.bookId).toBe('v1');
		expect(book1.volume).toBeNull();
		expect(book1.reason).toBe('section_locator');

		const book3 = routeIndexRowToVolume(calvin, { pageStart: '3.20.4' }, 'v1');
		expect(book3.bookId).toBe('v2');
		expect(book3.reason).toBe('section_locator');
	});

	it('keeps PA / VG / VL on the book being indexed', () => {
		const calvin = [
			{
				bookId: 'v1',
				volumeNumber: '1',
				pageMin: 3,
				pageMax: 849,
				locators: ['I.13']
			},
			{
				bookId: 'v2',
				volumeNumber: '2',
				pageMin: 850,
				pageMax: 1734,
				locators: ['III.20']
			}
		];
		const pa = routeIndexRowToVolume(calvin, { pageStart: 'PA 3' }, 'v2');
		expect(pa.bookId).toBe('v2');
		expect(pa.reason).toBe('edition_pointer');
		const vg = routeIndexRowToVolume(
			calvin,
			{ pageStart: '1.5.2', reviewNote: 'VG' },
			'v2'
		);
		expect(vg.bookId).toBe('v2');
		expect(vg.reason).toBe('edition_pointer');
	});
});

describe('stripVolumeFromPageToken', () => {
	it('strips vol prefix', () => {
		expect(stripVolumeFromPageToken('2:620')).toBe('620');
		expect(stripVolumeFromPageToken('620')).toBe('620');
	});
});

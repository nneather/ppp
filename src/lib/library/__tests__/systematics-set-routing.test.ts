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
});

describe('stripVolumeFromPageToken', () => {
	it('strips vol prefix', () => {
		expect(stripVolumeFromPageToken('2:620')).toBe('620');
		expect(stripVolumeFromPageToken('620')).toBe('620');
	});
});

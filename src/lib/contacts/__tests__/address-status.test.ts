import { describe, expect, it } from 'vitest';
import { addressStatus, formatAddressOneLine } from '../address-status';

const full = {
	address_line_1: '123 Main St',
	address_line_2: 'Apt 4',
	city: 'Columbia',
	state: 'SC',
	postal_code: '29201',
	address_updated_on: null as string | null
};

describe('addressStatus', () => {
	it('is none when any of street/city/state/zip is missing', () => {
		expect(addressStatus({ ...full, postal_code: null }, '2026-11-24')).toBe('none');
		expect(addressStatus({ ...full, city: '  ' }, '2026-11-24')).toBe('none');
	});
	it('is unconfirmed when never checked or checked in a prior year', () => {
		expect(addressStatus(full, '2026-11-24')).toBe('unconfirmed');
		expect(addressStatus({ ...full, address_updated_on: '2025-12-01' }, '2026-11-24')).toBe(
			'unconfirmed'
		);
	});
	it('is confirmed when checked this year', () => {
		expect(addressStatus({ ...full, address_updated_on: '2026-11-24' }, '2026-11-24')).toBe(
			'confirmed'
		);
	});
});

describe('formatAddressOneLine', () => {
	it('joins parts with state and zip together', () => {
		expect(formatAddressOneLine(full)).toBe('123 Main St, Apt 4, Columbia, SC 29201');
	});
	it('is empty when nothing is set', () => {
		expect(
			formatAddressOneLine({
				address_line_1: null,
				address_line_2: null,
				city: null,
				state: null,
				postal_code: null,
				address_updated_on: null
			})
		).toBe('');
	});
});

import { describe, expect, it } from 'vitest';
import { normalizePublisherLocationTurabian } from '../publisher-location';

describe('normalizePublisherLocationTurabian', () => {
	it('abbreviates US state names and strips USA', () => {
		expect(normalizePublisherLocationTurabian('Grand Rapids, Michigan, USA')).toBe(
			'Grand Rapids, MI'
		);
		expect(normalizePublisherLocationTurabian('Grand Rapids, MI')).toBe('Grand Rapids, MI');
	});

	it('maps traditional bibliographic state abbreviations to postal', () => {
		expect(normalizePublisherLocationTurabian('Grand Rapids, Mich')).toBe('Grand Rapids, MI');
		expect(normalizePublisherLocationTurabian('Grand Rapids, Mich.')).toBe('Grand Rapids, MI');
		expect(normalizePublisherLocationTurabian('Downers Grove, Ill.')).toBe('Downers Grove, IL');
		expect(normalizePublisherLocationTurabian('Wheaton, Ill')).toBe('Wheaton, IL');
		expect(normalizePublisherLocationTurabian('Waco, Tex.')).toBe('Waco, TX');
		expect(normalizePublisherLocationTurabian('Phillipsburg, N.J.')).toBe('Phillipsburg, NJ');
	});

	it('keeps Cambridge, MA distinct from Cambridge', () => {
		expect(normalizePublisherLocationTurabian('Cambridge, MA')).toBe('Cambridge, MA');
		expect(normalizePublisherLocationTurabian('Cambridge, Massachusetts')).toBe('Cambridge, MA');
		expect(normalizePublisherLocationTurabian('Cambridge')).toBe('Cambridge');
	});

	it('drops state/country for well-known cities', () => {
		expect(normalizePublisherLocationTurabian('New York, NY')).toBe('New York');
		expect(normalizePublisherLocationTurabian('New York, N.Y.')).toBe('New York');
		expect(normalizePublisherLocationTurabian('London, England')).toBe('London');
		expect(normalizePublisherLocationTurabian('Tübingen, Germany')).toBe('Tübingen');
		expect(normalizePublisherLocationTurabian('Oxford, UK')).toBe('Oxford');
	});

	it('preserves foreign city + country when not well-known', () => {
		expect(normalizePublisherLocationTurabian('Sheffield, England')).toBe('Sheffield, England');
	});

	it('passes through empty and unknown shapes', () => {
		expect(normalizePublisherLocationTurabian('')).toBe('');
		expect(normalizePublisherLocationTurabian('  ')).toBe('');
		expect(normalizePublisherLocationTurabian('Peabody, MA')).toBe('Peabody, MA');
	});
});

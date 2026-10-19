import { describe, expect, it } from 'vitest';
import { comparePageLabels, normalizePageLabel, pageLabelBefore } from '../page-label';

describe('normalizePageLabel', () => {
	it('keeps arabic pages and lowercases roman numerals', () => {
		expect(normalizePageLabel('835')).toBe('835');
		expect(normalizePageLabel(' xiii ')).toBe('xiii');
		expect(normalizePageLabel('XX')).toBe('xx');
		expect(normalizePageLabel('')).toBeNull();
		expect(normalizePageLabel('13a')).toBeNull();
		expect(normalizePageLabel('iiii')).toBeNull();
	});
});

describe('comparePageLabels', () => {
	it('orders front matter before body pages', () => {
		expect(comparePageLabels('xiii', 'xx')).toBeLessThan(0);
		expect(comparePageLabels('xx', '1')).toBeLessThan(0);
		expect(comparePageLabels('9', '10')).toBeLessThan(0);
		expect(comparePageLabels(null, '1')).toBeGreaterThan(0);
		expect(pageLabelBefore('xx', 'xiii')).toBe(true);
		expect(pageLabelBefore('xiii', 'xx')).toBe(false);
	});
});

import { describe, expect, it } from 'vitest';
import { parseInvoiceId } from './mark-paid';

describe('parseInvoiceId', () => {
	it('accepts a uuid', () => {
		expect(parseInvoiceId('3fa85f64-5717-4562-b3fc-2c963f66afa6')).toBe(
			'3fa85f64-5717-4562-b3fc-2c963f66afa6'
		);
	});

	it('rejects empty and junk', () => {
		expect(parseInvoiceId('')).toBeNull();
		expect(parseInvoiceId('not-a-uuid')).toBeNull();
		expect(parseInvoiceId(null)).toBeNull();
	});
});

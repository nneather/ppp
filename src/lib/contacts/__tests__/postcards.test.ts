import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { LOB_TEST_API_KEY: 'test_abc', LOB_LIVE_API_KEY: 'test_wrongprefix' }
}));

import { buildBackHtml, LOB_HTML_MAX_CHARS } from '../postcard-artwork';
import {
	defaultDesign,
	defaultSelected,
	designProblems,
	householdToLobAddress,
	mailableHouseholds,
	returnAddress,
	type HouseholdAddressRow
} from '../postcards';
import { createLobPostcard, lobKey, lobKeysConfigured } from '../server/lob';

const hh = (id: string, over: Partial<HouseholdAddressRow> = {}): HouseholdAddressRow => ({
	id,
	name: `House ${id}`,
	address_line_1: '1 Main St',
	address_line_2: null,
	city: 'Madison',
	state: 'WI',
	postal_code: '53711',
	address_updated_on: '2026-11-24',
	...over
});

describe('mailableHouseholds', () => {
	const rows = [hh('a'), hh('b'), hh('c', { postal_code: null }), hh('d')];
	it('drops off-list, already-mailed, incomplete, and duplicate ids', () => {
		const out = mailableHouseholds(
			['a', 'a', 'b', 'c', 'd', 'zzz'],
			rows,
			new Set(['a', 'b', 'c']),
			new Set(['b'])
		);
		expect(out.map((h) => h.id)).toEqual(['a']);
	});
});

describe('householdToLobAddress', () => {
	it('maps a full address and caps the name at 40 chars', () => {
		const a = householdToLobAddress(hh('a', { name: 'x'.repeat(60), address_line_2: 'Apt 2' }));
		expect(a).toMatchObject({
			address_line1: '1 Main St',
			address_line2: 'Apt 2',
			address_city: 'Madison',
			address_state: 'WI',
			address_zip: '53711',
			address_country: 'US'
		});
		expect(a!.name).toHaveLength(40);
	});
	it('is null for an incomplete address', () => {
		expect(householdToLobAddress(hh('a', { city: null }))).toBeNull();
	});
});

describe('design checks', () => {
	it('lists what is missing', () => {
		expect(designProblems(defaultDesign('l'))).toEqual([
			'Upload the front artwork.',
			'Write the back message.'
		]);
	});
	it('is ready with a front and a message', () => {
		expect(
			designProblems({
				...defaultDesign('l'),
				front_path: 'u/l/front.pdf',
				back_message: 'Merry Christmas'
			})
		).toEqual([]);
	});
	it('flags a message over Lob’s HTML cap', () => {
		const long = 'x'.repeat(LOB_HTML_MAX_CHARS);
		expect(buildBackHtml(long, '6x9').length).toBeGreaterThan(LOB_HTML_MAX_CHARS);
		expect(
			designProblems({ ...defaultDesign('l'), front_path: 'f', back_message: long }).at(-1)
		).toMatch(/too long/);
	});
	it('needs a name and full address for a return address', () => {
		expect(returnAddress(defaultDesign('l'))).toBeNull();
		expect(
			returnAddress({
				...defaultDesign('l'),
				return_name: 'Parker',
				return_line_1: '1 Main St',
				return_city: 'St. Louis',
				return_state: 'MO',
				return_zip: '63105'
			})?.address_city
		).toBe('St. Louis');
	});
});

describe('defaultSelected', () => {
	it('picks confirmed households not yet mailed', () => {
		expect(
			defaultSelected([
				{ householdId: 'a', label: 'A', address: '', status: 'confirmed', sent: false },
				{ householdId: 'b', label: 'B', address: '', status: 'confirmed', sent: true },
				{ householdId: 'c', label: 'C', address: '', status: 'unconfirmed', sent: false },
				{ householdId: 'd', label: 'D', address: '', status: 'none', sent: false }
			])
		).toEqual(['a']);
	});
});

describe('back message HTML', () => {
	it('escapes markup and keeps line breaks', () => {
		const html = buildBackHtml('<b>Hi</b>\nLove, P', '6x9');
		expect(html).toContain('&lt;b&gt;Hi&lt;/b&gt;<br/>Love, P');
		expect(html).toContain('width:9.25in');
	});
});

describe('lob client', () => {
	it('refuses a key with the wrong prefix', () => {
		expect(lobKeysConfigured()).toEqual({ test: true, live: false });
		expect(lobKey('test')).toEqual({ key: 'test_abc' });
		expect(lobKey('live')).toEqual({ error: 'LOB_LIVE_API_KEY must start with live_.' });
	});

	const req = {
		to: {
			name: 'A',
			address_line1: '1 Main',
			address_city: 'X',
			address_state: 'WI',
			address_zip: '1'
		},
		front: 'https://f',
		back: '<html></html>',
		size: '6x9',
		description: 'd',
		use_type: 'operational' as const
	};

	it('sends the idempotency key and returns the id and proof url', async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response(JSON.stringify({ id: 'psc_1', url: 'https://proof.pdf' }), { status: 200 })
		);
		const r = await createLobPostcard('test_abc', req, 'ppp-postcard:l:h', fetchImpl as never);
		expect(r).toEqual({ ok: true, id: 'psc_1', url: 'https://proof.pdf' });
		const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
		expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('ppp-postcard:l:h');
	});

	it('retries a 500 then succeeds', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response('{}', { status: 500 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'psc_2' }), { status: 200 }));
		const r = await createLobPostcard('test_abc', req, 'k', fetchImpl as never);
		expect(r).toEqual({ ok: true, id: 'psc_2', url: null });
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('passes a 422 error message through without retrying', async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response(JSON.stringify({ error: { message: 'address_zip is invalid' } }), {
					status: 422
				})
		);
		const r = await createLobPostcard('test_abc', req, 'k', fetchImpl as never);
		expect(r).toEqual({ ok: false, error: 'address_zip is invalid' });
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});
});

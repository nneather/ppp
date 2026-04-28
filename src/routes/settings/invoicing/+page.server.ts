import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export type ClientRateRow = {
	id: string;
	client_id: string;
	rate: number;
	effective_from: string;
	effective_to: string | null;
	service_type: string | null;
};

export type ClientCardData = {
	id: string;
	name: string;
	billing_contact: string | null;
	address_line_1: string | null;
	address_line_2: string | null;
	email: string[];
	sort_rank: number | null;
	rates: ClientRateRow[];
	activeRate: ClientRateRow | null;
	invoiceCount: number;
	unbilledEntryCount: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number): string {
	return String(n).padStart(2, '0');
}

function todayYMD(): string {
	const d = new Date();
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isActiveOnDate(
	today: string,
	r: { effective_from: string; effective_to: string | null }
): boolean {
	if (r.effective_from > today) return false;
	if (r.effective_to != null && r.effective_to < today) return false;
	return true;
}

function normalizeEmailArray(v: unknown): string[] {
	if (!Array.isArray(v)) return [];
	return v.map((e) => String(e).trim()).filter((e) => e.length > 0);
}

function parseYMD(s: string): { ok: true; ymd: string } | { ok: false } {
	const m = YMD_RE.exec(s);
	if (!m) return { ok: false };
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const day = Number(m[3]);
	const d = new Date(y, mo - 1, day);
	if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return { ok: false };
	return { ok: true, ymd: s };
}

function dayBefore(ymd: string): string {
	const m = YMD_RE.exec(ymd);
	if (!m) return ymd;
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	d.setDate(d.getDate() - 1);
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseRate(raw: FormDataEntryValue | null): number | null {
	if (raw == null) return null;
	const n = Number(String(raw).replace(',', '.'));
	if (!Number.isFinite(n) || n <= 0 || n > 99999.99) return null;
	return Math.round(n * 100) / 100;
}

function readEmailArray(fd: FormData, key: string): string[] {
	const raw = fd.getAll(key);
	const out: string[] = [];
	for (const v of raw) {
		const t = String(v ?? '').trim();
		if (!t) continue;
		out.push(t);
	}
	return out;
}

function validateEmails(list: string[]): string | null {
	for (const addr of list) {
		if (!EMAIL_RE.test(addr)) return `Invalid email: ${addr}`;
	}
	return null;
}

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;
	const today = todayYMD();

	const [profileRes, clientsRes, ratesRes, invoicesRes, entriesRes] = await Promise.all([
		supabase.from('profiles').select('default_cc_emails').eq('id', user.id).maybeSingle(),
		supabase
			.from('clients')
			.select('id, name, billing_contact, address_line_1, address_line_2, email, sort_rank')
			.is('deleted_at', null)
			.order('sort_rank', { ascending: true, nullsFirst: false })
			.order('name', { ascending: true }),
		supabase
			.from('client_rates')
			.select('id, client_id, rate, effective_from, effective_to, service_type')
			.is('deleted_at', null)
			.order('effective_from', { ascending: false }),
		supabase.from('invoices').select('client_id').is('deleted_at', null),
		supabase
			.from('time_entries')
			.select('client_id')
			.is('deleted_at', null)
			.is('invoice_id', null)
	]);

	if (profileRes.error) console.error(profileRes.error);
	if (clientsRes.error) console.error(clientsRes.error);
	if (ratesRes.error) console.error(ratesRes.error);
	if (invoicesRes.error) console.error(invoicesRes.error);
	if (entriesRes.error) console.error(entriesRes.error);

	const defaultCcRaw = (profileRes.data as { default_cc_emails?: string[] } | null)?.default_cc_emails;
	const defaultCcEmails = Array.isArray(defaultCcRaw)
		? defaultCcRaw.map((e) => String(e).trim()).filter((e) => e.length > 0)
		: [];

	const ratesByClient = new Map<string, ClientRateRow[]>();
	for (const raw of ratesRes.data ?? []) {
		const r = raw as Record<string, unknown>;
		const cid = r.client_id as string;
		const row: ClientRateRow = {
			id: r.id as string,
			client_id: cid,
			rate: Number(r.rate),
			effective_from: r.effective_from as string,
			effective_to: (r.effective_to as string | null) ?? null,
			service_type: (r.service_type as string | null) ?? null
		};
		const list = ratesByClient.get(cid) ?? [];
		list.push(row);
		ratesByClient.set(cid, list);
	}

	const invoiceCounts = new Map<string, number>();
	for (const row of invoicesRes.data ?? []) {
		const cid = (row as { client_id: string }).client_id;
		invoiceCounts.set(cid, (invoiceCounts.get(cid) ?? 0) + 1);
	}

	const entryCounts = new Map<string, number>();
	for (const row of entriesRes.data ?? []) {
		const cid = (row as { client_id: string }).client_id;
		entryCounts.set(cid, (entryCounts.get(cid) ?? 0) + 1);
	}

	const clients: ClientCardData[] = (clientsRes.data ?? []).map((c) => {
		const id = c.id as string;
		const rates = ratesByClient.get(id) ?? [];
		const activeCandidates = rates.filter((r) => isActiveOnDate(today, r));
		const activeRate =
			activeCandidates.length > 0
				? activeCandidates.reduce((best, r) => (r.effective_from > best.effective_from ? r : best))
				: null;

		const rawRank = (c as { sort_rank?: unknown }).sort_rank;
		const sort_rank =
			typeof rawRank === 'number' && Number.isFinite(rawRank) ? Math.trunc(rawRank) : null;

		return {
			id,
			name: c.name as string,
			billing_contact: (c.billing_contact as string | null) ?? null,
			address_line_1: (c.address_line_1 as string | null) ?? null,
			address_line_2: (c.address_line_2 as string | null) ?? null,
			email: normalizeEmailArray(c.email),
			sort_rank,
			rates,
			activeRate,
			invoiceCount: invoiceCounts.get(id) ?? 0,
			unbilledEntryCount: entryCounts.get(id) ?? 0
		};
	});

	return {
		defaultCcEmails,
		clients,
		loadError:
			clientsRes.error || ratesRes.error
				? 'Some invoicing data could not be loaded.'
				: (null as string | null)
	};
};

type ClientFormFields = {
	name: string;
	billing_contact: string | null;
	address_line_1: string | null;
	address_line_2: string | null;
	email: string[];
	sort_rank: number | null;
};

function readClientFields(fd: FormData): { ok: true; fields: ClientFormFields } | { ok: false; message: string } {
	const name = String(fd.get('name') ?? '').trim();
	if (!name) return { ok: false, message: 'Client name is required.' };
	if (name.length > 200) return { ok: false, message: 'Client name is too long.' };

	const trimOrNull = (key: string): string | null => {
		const t = String(fd.get(key) ?? '').trim();
		return t.length > 0 ? t : null;
	};

	const email = readEmailArray(fd, 'email');
	const emailErr = validateEmails(email);
	if (emailErr) return { ok: false, message: emailErr };

	const sortRankRaw = String(fd.get('sort_rank') ?? '').trim();
	let sort_rank: number | null = null;
	if (sortRankRaw.length > 0) {
		const n = Number(sortRankRaw);
		if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 9999) {
			return {
				ok: false,
				message: 'Sort priority must be a whole number between 0 and 9999.'
			};
		}
		sort_rank = n;
	}

	return {
		ok: true,
		fields: {
			name,
			billing_contact: trimOrNull('billing_contact'),
			address_line_1: trimOrNull('address_line_1'),
			address_line_2: trimOrNull('address_line_2'),
			email,
			sort_rank
		}
	};
}

export const actions: Actions = {
	updateDefaultCc: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'defaultCc', message: 'Unauthorized' });

		const fd = await request.formData();
		const list = readEmailArray(fd, 'default_cc_emails');
		const err = validateEmails(list);
		if (err) return fail(400, { kind: 'defaultCc', message: err });

		const { error } = await locals.supabase
			.from('profiles')
			.update({ default_cc_emails: list })
			.eq('id', user.id);

		if (error) {
			console.error(error);
			return fail(500, {
				kind: 'defaultCc',
				message: error.message ?? 'Could not save default CC emails.'
			});
		}

		return { kind: 'defaultCc', success: true as const };
	},

	createClient: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createClient', message: 'Unauthorized' });

		const fd = await request.formData();
		const parsed = readClientFields(fd);
		if (!parsed.ok) return fail(400, { kind: 'createClient', message: parsed.message });

		const { data: dup, error: dupErr } = await locals.supabase
			.from('clients')
			.select('id')
			.is('deleted_at', null)
			.ilike('name', parsed.fields.name)
			.maybeSingle();
		if (dupErr) console.error(dupErr);
		if (dup) {
			return fail(400, {
				kind: 'createClient',
				message: 'A client with that name already exists.'
			});
		}

		const { error } = await locals.supabase.from('clients').insert({
			...parsed.fields,
			created_by: user.id
		});

		if (error) {
			console.error(error);
			return fail(500, {
				kind: 'createClient',
				message: error.message ?? 'Could not create client.'
			});
		}

		return { kind: 'createClient', success: true as const };
	},

	updateClient: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateClient', message: 'Unauthorized' });

		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { kind: 'updateClient', message: 'Missing client id.' });

		const parsed = readClientFields(fd);
		if (!parsed.ok)
			return fail(400, { kind: 'updateClient', clientId: id, message: parsed.message });

		const { data: existing, error: fetchErr } = await locals.supabase
			.from('clients')
			.select('id')
			.eq('id', id)
			.is('deleted_at', null)
			.maybeSingle();

		if (fetchErr || !existing) {
			return fail(404, { kind: 'updateClient', clientId: id, message: 'Client not found.' });
		}

		const { error } = await locals.supabase.from('clients').update(parsed.fields).eq('id', id);

		if (error) {
			console.error(error);
			return fail(500, {
				kind: 'updateClient',
				clientId: id,
				message: error.message ?? 'Could not update client.'
			});
		}

		return { kind: 'updateClient', clientId: id, success: true as const };
	},

	deleteClient: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'deleteClient', message: 'Unauthorized' });

		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		const confirmHard = String(fd.get('confirm') ?? '') === 'hard';
		if (!id) return fail(400, { kind: 'deleteClient', message: 'Missing client id.' });

		const { count: invCount, error: invErr } = await locals.supabase
			.from('invoices')
			.select('id', { count: 'exact', head: true })
			.eq('client_id', id)
			.is('deleted_at', null);

		if (invErr) {
			console.error(invErr);
			return fail(500, { kind: 'deleteClient', clientId: id, message: invErr.message });
		}
		if ((invCount ?? 0) > 0) {
			return fail(400, {
				kind: 'deleteClient',
				clientId: id,
				message: `Client has ${invCount} invoice(s). Discard or move them before deleting the client.`
			});
		}

		const { count: entryCount, error: entryErr } = await locals.supabase
			.from('time_entries')
			.select('id', { count: 'exact', head: true })
			.eq('client_id', id)
			.is('deleted_at', null);

		if (entryErr) {
			console.error(entryErr);
			return fail(500, { kind: 'deleteClient', clientId: id, message: entryErr.message });
		}

		if ((entryCount ?? 0) > 0 && !confirmHard) {
			return fail(409, {
				kind: 'deleteClient',
				clientId: id,
				needsConfirm: true as const,
				entryCount: entryCount ?? 0,
				message: `Client has ${entryCount} unbilled time entr${(entryCount ?? 0) === 1 ? 'y' : 'ies'}. Confirm to soft-delete the client (entries stay attached and become unselectable for new invoices).`
			});
		}

		const { error } = await locals.supabase
			.from('clients')
			.update({ deleted_at: new Date().toISOString() })
			.eq('id', id);

		if (error) {
			console.error(error);
			return fail(500, {
				kind: 'deleteClient',
				clientId: id,
				message: error.message ?? 'Could not delete client.'
			});
		}

		return { kind: 'deleteClient', clientId: id, success: true as const };
	},

	createRate: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createRate', message: 'Unauthorized' });

		const fd = await request.formData();
		const client_id = String(fd.get('client_id') ?? '').trim();
		if (!client_id) return fail(400, { kind: 'createRate', message: 'Missing client id.' });

		const dateRes = parseYMD(String(fd.get('effective_from') ?? '').trim());
		if (!dateRes.ok)
			return fail(400, { kind: 'createRate', clientId: client_id, message: 'Invalid effective date.' });

		const rate = parseRate(fd.get('rate'));
		if (rate == null)
			return fail(400, { kind: 'createRate', clientId: client_id, message: 'Enter a valid positive rate.' });

		const serviceTypeRaw = String(fd.get('service_type') ?? '').trim();
		const service_type = serviceTypeRaw.length > 0 ? serviceTypeRaw : null;

		// Find prior + future rows for same (client_id, service_type)
		const supabase = locals.supabase;
		let q = supabase
			.from('client_rates')
			.select('id, effective_from, effective_to, service_type')
			.eq('client_id', client_id)
			.is('deleted_at', null);
		q = service_type == null ? q.is('service_type', null) : q.eq('service_type', service_type);
		const { data: existing, error: existErr } = await q;
		if (existErr) {
			console.error(existErr);
			return fail(500, { kind: 'createRate', clientId: client_id, message: existErr.message });
		}

		// Block any future row at or after the new effective_from for this service_type
		const future = (existing ?? []).find(
			(r) => (r.effective_from as string) >= dateRes.ymd
		);
		if (future) {
			return fail(400, {
				kind: 'createRate',
				clientId: client_id,
				message: `A future rate already exists starting ${future.effective_from}. Edit or delete it first.`
			});
		}

		// Find the prior row to close (latest effective_from < new date, no end or end >= new date)
		const prior = (existing ?? [])
			.filter((r) => (r.effective_from as string) < dateRes.ymd)
			.filter((r) => r.effective_to == null || (r.effective_to as string) >= dateRes.ymd)
			.sort((a, b) => ((a.effective_from as string) > (b.effective_from as string) ? -1 : 1))[0];

		if (prior) {
			const { error: updErr } = await supabase
				.from('client_rates')
				.update({ effective_to: dayBefore(dateRes.ymd) })
				.eq('id', prior.id as string);
			if (updErr) {
				console.error(updErr);
				return fail(500, {
					kind: 'createRate',
					clientId: client_id,
					message: `Could not close prior rate: ${updErr.message ?? 'unknown error'}`
				});
			}
		}

		const { error: insErr } = await supabase.from('client_rates').insert({
			client_id,
			rate,
			service_type,
			effective_from: dateRes.ymd,
			effective_to: null,
			created_by: user.id
		});

		if (insErr) {
			console.error(insErr);
			return fail(500, {
				kind: 'createRate',
				clientId: client_id,
				message: insErr.message ?? 'Could not create rate.'
			});
		}

		return { kind: 'createRate', clientId: client_id, success: true as const };
	},

	updateRate: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'updateRate', message: 'Unauthorized' });

		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		const client_id = String(fd.get('client_id') ?? '').trim();
		if (!id || !client_id)
			return fail(400, { kind: 'updateRate', message: 'Missing rate or client id.' });

		const fromRes = parseYMD(String(fd.get('effective_from') ?? '').trim());
		if (!fromRes.ok)
			return fail(400, {
				kind: 'updateRate',
				clientId: client_id,
				rateId: id,
				message: 'Invalid effective from date.'
			});

		const effectiveToRaw = String(fd.get('effective_to') ?? '').trim();
		let effective_to: string | null = null;
		if (effectiveToRaw.length > 0) {
			const toRes = parseYMD(effectiveToRaw);
			if (!toRes.ok)
				return fail(400, {
					kind: 'updateRate',
					clientId: client_id,
					rateId: id,
					message: 'Invalid effective to date.'
				});
			if (toRes.ymd < fromRes.ymd)
				return fail(400, {
					kind: 'updateRate',
					clientId: client_id,
					rateId: id,
					message: 'effective_to must be on or after effective_from.'
				});
			effective_to = toRes.ymd;
		}

		const rate = parseRate(fd.get('rate'));
		if (rate == null)
			return fail(400, {
				kind: 'updateRate',
				clientId: client_id,
				rateId: id,
				message: 'Enter a valid positive rate.'
			});

		const serviceTypeRaw = String(fd.get('service_type') ?? '').trim();
		const service_type = serviceTypeRaw.length > 0 ? serviceTypeRaw : null;

		const supabase = locals.supabase;
		// Overlap check: any other row for (client_id, service_type) whose range overlaps.
		let q = supabase
			.from('client_rates')
			.select('id, effective_from, effective_to')
			.eq('client_id', client_id)
			.is('deleted_at', null)
			.neq('id', id);
		q = service_type == null ? q.is('service_type', null) : q.eq('service_type', service_type);
		const { data: siblings, error: sibErr } = await q;
		if (sibErr) {
			console.error(sibErr);
			return fail(500, {
				kind: 'updateRate',
				clientId: client_id,
				rateId: id,
				message: sibErr.message
			});
		}

		const newEnd = effective_to ?? '9999-12-31';
		for (const s of siblings ?? []) {
			const sStart = s.effective_from as string;
			const sEnd = (s.effective_to as string | null) ?? '9999-12-31';
			if (sStart <= newEnd && sEnd >= fromRes.ymd) {
				return fail(400, {
					kind: 'updateRate',
					clientId: client_id,
					rateId: id,
					message: `Overlaps existing rate ${sStart} → ${s.effective_to ?? 'open'}.`
				});
			}
		}

		const { error } = await supabase
			.from('client_rates')
			.update({
				rate,
				service_type,
				effective_from: fromRes.ymd,
				effective_to
			})
			.eq('id', id);

		if (error) {
			console.error(error);
			return fail(500, {
				kind: 'updateRate',
				clientId: client_id,
				rateId: id,
				message: error.message ?? 'Could not update rate.'
			});
		}

		return { kind: 'updateRate', clientId: client_id, rateId: id, success: true as const };
	},

	deleteRate: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'deleteRate', message: 'Unauthorized' });

		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		const client_id = String(fd.get('client_id') ?? '').trim();
		if (!id) return fail(400, { kind: 'deleteRate', message: 'Missing rate id.' });

		const { error } = await locals.supabase
			.from('client_rates')
			.update({ deleted_at: new Date().toISOString() })
			.eq('id', id);

		if (error) {
			console.error(error);
			return fail(500, {
				kind: 'deleteRate',
				clientId: client_id,
				rateId: id,
				message: error.message ?? 'Could not delete rate.'
			});
		}

		return { kind: 'deleteRate', clientId: client_id, rateId: id, success: true as const };
	}
};

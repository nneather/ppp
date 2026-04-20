import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export type ClientRateRow = {
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
	rates: ClientRateRow[];
	activeRate: ClientRateRow | null;
};

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

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;
	const today = todayYMD();

	const [profileRes, clientsRes, ratesRes] = await Promise.all([
		supabase.from('profiles').select('default_cc_emails').eq('id', user.id).maybeSingle(),
		supabase
			.from('clients')
			.select('id, name, billing_contact, address_line_1, address_line_2, email')
			.is('deleted_at', null)
			.order('name', { ascending: true }),
		supabase
			.from('client_rates')
			.select('client_id, rate, effective_from, effective_to, service_type')
			.is('deleted_at', null)
			.order('effective_from', { ascending: false })
	]);

	if (profileRes.error) console.error(profileRes.error);
	if (clientsRes.error) console.error(clientsRes.error);
	if (ratesRes.error) console.error(ratesRes.error);

	const defaultCcRaw = (profileRes.data as { default_cc_emails?: string[] } | null)?.default_cc_emails;
	const defaultCcEmails = Array.isArray(defaultCcRaw)
		? defaultCcRaw.map((e) => String(e).trim()).filter((e) => e.length > 0)
		: [];

	const ratesByClient = new Map<string, ClientRateRow[]>();
	for (const raw of ratesRes.data ?? []) {
		const r = raw as Record<string, unknown>;
		const cid = r.client_id as string;
		const row: ClientRateRow = {
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

	const clients: ClientCardData[] = (clientsRes.data ?? []).map((c) => {
		const id = c.id as string;
		const rates = ratesByClient.get(id) ?? [];
		const activeCandidates = rates.filter((r) => isActiveOnDate(today, r));
		const activeRate =
			activeCandidates.length > 0
				? activeCandidates.reduce((best, r) => (r.effective_from > best.effective_from ? r : best))
				: null;

		return {
			id,
			name: c.name as string,
			billing_contact: (c.billing_contact as string | null) ?? null,
			address_line_1: (c.address_line_1 as string | null) ?? null,
			address_line_2: (c.address_line_2 as string | null) ?? null,
			email: normalizeEmailArray(c.email),
			rates,
			activeRate
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

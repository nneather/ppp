/**
 * Postcard screen — loader and form actions (server-only).
 * Route: /contacts/postcards/[listId]. Owner only (RLS also enforces it).
 */
import { error, fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatAddressOneLine } from '$lib/contacts/address-status';
import { householdEligibleForCardList } from '$lib/contacts/due';
import { isContactStatus } from '$lib/contacts/names';
import { buildBackHtml, isPostcardSize, type PostcardSize } from '$lib/contacts/postcard-artwork';
import {
	batchIdempotencyKey,
	defaultDesign,
	designProblems,
	householdToLobAddress,
	mailableHouseholds,
	recipientStatus,
	returnAddress,
	type HouseholdAddressRow,
	type LobAddressShape,
	type PostcardDesign,
	type PostcardRecipient
} from '$lib/contacts/postcards';
import {
	createLobPostcard,
	lobKey,
	lobKeysConfigured,
	type LobMode
} from '$lib/contacts/server/lob';
import { ymdInChicago } from '$lib/invoicing/chicago-date';

const BUCKET = 'postcard-artwork';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Live sends per request; the client loops until the selection is done.
 * Small so one request stays well inside the route's maxDuration even with
 * Lob retries (worst case per card ≈ 3 × 15s).
 */
export const BATCH_CHUNK = 2;
const MAX_PROOFS = 3;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const UPLOAD_TYPES: Record<string, string> = {
	'application/pdf': 'pdf',
	'image/png': 'png',
	'image/jpeg': 'jpg'
};

const DESIGN_COLS =
	'id, list_id, size, front_path, back_mode, back_message, back_path, return_name, return_line_1, return_line_2, return_city, return_state, return_zip, price_cents';
const HOUSEHOLD_COLS =
	'id, name, address_line_1, address_line_2, city, state, postal_code, address_updated_on';

function str(fd: FormData, key: string): string | null {
	const v = fd.get(key);
	if (v === null) return null;
	const t = String(v).trim();
	return t.length ? t : null;
}

export type PostcardSendRow = {
	id: string;
	household_id: string | null;
	recipient_name: string;
	kind: 'proof' | 'self' | 'batch';
	mode: LobMode;
	status: 'created' | 'failed';
	lob_url: string | null;
	error: string | null;
	sent_on: string;
	created_at: string;
};

async function requireOwner(supabase: SupabaseClient, userId: string): Promise<boolean> {
	const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
	return (data?.role as string | undefined) === 'owner';
}

/** Every action runs this before touching Storage, Lob keys, or rows. */
export async function assertOwner(supabase: SupabaseClient, userId: string, kind: string) {
	return (await requireOwner(supabase, userId))
		? null
		: fail(403, { kind, message: 'Owner only.' });
}

async function loadDesign(supabase: SupabaseClient, listId: string): Promise<PostcardDesign> {
	const { data, error: e } = await supabase
		.from('postcard_designs')
		.select(DESIGN_COLS)
		.eq('list_id', listId)
		.is('deleted_at', null)
		.maybeSingle();
	if (e) console.error('[postcards] design', e);
	if (!data) return defaultDesign(listId);
	const d = data as PostcardDesign;
	return { ...d, size: isPostcardSize(d.size) ? d.size : '5x7' };
}

async function listHouseholdIds(supabase: SupabaseClient, listId: string): Promise<string[]> {
	const { data, error: e } = await supabase
		.from('contact_list_members')
		.select('household_id')
		.eq('list_id', listId)
		.is('deleted_at', null)
		.not('household_id', 'is', null);
	if (e) throw new Error(e.message);
	return [...new Set(((data ?? []) as { household_id: string }[]).map((r) => r.household_id))];
}

async function loadHouseholdRows(
	supabase: SupabaseClient,
	ids: string[]
): Promise<HouseholdAddressRow[]> {
	if (!ids.length) return [];
	const { data, error: e } = await supabase
		.from('households')
		.select(HOUSEHOLD_COLS)
		.in('id', ids)
		.is('deleted_at', null);
	if (e) throw new Error(e.message);
	return (data ?? []) as HouseholdAddressRow[];
}

/**
 * Households reserved or mailed from this list. `pending` = reserved before the
 * Lob call and never resolved (function died mid-send): it keeps blocking, and
 * the screen flags it for a manual check in the Lob dashboard.
 */
async function batchStatusByHousehold(
	supabase: SupabaseClient,
	listId: string
): Promise<Map<string, 'pending' | 'created'>> {
	const { data, error: e } = await supabase
		.from('postcard_sends')
		.select('household_id, status')
		.eq('list_id', listId)
		.eq('kind', 'batch')
		.in('status', ['pending', 'created'])
		.is('deleted_at', null);
	if (e) throw new Error(e.message);
	return new Map(
		((data ?? []) as { household_id: string; status: 'pending' | 'created' }[]).map((r) => [
			r.household_id,
			r.status
		])
	);
}

async function signed(supabase: SupabaseClient, path: string | null, seconds: number) {
	if (!path) return null;
	const { data, error: e } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
	if (e) {
		console.error('[postcards] sign', e);
		return null;
	}
	return data.signedUrl;
}

export async function loadPostcardPage(supabase: SupabaseClient, userId: string, listId: string) {
	if (!UUID_RE.test(listId)) error(404, 'List not found');
	if (!(await requireOwner(supabase, userId))) error(403, 'Owner only');

	const { data: list } = await supabase
		.from('contact_lists')
		.select('id, name')
		.eq('id', listId)
		.is('deleted_at', null)
		.maybeSingle();
	if (!list) error(404, 'List not found');

	const todayYmd = ymdInChicago();
	const [design, householdIds, sent, sendsRes] = await Promise.all([
		loadDesign(supabase, listId),
		listHouseholdIds(supabase, listId),
		batchStatusByHousehold(supabase, listId),
		supabase
			.from('postcard_sends')
			.select(
				'id, household_id, recipient_name, kind, mode, status, lob_url, error, sent_on, created_at'
			)
			.eq('list_id', listId)
			.is('deleted_at', null)
			.order('created_at', { ascending: false })
			.limit(300)
	]);
	const households = await loadHouseholdRows(supabase, householdIds);

	const recipients: PostcardRecipient[] = households
		.map((h) => ({
			householdId: h.id,
			label: h.name,
			address: formatAddressOneLine(h),
			status: recipientStatus(h, todayYmd),
			sent: sent.has(h.id),
			pending: sent.get(h.id) === 'pending'
		}))
		.sort((a, b) => a.label.localeCompare(b.label));

	const [frontUrl, backUrl] = await Promise.all([
		signed(supabase, design.front_path, 3600),
		signed(supabase, design.back_path, 3600)
	]);

	return {
		list: list as { id: string; name: string },
		design,
		frontUrl,
		backUrl,
		recipients,
		sends: (sendsRes.data ?? []) as PostcardSendRow[],
		keys: lobKeysConfigured(),
		problems: designProblems(design),
		chunkSize: BATCH_CHUNK,
		todayYmd
	};
}

/* ── Actions ──────────────────────────────────────────────────────────── */

async function upsertDesign(
	supabase: SupabaseClient,
	userId: string,
	listId: string,
	patch: Partial<PostcardDesign>
): Promise<string | null> {
	const { data: existing } = await supabase
		.from('postcard_designs')
		.select('id')
		.eq('list_id', listId)
		.is('deleted_at', null)
		.maybeSingle();
	const res = existing
		? await supabase
				.from('postcard_designs')
				.update(patch as never)
				.eq('id', (existing as { id: string }).id)
		: await supabase
				.from('postcard_designs')
				.insert({ list_id: listId, created_by: userId, ...patch } as never);
	return res.error ? res.error.message : null;
}

export async function saveDesignAction(
	supabase: SupabaseClient,
	userId: string,
	listId: string,
	fd: FormData
) {
	const kind = 'saveDesign' as const;
	const size = str(fd, 'size') ?? '5x7';
	if (!isPostcardSize(size)) return fail(400, { kind, message: 'Pick a card size.' });
	const backMode = str(fd, 'back_mode') === 'upload' ? 'upload' : 'message';
	const priceRaw = str(fd, 'price');
	let price_cents: number | null = null;
	if (priceRaw) {
		const n = Number(priceRaw.replace(/[$,\s]/g, ''));
		if (!Number.isFinite(n) || n < 0)
			return fail(400, { kind, message: 'Price must be a number.' });
		price_cents = Math.round(n * 100);
	}
	const message = String(fd.get('back_message') ?? '');
	const err = await upsertDesign(supabase, userId, listId, {
		size: size as PostcardSize,
		back_mode: backMode,
		back_message: message,
		return_name: str(fd, 'return_name'),
		return_line_1: str(fd, 'return_line_1'),
		return_line_2: str(fd, 'return_line_2'),
		return_city: str(fd, 'return_city'),
		return_state: str(fd, 'return_state')?.toUpperCase() ?? null,
		return_zip: str(fd, 'return_zip'),
		price_cents
	});
	if (err) return fail(500, { kind, message: err });
	return { kind, success: true as const };
}

export async function uploadArtworkAction(
	supabase: SupabaseClient,
	userId: string,
	listId: string,
	fd: FormData
) {
	const kind = 'uploadArtwork' as const;
	const side = str(fd, 'side') === 'back' ? 'back' : 'front';
	const file = fd.get('file');
	if (!(file instanceof File) || file.size === 0)
		return fail(400, { kind, message: 'Choose a file.' });
	const ext = UPLOAD_TYPES[file.type];
	if (!ext) return fail(400, { kind, message: 'Use a PDF, PNG, or JPG.' });
	if (file.size > MAX_UPLOAD_BYTES) return fail(400, { kind, message: 'Max file size is 20 MB.' });

	const path = `${userId}/${listId}/${side}-${crypto.randomUUID()}.${ext}`;
	const { error: upErr } = await supabase.storage
		.from(BUCKET)
		.upload(path, file, { contentType: file.type, upsert: false });
	if (upErr) return fail(500, { kind, message: upErr.message });

	const err = await upsertDesign(
		supabase,
		userId,
		listId,
		side === 'front' ? { front_path: path } : { back_path: path, back_mode: 'upload' }
	);
	if (err) return fail(500, { kind, message: err });
	return { kind, success: true as const, side };
}

/** front/back strings for Lob. Signed URLs live 24h so Lob can fetch them. */
async function lobArtwork(
	supabase: SupabaseClient,
	design: PostcardDesign
): Promise<{ front: string; back: string } | { error: string }> {
	const problems = designProblems(design);
	if (problems.length) return { error: problems.join(' ') };
	const front = await signed(supabase, design.front_path, 86_400);
	if (!front) return { error: 'Could not sign the front artwork URL.' };
	if (design.back_mode === 'message') {
		return { front, back: buildBackHtml(design.back_message, design.size) };
	}
	const back = await signed(supabase, design.back_path, 86_400);
	if (!back) return { error: 'Could not sign the back artwork URL.' };
	return { front, back };
}

async function recordSend(
	supabase: SupabaseClient,
	row: {
		list_id: string;
		household_id: string | null;
		recipient_name: string;
		address_snapshot: LobAddressShape;
		kind: 'proof' | 'self' | 'batch';
		mode: LobMode;
		size: PostcardSize;
		status: 'created' | 'failed';
		lob_id?: string | null;
		lob_url?: string | null;
		error?: string | null;
		created_by: string;
	}
) {
	const { error: e } = await supabase
		.from('postcard_sends')
		.insert({ ...row, sent_on: ymdInChicago() } as never);
	// 23505 = unique violation: the household was already recorded as mailed.
	if (e && e.code !== '23505') console.error('[postcards] record send', e);
	return e;
}

function description(listName: string, todayYmd: string) {
	return `${listName} ${todayYmd.slice(0, 4)}`.slice(0, 255);
}

async function listContext(supabase: SupabaseClient, listId: string) {
	const { data: list } = await supabase
		.from('contact_lists')
		.select('id, name')
		.eq('id', listId)
		.is('deleted_at', null)
		.maybeSingle();
	return list as { id: string; name: string } | null;
}

/** Test-key proofs for up to 3 households: Lob renders a PDF and mails nothing. */
export async function sendProofsAction(
	supabase: SupabaseClient,
	userId: string,
	listId: string,
	fd: FormData
) {
	const kind = 'sendProofs' as const;
	const keyRes = lobKey('test');
	if ('error' in keyRes) return fail(400, { kind, message: keyRes.error });
	const list = await listContext(supabase, listId);
	if (!list) return fail(404, { kind, message: 'List not found.' });
	const design = await loadDesign(supabase, listId);
	const art = await lobArtwork(supabase, design);
	if ('error' in art) return fail(400, { kind, message: art.error });

	const requested = fd
		.getAll('household_id')
		.map(String)
		.filter((id) => UUID_RE.test(id));
	const onList = new Set(await listHouseholdIds(supabase, listId));
	const households = mailableHouseholds(
		requested,
		await loadHouseholdRows(supabase, requested),
		onList,
		new Set()
	).slice(0, MAX_PROOFS);
	if (!households.length)
		return fail(400, { kind, message: 'Select at least one household with a full address.' });

	const from = returnAddress(design);
	const todayYmd = ymdInChicago();
	let made = 0;
	for (const h of households) {
		const to = householdToLobAddress(h)!;
		const res = await createLobPostcard(
			keyRes.key,
			{
				to,
				...(from ? { from } : {}),
				...art,
				size: design.size,
				description: `${description(list.name, todayYmd)} proof`,
				use_type: 'operational'
			},
			`ppp-proof:${crypto.randomUUID()}`
		);
		await recordSend(supabase, {
			list_id: listId,
			household_id: h.id,
			recipient_name: h.name,
			address_snapshot: to,
			kind: 'proof',
			mode: 'test',
			size: design.size,
			status: res.ok ? 'created' : 'failed',
			lob_id: res.ok ? res.id : null,
			lob_url: res.ok ? res.url : null,
			error: res.ok ? null : res.error,
			created_by: userId
		});
		if (!res.ok) return fail(502, { kind, message: `Lob: ${res.error}` });
		made += 1;
	}
	return { kind, success: true as const, count: made };
}

/** One live card to the return address. */
export async function sendSelfAction(supabase: SupabaseClient, userId: string, listId: string) {
	const kind = 'sendSelf' as const;
	const keyRes = lobKey('live');
	if ('error' in keyRes) return fail(400, { kind, message: keyRes.error });
	const list = await listContext(supabase, listId);
	if (!list) return fail(404, { kind, message: 'List not found.' });
	const design = await loadDesign(supabase, listId);
	const to = returnAddress(design);
	if (!to)
		return fail(400, {
			kind,
			message: 'Fill in the full return address first; the test card goes there.'
		});
	const art = await lobArtwork(supabase, design);
	if ('error' in art) return fail(400, { kind, message: art.error });

	const todayYmd = ymdInChicago();
	const res = await createLobPostcard(
		keyRes.key,
		{
			to,
			from: to,
			...art,
			size: design.size,
			description: `${description(list.name, todayYmd)} self`,
			use_type: 'operational'
		},
		// Fresh key per click: a re-send after editing the artwork must not
		// replay the earlier card. The button disables while submitting.
		`ppp-self:${crypto.randomUUID()}`
	);
	await recordSend(supabase, {
		list_id: listId,
		household_id: null,
		recipient_name: to.name,
		address_snapshot: to,
		kind: 'self',
		mode: 'live',
		size: design.size,
		status: res.ok ? 'created' : 'failed',
		lob_id: res.ok ? res.id : null,
		lob_url: res.ok ? res.url : null,
		error: res.ok ? null : res.error,
		created_by: userId
	});
	if (!res.ok) return fail(502, { kind, message: `Lob: ${res.error}` });
	return { kind, success: true as const };
}

/**
 * Live batch, one chunk (≤ BATCH_CHUNK households). Skips anything already
 * mailed from this list, stops on the first Lob error, and logs a `card` touch
 * for each mailed household's live members.
 */
export async function sendBatchAction(
	supabase: SupabaseClient,
	userId: string,
	listId: string,
	fd: FormData
) {
	const kind = 'sendBatch' as const;
	if (str(fd, 'confirm') !== 'send') return fail(400, { kind, message: 'Send not confirmed.' });
	const keyRes = lobKey('live');
	if ('error' in keyRes) return fail(400, { kind, message: keyRes.error });
	const list = await listContext(supabase, listId);
	if (!list) return fail(404, { kind, message: 'List not found.' });
	const design = await loadDesign(supabase, listId);
	const art = await lobArtwork(supabase, design);
	if ('error' in art) return fail(400, { kind, message: art.error });

	const requested = fd
		.getAll('household_id')
		.map(String)
		.filter((id) => UUID_RE.test(id))
		.slice(0, BATCH_CHUNK);
	const [onListIds, alreadySent, rows] = await Promise.all([
		listHouseholdIds(supabase, listId),
		batchStatusByHousehold(supabase, listId),
		loadHouseholdRows(supabase, requested)
	]);
	const households = mailableHouseholds(
		requested,
		rows,
		new Set(onListIds),
		new Set(alreadySent.keys())
	).filter((h) => recipientStatus(h, ymdInChicago()) === 'confirmed'); // decided 2026-11-24: confirmed this year only

	const from = returnAddress(design);
	const todayYmd = ymdInChicago();
	let mailed = 0;
	let attempted = 0;
	let failure: string | null = null;
	for (const h of households) {
		attempted += 1;
		const to = householdToLobAddress(h)!;
		// 1. Reserve. The partial unique index (pending|created) makes this the
		//    never-twice guard: a second tab, a retried POST, or a re-run all
		//    hit 23505 here and skip, before any money is spent.
		const { data: reserved, error: resErr } = await supabase
			.from('postcard_sends')
			.insert({
				list_id: listId,
				household_id: h.id,
				recipient_name: h.name,
				address_snapshot: to,
				kind: 'batch',
				mode: 'live',
				size: design.size,
				status: 'pending',
				sent_on: todayYmd,
				created_by: userId
			} as never)
			.select('id')
			.single();
		if (resErr?.code === '23505') continue;
		if (resErr || !reserved) {
			failure = `${h.name}: could not reserve (${resErr?.message ?? 'no row'})`;
			break;
		}
		const sendId = (reserved as { id: string }).id;

		// 2. Mail. The key is per reservation row, so a corrected address after
		//    a failure gets a fresh request rather than Lob's cached response.
		const res = await createLobPostcard(
			keyRes.key,
			{
				to,
				...(from ? { from } : {}),
				...art,
				size: design.size,
				description: description(list.name, todayYmd),
				use_type: 'operational'
			},
			batchIdempotencyKey(sendId)
		);

		// 3. Resolve. If this update fails the row stays `pending` and keeps
		//    blocking — safer than a second card. The screen flags it.
		const { error: updErr } = await supabase
			.from('postcard_sends')
			.update({
				status: res.ok ? 'created' : 'failed',
				lob_id: res.ok ? res.id : null,
				lob_url: res.ok ? res.url : null,
				error: res.ok ? null : res.error
			} as never)
			.eq('id', sendId);
		if (!res.ok) {
			failure = `${h.name}: ${res.error}`;
			break;
		}
		if (updErr) {
			failure = `${h.name}: mailed, but the record didn't save (${updErr.message}). It's marked pending; check Lob before resending.`;
			break;
		}
		mailed += 1;
	}

	// Touches for every household mailed from this list, deduped — so a touch
	// that failed on an earlier chunk is filled in now.
	const touchErr = await logCardTouchesForList(supabase, userId, listId, todayYmd);

	return {
		kind,
		success: failure === null,
		mailed,
		skipped: requested.length - attempted,
		message: failure
			? `Stopped. ${failure}`
			: touchErr
				? `Mailed, but card touches failed: ${touchErr}`
				: null
	};
}

const TOUCH_NOTE = 'Christmas postcard (Lob)';

/**
 * `card` touch (no due-date effect) for each live member of every household
 * mailed from this list. Skips contacts that already carry this note this
 * year, so it is safe to run after every chunk and repairs earlier misses.
 */
async function logCardTouchesForList(
	supabase: SupabaseClient,
	userId: string,
	listId: string,
	touched_on: string
): Promise<string | null> {
	const { data: sentRows, error: sentErr } = await supabase
		.from('postcard_sends')
		.select('household_id')
		.eq('list_id', listId)
		.eq('kind', 'batch')
		.eq('status', 'created')
		.is('deleted_at', null);
	if (sentErr) return sentErr.message;
	const householdIds = [
		...new Set(((sentRows ?? []) as { household_id: string }[]).map((r) => r.household_id))
	];
	if (!householdIds.length) return null;
	const { data, error: e } = await supabase
		.from('contacts')
		.select('id, household_id, status')
		.in('household_id', householdIds)
		.is('deleted_at', null);
	if (e) return e.message;
	const live = new Map<string, { id: string; status: 'active' | 'retired' }[]>();
	for (const c of (data ?? []) as { id: string; household_id: string; status: string }[]) {
		if (!isContactStatus(c.status)) continue;
		live.set(c.household_id, [...(live.get(c.household_id) ?? []), { id: c.id, status: c.status }]);
	}
	const allIds = [...live.values()].flat().map((m) => m.id);
	const { data: existing, error: exErr } = allIds.length
		? await supabase
				.from('contact_touches')
				.select('contact_id')
				.in('contact_id', allIds)
				.eq('kind', 'card')
				.eq('note', TOUCH_NOTE)
				.gte('touched_on', `${touched_on.slice(0, 4)}-01-01`)
				.is('deleted_at', null)
		: { data: [], error: null };
	if (exErr) return exErr.message;
	const already = new Set(((existing ?? []) as { contact_id: string }[]).map((r) => r.contact_id));
	const rows = householdIds.flatMap((hid) => {
		const members = live.get(hid) ?? [];
		if (!householdEligibleForCardList({ liveMembers: members })) return [];
		return members
			.filter((m) => !already.has(m.id))
			.map((m) => ({
				contact_id: m.id,
				touched_on,
				note: TOUCH_NOTE,
				kind: 'card' as const,
				created_by: userId
			}));
	});
	if (!rows.length) return null;
	const { error: insErr } = await supabase.from('contact_touches').insert(rows as never);
	return insErr ? insErr.message : null;
}

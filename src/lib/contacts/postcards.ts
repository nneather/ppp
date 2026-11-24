/**
 * Pure helpers for the postcard screen (no I/O) — address mapping, the Lob
 * request shape, and which households a batch may mail.
 */
import { addressIsComplete, addressStatus, type AddressStatus } from '$lib/contacts/address-status';
import {
	buildBackHtml,
	LOB_HTML_MAX_CHARS,
	type PostcardSize
} from '$lib/contacts/postcard-artwork';

export type PostcardDesign = {
	id: string | null;
	list_id: string;
	size: PostcardSize;
	front_path: string | null;
	back_mode: 'message' | 'upload';
	back_message: string;
	back_path: string | null;
	return_name: string | null;
	return_line_1: string | null;
	return_line_2: string | null;
	return_city: string | null;
	return_state: string | null;
	return_zip: string | null;
	price_cents: number | null;
};

export function defaultDesign(listId: string): PostcardDesign {
	return {
		id: null,
		list_id: listId,
		size: '5x7',
		front_path: null,
		back_mode: 'message',
		back_message: '',
		back_path: null,
		return_name: null,
		return_line_1: null,
		return_line_2: null,
		return_city: null,
		return_state: null,
		return_zip: null,
		price_cents: null
	};
}

export type HouseholdAddressRow = {
	id: string;
	name: string;
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state: string | null;
	postal_code: string | null;
	address_updated_on: string | null;
};

export type LobAddressShape = {
	name: string;
	address_line1: string;
	address_line2?: string;
	address_city: string;
	address_state: string;
	address_zip: string;
	address_country: 'US';
};

/** Lob caps `name` at 40 characters. */
function lobName(name: string): string {
	return name.trim().slice(0, 40);
}

export function householdToLobAddress(h: HouseholdAddressRow): LobAddressShape | null {
	if (!addressIsComplete({ ...h })) return null;
	return {
		name: lobName(h.name),
		address_line1: h.address_line_1!.trim(),
		...(h.address_line_2?.trim() ? { address_line2: h.address_line_2.trim() } : {}),
		address_city: h.city!.trim(),
		address_state: h.state!.trim(),
		address_zip: h.postal_code!.trim(),
		address_country: 'US'
	};
}

export function returnAddress(d: PostcardDesign): LobAddressShape | null {
	if (!d.return_name?.trim()) return null;
	return householdToLobAddress({
		id: '',
		name: d.return_name,
		address_line_1: d.return_line_1,
		address_line_2: d.return_line_2,
		city: d.return_city,
		state: d.return_state,
		postal_code: d.return_zip,
		address_updated_on: null
	});
}

/** What's missing before anything can be sent ([] = ready). */
export function designProblems(d: PostcardDesign): string[] {
	const out: string[] = [];
	if (!d.front_path) out.push('Upload the front artwork.');
	if (d.back_mode === 'message' && !d.back_message.trim()) out.push('Write the back message.');
	if (d.back_mode === 'upload' && !d.back_path) out.push('Upload the back artwork.');
	if (
		d.back_mode === 'message' &&
		buildBackHtml(d.back_message, d.size).length > LOB_HTML_MAX_CHARS
	)
		out.push('The back message is too long for Lob (10,000-character limit).');
	return out;
}

export type PostcardRecipient = {
	householdId: string;
	label: string;
	address: string;
	status: AddressStatus;
	/** Already mailed (or reserved) live from this list. */
	sent: boolean;
	/** Reserved but the Lob result was never recorded — check the Lob dashboard. */
	pending?: boolean;
};

/** Default selection: confirmed this year and not already mailed. */
export function defaultSelected(rows: PostcardRecipient[]): string[] {
	return rows.filter((r) => r.status === 'confirmed' && !r.sent).map((r) => r.householdId);
}

/**
 * The households a live batch request may actually mail: on the list, a full
 * address, and not already mailed. Order follows the request.
 */
export function mailableHouseholds(
	requestedIds: string[],
	households: HouseholdAddressRow[],
	onListIds: Set<string>,
	alreadySentIds: Set<string>
): HouseholdAddressRow[] {
	const byId = new Map(households.map((h) => [h.id, h]));
	const seen = new Set<string>();
	const out: HouseholdAddressRow[] = [];
	for (const id of requestedIds) {
		if (seen.has(id)) continue;
		seen.add(id);
		const h = byId.get(id);
		if (!h || !onListIds.has(id) || alreadySentIds.has(id)) continue;
		if (!householdToLobAddress(h)) continue;
		out.push(h);
	}
	return out;
}

export function recipientStatus(h: HouseholdAddressRow, todayYmd: string): AddressStatus {
	return addressStatus(h, todayYmd);
}

/**
 * Keyed to the reservation row (`postcard_sends.id`), so an HTTP retry of the
 * same attempt is de-duplicated by Lob, while a new attempt after a failure
 * (e.g. a corrected address) is a fresh request. The DB reservation is the
 * real never-twice guard.
 */
export function batchIdempotencyKey(sendRowId: string): string {
	return `ppp-postcard:${sendRowId}`;
}

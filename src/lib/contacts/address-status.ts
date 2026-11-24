/**
 * Mailing-address status for a household on a card list.
 *
 * - `confirmed`   full address AND `address_updated_on` falls in the current year
 *                 (set by editing the address, or by "Confirm" on the list).
 * - `unconfirmed` full address, but not checked this year.
 * - `none`        missing line 1, city, state, or postal code.
 *
 * The postcard screen sends only to `confirmed` households by default.
 */
export type AddressStatus = 'confirmed' | 'unconfirmed' | 'none';

export type AddressFields = {
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state: string | null;
	postal_code: string | null;
	address_updated_on: string | null;
};

export function addressIsComplete(h: AddressFields): boolean {
	return Boolean(
		h.address_line_1?.trim() && h.city?.trim() && h.state?.trim() && h.postal_code?.trim()
	);
}

export function addressStatus(h: AddressFields, todayYmd: string): AddressStatus {
	if (!addressIsComplete(h)) return 'none';
	const year = todayYmd.slice(0, 4);
	return h.address_updated_on?.startsWith(year) ? 'confirmed' : 'unconfirmed';
}

/** "123 Main St, Apt 4, Columbia, SC 29201" — empty string when nothing is set. */
export function formatAddressOneLine(h: AddressFields): string {
	const stateZip = [h.state, h.postal_code].filter((s) => s?.trim()).join(' ');
	return [h.address_line_1, h.address_line_2, h.city, stateZip]
		.map((s) => s?.trim())
		.filter(Boolean)
		.join(', ');
}

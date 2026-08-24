/**
 * Minimal vCard 3.0/4.0 parser for Mac Contacts export — birthday, email, phone, FN/N.
 */

export type VCardPerson = {
	fullName: string;
	first_name: string;
	last_name: string | null;
	email: string | null;
	phone: string | null;
	birthday: string | null; // YYYY-MM-DD
};

function unfold(text: string): string[] {
	const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const lines: string[] = [];
	for (const line of raw.split('\n')) {
		if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
			lines[lines.length - 1] += line.slice(1);
		} else {
			lines.push(line);
		}
	}
	return lines;
}

function parseBirthday(raw: string): string | null {
	const t = raw.trim().replace(/^VALUE=DATE:/i, '');
	// 19900315 or 1990-03-15 or --0315
	const iso = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t);
	if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
	return null;
}

function unescapeV(v: string): string {
	return v
		.replace(/\\n/gi, '\n')
		.replace(/\\,/g, ',')
		.replace(/\\;/g, ';')
		.replace(/\\\\/g, '\\');
}

export function parseVCardFile(text: string): VCardPerson[] {
	const lines = unfold(text);
	const out: VCardPerson[] = [];
	let inCard = false;
	let fn: string | null = null;
	let nFirst: string | null = null;
	let nLast: string | null = null;
	let email: string | null = null;
	let phone: string | null = null;
	let birthday: string | null = null;

	const flush = () => {
		const first = (nFirst ?? fn?.split(/\s+/)[0] ?? '').trim();
		if (!first && !fn) return;
		const last = nLast?.trim() || null;
		const full =
			fn?.trim() ||
			(last ? `${first} ${last}` : first);
		out.push({
			fullName: full,
			first_name: first || full,
			last_name: last,
			email,
			phone,
			birthday
		});
	};

	for (const line of lines) {
		if (line.toUpperCase() === 'BEGIN:VCARD') {
			inCard = true;
			fn = null;
			nFirst = null;
			nLast = null;
			email = null;
			phone = null;
			birthday = null;
			continue;
		}
		if (!inCard) continue;
		if (line.toUpperCase() === 'END:VCARD') {
			flush();
			inCard = false;
			continue;
		}
		const colon = line.indexOf(':');
		if (colon < 0) continue;
		const keyPart = line.slice(0, colon);
		const value = unescapeV(line.slice(colon + 1));
		const prop = keyPart.split(';')[0]!.toUpperCase();
		if (prop === 'FN') fn = value;
		else if (prop === 'N') {
			// Last;First;...
			const bits = value.split(';');
			nLast = bits[0]?.trim() || null;
			nFirst = bits[1]?.trim() || null;
		} else if (prop === 'EMAIL' && !email) email = value.trim() || null;
		else if ((prop === 'TEL' || prop === 'PHONE') && !phone) {
			phone = value.replace(/[^\d+]/g, '') || value.trim() || null;
		} else if (prop === 'BDAY' && !birthday) birthday = parseBirthday(value);
	}
	return out;
}

export type VCardMatch = {
	vcard: VCardPerson;
	contactId: string | null;
	contactDisplayName: string | null;
	score: number;
};

function norm(s: string): string {
	return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Match vCards to existing contacts by normalized name. Unmatched have contactId null. */
export function matchVCardsToContacts(
	vcards: readonly VCardPerson[],
	contacts: readonly {
		id: string;
		first_name: string;
		last_name: string | null;
		display_name: string;
	}[]
): VCardMatch[] {
	const byKey = new Map<string, { id: string; display_name: string }>();
	for (const c of contacts) {
		const key = norm(`${c.first_name}${c.last_name ?? ''}`);
		if (key) byKey.set(key, { id: c.id, display_name: c.display_name });
		byKey.set(norm(c.display_name), { id: c.id, display_name: c.display_name });
	}

	return vcards.map((v) => {
		const keys = [
			norm(`${v.first_name}${v.last_name ?? ''}`),
			norm(v.fullName)
		];
		for (const k of keys) {
			const hit = byKey.get(k);
			if (hit) {
				return {
					vcard: v,
					contactId: hit.id,
					contactDisplayName: hit.display_name,
					score: 1
				};
			}
		}
		return { vcard: v, contactId: null, contactDisplayName: null, score: 0 };
	});
}

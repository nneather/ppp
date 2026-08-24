/**
 * Parse Christmas Cards Sheet1 CSV / People-for-Things names for contacts import.
 * Couples: split on " and "; inherit last name when second token has none.
 */

import {
	FREQUENCY_FROM_SHEET,
	type ContactFrequency,
	type GivingGrade,
	type RelationshipGrade
} from '$lib/types/contacts';
import { isGivingGrade, isRelationshipGrade } from '$lib/contacts/names';

export type SheetPerson = {
	first_name: string;
	last_name: string | null;
};

export type Sheet1Row = {
	rawName: string;
	people: SheetPerson[];
	addressRaw: string | null;
	retired: boolean;
	group: string | null;
	giving: GivingGrade | null;
	relationship: RelationshipGrade | null;
	frequency: ContactFrequency;
};

export type ParsedAddress = {
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state: string | null;
	postal_code: string | null;
	country: string | null;
};

/** Split "Tanner and Crystal Erisman" / "Jonathan Shaheen and Sara". */
export function splitCoupleName(raw: string): SheetPerson[] {
	const name = raw.trim().replace(/\s+/g, ' ');
	if (!name) return [];
	const parts = name.split(/\s+and\s+/i);
	if (parts.length === 1) {
		return [parseSinglePerson(parts[0]!)];
	}
	const first = parseSinglePerson(parts[0]!);
	const secondRaw = parts.slice(1).join(' and ').trim();
	const second = parseSinglePerson(secondRaw);
	// "Tanner and Crystal Erisman" → first lacks last; inherit from second.
	// "Jonathan Shaheen and Sara" → second lacks last; inherit from first.
	if (!first.last_name && second.last_name) {
		first.last_name = second.last_name;
	}
	if (!second.last_name && first.last_name) {
		second.last_name = first.last_name;
	}
	return [first, second];
}

function parseSinglePerson(raw: string): SheetPerson {
	const tokens = raw.trim().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return { first_name: 'Unknown', last_name: null };
	if (tokens.length === 1) return { first_name: tokens[0]!, last_name: null };
	return {
		first_name: tokens[0]!,
		last_name: tokens.slice(1).join(' ')
	};
}

/** Best-effort US address: "309 Weatherfield Pl. Lancaster PA 17603" or "…, City ST ZIP" */
export function parseUsAddressLine(raw: string | null | undefined): ParsedAddress {
	const empty: ParsedAddress = {
		address_line_1: null,
		address_line_2: null,
		city: null,
		state: null,
		postal_code: null,
		country: null
	};
	if (!raw?.trim()) return empty;
	const line = raw.trim().replace(/\s+/g, ' ');

	// "street, City ST ZIP" or "street, City, ST ZIP"
	const withComma =
		/^(.+?),\s*([^,]+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(line) ||
		/^(.+?),\s*([^,]+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(line);
	if (withComma) {
		return {
			address_line_1: withComma[1]!.trim(),
			address_line_2: null,
			city: withComma[2]!.trim(),
			state: withComma[3]!,
			postal_code: withComma[4]!,
			country: 'US'
		};
	}

	// "street City ST ZIP" — last token before state is city (single-word cities)
	const m = /^(.+)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(line);
	if (m) {
		const left = m[1]!.trim();
		const bits = left.split(/\s+/);
		if (bits.length >= 2) {
			const city = bits[bits.length - 1]!;
			const street = bits.slice(0, -1).join(' ');
			return {
				address_line_1: street,
				address_line_2: null,
				city,
				state: m[2]!,
				postal_code: m[3]!,
				country: 'US'
			};
		}
	}
	return { ...empty, address_line_1: line, country: 'US' };
}

export function householdNameFromPeople(people: SheetPerson[]): string {
	if (people.length === 0) return 'Unknown';
	if (people.length === 1) {
		const p = people[0]!;
		return p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name;
	}
	const a = people[0]!;
	const b = people[1]!;
	if (a.last_name && a.last_name === b.last_name) {
		return `${a.first_name} and ${b.first_name} ${a.last_name}`;
	}
	const aLabel = a.last_name ? `${a.first_name} ${a.last_name}` : a.first_name;
	const bLabel = b.last_name ? `${b.first_name} ${b.last_name}` : b.first_name;
	return `${aLabel} and ${bLabel}`;
}

function parseCsvLine(line: string): string[] {
	const out: string[] = [];
	let cur = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i]!;
		if (inQuotes) {
			if (ch === '"') {
				if (line[i + 1] === '"') {
					cur += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				cur += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === ',') {
			out.push(cur);
			cur = '';
		} else {
			cur += ch;
		}
	}
	out.push(cur);
	return out;
}

/**
 * Parse Sheet1 CSV text. Expected headers (flexible):
 * Name, Address, Retired?, Group, Giving, Relationship, Frequency
 */
export function parseSheet1Csv(csvText: string): Sheet1Row[] {
	const lines = csvText
		.replace(/^\uFEFF/, '')
		.split(/\r?\n/)
		.map((l) => l.trimEnd())
		.filter((l) => l.trim().length > 0);
	if (lines.length < 2) return [];

	const headers = parseCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
	const idx = (names: string[]) => {
		for (const n of names) {
			const i = headers.findIndex((h) => h === n || h.startsWith(n));
			if (i >= 0) return i;
		}
		return -1;
	};

	const iName = idx(['name']);
	const iAddr = idx(['address']);
	const iRet = idx(['retired']);
	const iGroup = idx(['group']);
	const iGive = idx(['giving']);
	const iRel = idx(['relationship', 'relatic']);
	const iFreq = idx(['frequency', 'freque']);

	if (iName < 0) return [];

	const rows: Sheet1Row[] = [];
	for (const line of lines.slice(1)) {
		const cols = parseCsvLine(line);
		const rawName = (cols[iName] ?? '').trim();
		if (!rawName) continue;
		const people = splitCoupleName(rawName);
		if (people.length === 0) continue;

		const giveRaw = (iGive >= 0 ? cols[iGive] ?? '' : '').trim().toUpperCase();
		const relRaw = (iRel >= 0 ? cols[iRel] ?? '' : '').trim().toUpperCase();
		const freqRaw = (iFreq >= 0 ? cols[iFreq] ?? '' : '').trim().toUpperCase();
		const retiredRaw = (iRet >= 0 ? cols[iRet] ?? '' : '').trim().toLowerCase();

		rows.push({
			rawName,
			people,
			addressRaw: iAddr >= 0 ? (cols[iAddr] ?? '').trim() || null : null,
			retired: retiredRaw === 'y' || retiredRaw === 'yes' || retiredRaw === 'true' || retiredRaw === 'x',
			group: iGroup >= 0 ? (cols[iGroup] ?? '').trim() || null : null,
			giving: isGivingGrade(giveRaw) ? giveRaw : null,
			relationship: isRelationshipGrade(relRaw) ? relRaw : null,
			frequency: FREQUENCY_FROM_SHEET[freqRaw] ?? 'quarterly'
		});
	}
	return rows;
}

/** Names-only list from People for Things (column A). */
export function parseNameListCsv(csvText: string): string[] {
	const lines = csvText
		.replace(/^\uFEFF/, '')
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);
	if (lines.length === 0) return [];
	const start = /^name$/i.test(lines[0]!) ? 1 : 0;
	const names: string[] = [];
	for (const line of lines.slice(start)) {
		const cols = parseCsvLine(line);
		const n = (cols[0] ?? '').trim();
		if (n) names.push(n);
	}
	return names;
}

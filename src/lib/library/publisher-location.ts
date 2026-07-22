/**
 * Turabian / Chicago place-of-publication normalization for `books.publisher_location`
 * and Open Library `publish_places` ingestion.
 *
 * Rules (Heritage Manual + Chicago 14.130):
 * - Well-known cities stand alone (New York, London, Tübingen).
 * - Ambiguous or lesser-known US cities: City, ST (postal abbreviation).
 * - Foreign cities: City, Country when not well-known; strip redundant USA suffixes.
 * - US states always use postal abbreviations (MI), never traditional (Mich.) or full names.
 */

const US_STATE_ABBREV: Record<string, string> = {
	alabama: 'AL',
	alaska: 'AK',
	arizona: 'AZ',
	arkansas: 'AR',
	california: 'CA',
	colorado: 'CO',
	connecticut: 'CT',
	delaware: 'DE',
	'district of columbia': 'DC',
	florida: 'FL',
	georgia: 'GA',
	hawaii: 'HI',
	idaho: 'ID',
	illinois: 'IL',
	indiana: 'IN',
	iowa: 'IA',
	kansas: 'KS',
	kentucky: 'KY',
	louisiana: 'LA',
	maine: 'ME',
	maryland: 'MD',
	massachusetts: 'MA',
	michigan: 'MI',
	minnesota: 'MN',
	mississippi: 'MS',
	missouri: 'MO',
	montana: 'MT',
	nebraska: 'NE',
	nevada: 'NV',
	'new hampshire': 'NH',
	'new jersey': 'NJ',
	'new mexico': 'NM',
	'new york': 'NY',
	'north carolina': 'NC',
	'north dakota': 'ND',
	ohio: 'OH',
	oklahoma: 'OK',
	oregon: 'OR',
	pennsylvania: 'PA',
	'rhode island': 'RI',
	'south carolina': 'SC',
	'south dakota': 'SD',
	tennessee: 'TN',
	texas: 'TX',
	utah: 'UT',
	vermont: 'VT',
	virginia: 'VA',
	washington: 'WA',
	'west virginia': 'WV',
	wisconsin: 'WI',
	wyoming: 'WY'
};

const US_POSTAL = new Set(Object.values(US_STATE_ABBREV));

/**
 * Traditional / Chicago bibliographic abbreviations → postal.
 * Keys are lowercase with periods stripped (Mich. → mich, N.Y. → ny).
 */
const US_STATE_TRADITIONAL: Record<string, string> = {
	ala: 'AL',
	ariz: 'AZ',
	ark: 'AR',
	calif: 'CA',
	colo: 'CO',
	conn: 'CT',
	del: 'DE',
	dc: 'DC',
	fla: 'FL',
	ga: 'GA',
	ill: 'IL',
	ind: 'IN',
	kans: 'KS',
	kan: 'KS',
	ky: 'KY',
	la: 'LA',
	md: 'MD',
	mass: 'MA',
	mich: 'MI',
	minn: 'MN',
	miss: 'MS',
	mo: 'MO',
	mont: 'MT',
	nebr: 'NE',
	neb: 'NE',
	nev: 'NV',
	nh: 'NH',
	nj: 'NJ',
	nmex: 'NM',
	nm: 'NM',
	ny: 'NY',
	nc: 'NC',
	ndak: 'ND',
	nd: 'ND',
	okla: 'OK',
	ore: 'OR',
	oreg: 'OR',
	pa: 'PA',
	penn: 'PA',
	penna: 'PA',
	ri: 'RI',
	sc: 'SC',
	sdak: 'SD',
	sd: 'SD',
	tenn: 'TN',
	tex: 'TX',
	vt: 'VT',
	va: 'VA',
	wash: 'WA',
	wva: 'WV',
	wis: 'WI',
	wisc: 'WI',
	wyo: 'WY'
};

/** Cities that need no state/country suffix in theological citation practice. */
const STANDALONE_CITIES = new Set(
	[
		// US majors
		'new york',
		'boston',
		'chicago',
		'philadelphia',
		'los angeles',
		'san francisco',
		'washington',
		// International publishing centers
		'london',
		'oxford',
		'edinburgh',
		'paris',
		'berlin',
		'munich',
		'münchen',
		'leipzig',
		'hamburg',
		'frankfurt',
		'stuttgart',
		'tübingen',
		'tubingen',
		'göttingen',
		'gottingen',
		'leiden',
		'amsterdam',
		'neukirchen-vluyn',
		'neukirchen',
		'rome',
		'roma',
		'milan',
		'milano',
		'vienna',
		'wien',
		'zürich',
		'zurich',
		'geneva',
		'genève',
		'brussels',
		'bruxelles',
		'madrid',
		'barcelona',
		'lisbon',
		'lisboa',
		'athens',
		'jerusalem',
		'tel aviv',
		'beijing',
		'tokyo',
		'seoul',
		'sydney',
		'melbourne',
		'toronto',
		'montreal',
		'montréal'
	].map((c) => c.toLowerCase())
);

const USA_SUFFIXES = new Set(['usa', 'u.s.a.', 'u.s.a', 'united states', 'united states of america']);

function normalizeKey(s: string): string {
	return s.trim().toLowerCase();
}

/** Lowercase key with periods removed for traditional abbrev lookup. */
function stateCompactKey(s: string): string {
	return normalizeKey(s).replace(/\./g, '');
}

/**
 * Resolve a US state token (full name, traditional abbrev, or postal) to postal.
 * Returns null when the segment is not a recognized US state.
 */
export function resolveUsStatePostal(segment: string): string | null {
	const trimmed = segment.trim();
	if (!trimmed) return null;
	if (/^[A-Za-z]{2}$/.test(trimmed)) {
		const upper = trimmed.toUpperCase();
		if (US_POSTAL.has(upper)) return upper;
	}
	const full = US_STATE_ABBREV[normalizeKey(trimmed)];
	if (full) return full;
	return US_STATE_TRADITIONAL[stateCompactKey(trimmed)] ?? null;
}

function parseSegments(raw: string): string[] {
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

function stripUsaSuffix(segments: string[]): string[] {
	if (segments.length === 0) return segments;
	const last = normalizeKey(segments[segments.length - 1]!);
	if (USA_SUFFIXES.has(last)) return segments.slice(0, -1);
	return segments;
}

/** Null-safe wrapper for form / DB columns. */
export function normalizePublisherLocationOrNull(
	raw: string | null | undefined
): string | null {
	if (raw == null) return null;
	const n = normalizePublisherLocationTurabian(raw);
	return n || null;
}

/**
 * Normalize a raw publisher location string to Turabian citation style.
 * Empty input returns empty string.
 */
export function normalizePublisherLocationTurabian(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) return '';

	const segments = stripUsaSuffix(parseSegments(trimmed));
	if (segments.length === 0) return '';

	if (segments.length === 1) {
		const city = segments[0]!.trim();
		if (STANDALONE_CITIES.has(normalizeKey(city))) return city;
		return city;
	}

	if (segments.length === 2) {
		const [cityRaw, secondRaw] = segments;
		const city = cityRaw!.trim();
		const statePostal = resolveUsStatePostal(secondRaw!);

		// US state suffix: well-known cities stand alone; ambiguous ones keep City, ST.
		if (statePostal) {
			if (STANDALONE_CITIES.has(normalizeKey(city))) return city;
			return `${city}, ${statePostal}`;
		}

		// Well-known city + redundant country (e.g. "London, England") → city alone
		if (STANDALONE_CITIES.has(normalizeKey(city))) return city;

		// Foreign: City, Country
		return `${city}, ${secondRaw!.trim()}`;
	}

	// Three+ segments: take city + last meaningful segment (often state before USA was stripped)
	const city = segments[0]!.trim();
	const tail = segments[segments.length - 1]!.trim();
	const statePostal = resolveUsStatePostal(tail);

	if (statePostal) {
		if (STANDALONE_CITIES.has(normalizeKey(city))) return city;
		return `${city}, ${statePostal}`;
	}

	if (STANDALONE_CITIES.has(normalizeKey(city))) return city;
	return `${city}, ${tail}`;
}

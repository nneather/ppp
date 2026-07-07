/**
 * Turabian / Chicago place-of-publication normalization for `books.publisher_location`
 * and Open Library `publish_places` ingestion.
 *
 * Rules (Heritage Manual + Chicago 14.130):
 * - Well-known cities stand alone (New York, London, Tübingen).
 * - Ambiguous or lesser-known US cities: City, ST (postal abbreviation).
 * - Foreign cities: City, Country when not well-known; strip redundant USA suffixes.
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

function isUsStateAbbrev(token: string): boolean {
	return /^[A-Z]{2}$/.test(token.trim());
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

function abbreviateUsState(segment: string): string {
	const key = normalizeKey(segment);
	if (isUsStateAbbrev(segment)) return segment.trim().toUpperCase();
	const abbrev = US_STATE_ABBREV[key];
	return abbrev ?? segment.trim();
}

/**
 * Normalize a raw publisher location string to Turabian citation style.
 * Empty input returns empty string.
 */
export function normalizePublisherLocationTurabian(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) return '';

	let segments = stripUsaSuffix(parseSegments(trimmed));
	if (segments.length === 0) return '';

	if (segments.length === 1) {
		const city = segments[0]!.trim();
		if (STANDALONE_CITIES.has(normalizeKey(city))) return city;
		return city;
	}

	if (segments.length === 2) {
		const [cityRaw, secondRaw] = segments;
		const city = cityRaw!.trim();
		const secondKey = normalizeKey(secondRaw!);

		// US state suffix: well-known cities stand alone; ambiguous ones keep City, ST.
		if (US_STATE_ABBREV[secondKey] || isUsStateAbbrev(secondRaw!)) {
			if (STANDALONE_CITIES.has(normalizeKey(city))) return city;
			return `${city}, ${abbreviateUsState(secondRaw!)}`;
		}

		// "Grand Rapids, Michigan" → "Grand Rapids, MI"
		const stateAbbrev = US_STATE_ABBREV[secondKey];
		if (stateAbbrev) {
			if (STANDALONE_CITIES.has(normalizeKey(city))) return city;
			return `${city}, ${stateAbbrev}`;
		}

		// Well-known city + redundant country (e.g. "London, England") → city alone
		if (STANDALONE_CITIES.has(normalizeKey(city))) return city;

		// Foreign: City, Country
		return `${city}, ${secondRaw!.trim()}`;
	}

	// Three+ segments: take city + last meaningful segment (often state before USA was stripped)
	const city = segments[0]!.trim();
	const tail = segments[segments.length - 1]!.trim();
	const tailKey = normalizeKey(tail);

	if (US_STATE_ABBREV[tailKey] || isUsStateAbbrev(tail)) {
		if (STANDALONE_CITIES.has(normalizeKey(city))) return city;
		return `${city}, ${abbreviateUsState(tail)}`;
	}

	if (STANDALONE_CITIES.has(normalizeKey(city))) return city;
	return `${city}, ${tail}`;
}

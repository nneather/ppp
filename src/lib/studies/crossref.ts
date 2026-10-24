/** Crossref works API → an editable journal-article prefill. No key. */

export type CrossrefArticlePrefill = {
	doi: string;
	title: string;
	journalTitle: string;
	authors: string;
	year: number | null;
	volume: string | null;
	issue: string | null;
	pageStart: string | null;
	pageEnd: string | null;
};

const CROSSREF_MAILTO = 'parker.neathery@gmail.com';
const CROSSREF_TIMEOUT_MS = 8_000;

export function normalizeDoi(raw: string): string | null {
	let value = raw.trim();
	value = value.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
	value = value.replace(/^doi:\s*/i, '');
	if (!/^10\.\d{4,}\/\S+$/i.test(value)) return null;
	return value.toLowerCase();
}

function asText(value: unknown): string | null {
	if (typeof value === 'string' && value.trim()) return value.trim();
	if (Array.isArray(value)) {
		const first = value.find((item) => typeof item === 'string' && item.trim());
		return typeof first === 'string' ? first.trim() : null;
	}
	return null;
}

function splitPages(page: string | null): { pageStart: string | null; pageEnd: string | null } {
	if (!page) return { pageStart: null, pageEnd: null };
	const parts = page
		.split(/\s*[-–—]\s*/)
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.length >= 2) return { pageStart: parts[0] ?? null, pageEnd: parts[parts.length - 1] ?? null };
	return { pageStart: page, pageEnd: null };
}

function authorLine(author: unknown): string {
	if (!Array.isArray(author)) return '';
	const names: string[] = [];
	for (const row of author) {
		if (!row || typeof row !== 'object') continue;
		const family = asText((row as { family?: unknown }).family);
		const given = asText((row as { given?: unknown }).given);
		if (family && given) names.push(`${family}, ${given}`);
		else if (family) names.push(family);
		else if (given) names.push(given);
	}
	return names.join('; ');
}

function yearFromIssued(issued: unknown): number | null {
	if (!issued || typeof issued !== 'object') return null;
	const parts = (issued as { 'date-parts'?: unknown })['date-parts'];
	if (!Array.isArray(parts) || !Array.isArray(parts[0])) return null;
	const year = parts[0][0];
	return typeof year === 'number' && year >= 1000 && year <= 2100 ? year : null;
}

/** Parse a Crossref `/works/{doi}` `message` object. Null when title or journal is missing. */
export function parseCrossrefWork(message: unknown, doi: string): CrossrefArticlePrefill | null {
	if (!message || typeof message !== 'object') return null;
	const row = message as Record<string, unknown>;
	const title = asText(row.title);
	const journalTitle = asText(row['container-title']);
	if (!title || !journalTitle) return null;
	const pages = splitPages(asText(row.page));
	return {
		doi,
		title,
		journalTitle,
		authors: authorLine(row.author),
		year: yearFromIssued(row.issued),
		volume: asText(row.volume),
		issue: asText(row.issue),
		pageStart: pages.pageStart,
		pageEnd: pages.pageEnd
	};
}

export async function fetchCrossrefPrefill(rawDoi: string): Promise<CrossrefArticlePrefill> {
	const doi = normalizeDoi(rawDoi);
	if (!doi) throw new Error('That does not look like a DOI.');
	const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(CROSSREF_MAILTO)}`;
	let response: Response;
	try {
		response = await fetch(url, {
			signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(CROSSREF_TIMEOUT_MS) : undefined,
			headers: { Accept: 'application/json' }
		});
	} catch {
		throw new Error('Crossref did not respond.');
	}
	if (response.status === 404) throw new Error('Crossref has no work for that DOI.');
	if (!response.ok) throw new Error(`Crossref returned ${response.status}.`);
	const body = (await response.json()) as { message?: unknown };
	const prefill = parseCrossrefWork(body.message, doi);
	if (!prefill) throw new Error('Crossref did not return a title and journal.');
	return prefill;
}

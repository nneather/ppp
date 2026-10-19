/**
 * Resolve a typed study label to a paper or sermon.
 * Exact id, then unique exact / prefix / substring on the label, title, passage, or topic.
 */

import { paperDisplayLead } from '$lib/studies/paper-display';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StudyResolveInput = {
	id: string;
	kind: 'paper' | 'sermon';
	label: string;
	title: string | null;
	passage: string | null;
	topic: string | null;
};

export function studyLabel(input: {
	kind: 'paper' | 'sermon';
	title: string | null;
	passage: string | null;
	topic: string | null;
}): string {
	if (input.kind === 'paper') {
		return paperDisplayLead({
			title: input.title?.trim() || 'Untitled',
			passage_display: input.passage
		}).lead;
	}
	return input.passage?.trim() || input.topic?.trim() || 'Sermon';
}

function normalizeKey(raw: string): string {
	return raw.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
}

function keys(study: StudyResolveInput): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const value of [study.label, study.title, study.passage, study.topic]) {
		const key = normalizeKey(value ?? '');
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(key);
	}
	return out;
}

export function resolveStudy(
	raw: string,
	studies: readonly StudyResolveInput[]
): StudyResolveInput | null {
	const query = raw.trim();
	if (!query || studies.length === 0) return null;
	if (UUID_RE.test(query)) return studies.find((study) => study.id === query) ?? null;

	const key = normalizeKey(query);
	if (!key) return null;

	const exact = studies.filter((study) => keys(study).some((k) => k === key));
	if (exact.length === 1) return exact[0]!;
	if (exact.length > 1) return null;

	const prefix = studies.filter((study) => keys(study).some((k) => k.startsWith(key)));
	if (prefix.length === 1) return prefix[0]!;
	if (prefix.length > 1) return null;

	const substring = studies.filter((study) => keys(study).some((k) => k.includes(key)));
	if (substring.length === 1) return substring[0]!;
	return null;
}

export function studySuggestions(
	raw: string,
	studies: readonly StudyResolveInput[],
	limit = 8
): string[] {
	const key = normalizeKey(raw);
	const ranked = key
		? studies.filter((study) => keys(study).some((k) => k.includes(key)))
		: [...studies];
	return ranked.slice(0, limit).map((study) => `${study.label} (${study.kind})`);
}

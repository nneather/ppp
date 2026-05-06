/**
 * Suggest (and optionally apply) `language = 'german'` for English-catalogued
 * books that look German per Open Library + light heuristics.
 *
 * README: scripts/library-language-audit/README.md
 *
 * Run:
 *   npx tsx scripts/library-language-audit/auditLanguage.ts
 *   npx tsx scripts/library-language-audit/auditLanguage.ts --limit 50
 *   LIBRARY_LANGUAGE_AUDIT_CONFIRM=yes npx tsx scripts/library-language-audit/auditLanguage.ts --apply
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';
import postgres from 'postgres';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT_DIR = resolve(ROOT, 'data');
const OUT_TSV = resolve(OUT_DIR, 'library_language_audit.tsv');

dotenvConfig({ path: resolve(ROOT, '.env') });
dotenvConfig({ path: resolve(ROOT, '.env.local'), override: true });

const APPLY = process.argv.includes('--apply');
const AGGRESSIVE = process.argv.includes('--aggressive');
const LIMIT_ARG = process.argv.indexOf('--limit');
const LIMIT = LIMIT_ARG > 0 ? parseInt(process.argv[LIMIT_ARG + 1]!, 10) : null;

const OL_DELAY_MS = 300;

const DATABASE_URL =
	process.env.LIBRARY_AUDIT_DATABASE_URL?.trim() ||
	process.env.LIBRARY_DST_DATABASE_URL?.trim() ||
	process.env.LIBRARY_SRC_DATABASE_URL?.trim();
if (!DATABASE_URL) {
	console.error(
		'Set one of LIBRARY_DST_DATABASE_URL, LIBRARY_SRC_DATABASE_URL, or LIBRARY_AUDIT_DATABASE_URL in .env.local (hosted Direct URI). See scripts/library-language-audit/README.md'
	);
	process.exit(2);
}

const UMLAUT_RE = /[äöüÄÖÜß]/;
const GERMAN_WORD_RE = /\b(der|die|das|und|nicht|über|für|Deutsch|deutsche|deutschen)\b/i;
const GERMAN_GENRE = 'German Language Tools';

type OlLangKey = string;

async function sleep(ms: number): Promise<void> {
	await new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
	try {
		const res = await fetch(url, { headers: { Accept: 'application/json' } });
		if (!res.ok) return null;
		return (await res.json()) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function languageKeysFromDoc(doc: Record<string, unknown> | null): OlLangKey[] {
	if (!doc) return [];
	const langs = doc.languages;
	if (!Array.isArray(langs)) return [];
	const out: string[] = [];
	for (const e of langs) {
		if (e && typeof e === 'object' && 'key' in e) {
			const k = (e as { key?: unknown }).key;
			if (typeof k === 'string') out.push(k);
		}
	}
	return out;
}

async function openLibraryLanguageHints(isbn: string | null): Promise<{
	keys: OlLangKey[];
	source: string;
}> {
	if (!isbn || !/^[\dXx-]{10,17}$/.test(isbn.replace(/\s/g, ''))) {
		return { keys: [], source: 'no-isbn' };
	}
	const digits = isbn.replace(/[^0-9Xx]/g, '');
	const edition = await fetchJson(`https://openlibrary.org/isbn/${digits}.json`);
	await sleep(OL_DELAY_MS);
	const keys = languageKeysFromDoc(edition);
	const workKeys: string[] = [];
	const works = edition?.works;
	if (Array.isArray(works) && works[0] && typeof works[0] === 'object') {
		const wk = (works[0] as { key?: unknown }).key;
		if (typeof wk === 'string' && wk.startsWith('/')) {
			workKeys.push(wk);
		}
	}
	for (const wk of workKeys) {
		const work = await fetchJson(`https://openlibrary.org${wk}.json`);
		await sleep(OL_DELAY_MS);
		keys.push(...languageKeysFromDoc(work));
	}
	const uniq = [...new Set(keys)];
	return { keys: uniq, source: uniq.length ? 'open-library' : 'open-library-empty' };
}

function hasGermanOlKeys(keys: OlLangKey[]): boolean {
	return keys.some((k) => /\/languages\/ger\b/i.test(k));
}

function hasEnglishOlKeys(keys: OlLangKey[]): boolean {
	return keys.some((k) => /\/languages\/eng\b/i.test(k));
}

function titleHeuristicScore(title: string | null, subtitle: string | null, genre: string | null): {
	score: number;
	reasons: string[];
} {
	const reasons: string[] = [];
	let score = 0;
	const t = `${title ?? ''} ${subtitle ?? ''}`;
	if (UMLAUT_RE.test(t)) {
		score += 2;
		reasons.push('umlaut');
	}
	if (GERMAN_WORD_RE.test(t)) {
		score += 1;
		reasons.push('german-token');
	}
	if (genre === GERMAN_GENRE) {
		score += 2;
		reasons.push('german-genre');
	}
	return { score, reasons };
}

function shouldSuggestGerman(args: {
	olKeys: OlLangKey[];
	titleScore: number;
	titleReasons: string[];
	aggressive: boolean;
}): { suggest: boolean; confidence: string } {
	const olGer = hasGermanOlKeys(args.olKeys);
	const olEngOnly =
		args.olKeys.length > 0 && hasEnglishOlKeys(args.olKeys) && !olGer;

	if (olGer) {
		return { suggest: true, confidence: 'high-ol-ger' };
	}
	if (args.aggressive && args.titleScore >= 2 && !olEngOnly) {
		return { suggest: true, confidence: 'aggressive-umlaut-or-genre' };
	}
	if (args.titleScore >= 2 && args.titleReasons.includes('german-genre')) {
		return { suggest: true, confidence: 'genre-plus-text' };
	}
	return { suggest: false, confidence: 'no' };
}

type BookRow = {
	id: string;
	title: string;
	subtitle: string | null;
	isbn: string | null;
	genre: string;
	language: string;
};

async function main() {
	const confirm = process.env.LIBRARY_LANGUAGE_AUDIT_CONFIRM === 'yes';
	if (APPLY && !confirm) {
		console.error('Refusing --apply without LIBRARY_LANGUAGE_AUDIT_CONFIRM=yes');
		process.exit(2);
	}

	const sql = postgres(DATABASE_URL, { max: 1 });

	let rows = await sql<BookRow[]>`
		SELECT id, title, subtitle, isbn, genre, language
		FROM public.books
		WHERE deleted_at IS NULL AND language = 'english'
		ORDER BY title NULLS LAST, id
	`;
	if (LIMIT != null && Number.isFinite(LIMIT) && LIMIT > 0) {
		rows = rows.slice(0, LIMIT);
	}

	const lines: string[] = [
		['id', 'title', 'isbn', 'genre', 'signals', 'suggested_language', 'confidence'].join('\t')
	];
	const applyIds: string[] = [];

	for (const row of rows) {
		const { keys: olKeys, source: olSource } = await openLibraryLanguageHints(row.isbn);
		const { score: tScore, reasons: tReasons } = titleHeuristicScore(
			row.title,
			row.subtitle,
			row.genre
		);
		const { suggest, confidence } = shouldSuggestGerman({
			olKeys,
			titleScore: tScore,
			titleReasons: tReasons,
			aggressive: AGGRESSIVE
		});

		const signals = [
			`ol:${olSource}`,
			olKeys.length ? `ol-keys=${olKeys.join(',')}` : '',
			tReasons.length ? `text=${tReasons.join('+')}` : ''
		]
			.filter(Boolean)
			.join('; ');

		const suggested = suggest ? 'german' : '';
		lines.push(
			[row.id, row.title.replace(/\t/g, ' '), row.isbn ?? '', row.genre, signals, suggested, confidence]
				.map((c) => c.replace(/\n/g, ' '))
				.join('\t')
		);
		const canApply =
			suggest &&
			(confidence === 'high-ol-ger' ||
				confidence === 'genre-plus-text' ||
				(AGGRESSIVE && confidence === 'aggressive-umlaut-or-genre'));
		if (canApply) applyIds.push(row.id);
	}

	await sql.end({ timeout: 5 });

	if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
	writeFileSync(OUT_TSV, lines.join('\n') + '\n', 'utf8');
	console.log(`Wrote ${OUT_TSV} (${rows.length} rows scanned, ${applyIds.length} apply candidates).`);

	if (APPLY && applyIds.length > 0) {
		const sqlApply = postgres(DATABASE_URL, { max: 1 });
		const CHUNK = 80;
		for (let i = 0; i < applyIds.length; i += CHUNK) {
			const chunk = applyIds.slice(i, i + CHUNK);
			await sqlApply`
				UPDATE public.books
				SET language = 'german', updated_at = now()
				WHERE id IN ${sqlApply(chunk)}
					AND deleted_at IS NULL
					AND language = 'english'
			`;
		}
		await sqlApply.end({ timeout: 5 });
		console.log(`Applied language='german' to ${applyIds.length} books.`);
	} else if (APPLY) {
		console.log('Nothing to apply (no candidates passed the apply gate).');
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

/**
 * Cross-check library ISBNs against Open Library (title/author) + local
 * checksum / duplicate signals. Dry-run only — writes JSON + TSV under data/.
 *
 * Run:
 *   npx tsx scripts/library-isbn-audit/auditIsbn.ts
 *   npx tsx scripts/library-isbn-audit/auditIsbn.ts --limit 100
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';
import postgres from 'postgres';
import {
	isbn10ToIsbn13,
	isbnMatchKeys,
	isValidIsbnChecksum,
	normalizeIsbnDigits
} from '../../src/lib/library/isbn.ts';
import { similarityApprox } from '../../src/lib/library/fuzzy.ts';
import { stripArticlesForImporterMatchKey } from '../../src/lib/library/title-sort.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT_DIR = resolve(ROOT, 'data');
const OUT_JSON = resolve(OUT_DIR, 'library_isbn_audit.json');
const OUT_TSV = resolve(OUT_DIR, 'library_isbn_audit.tsv');

dotenvConfig({ path: resolve(ROOT, '.env') });
dotenvConfig({ path: resolve(ROOT, '.env.local'), override: true });

const LIMIT_ARG = process.argv.indexOf('--limit');
const LIMIT = LIMIT_ARG > 0 ? parseInt(process.argv[LIMIT_ARG + 1]!, 10) : null;

const OL_BATCH = 40;
const OL_DELAY_MS = 250;

const DATABASE_URL =
	process.env.LIBRARY_AUDIT_DATABASE_URL?.trim() ||
	process.env.LIBRARY_DST_DATABASE_URL?.trim() ||
	process.env.LIBRARY_SRC_DATABASE_URL?.trim();
if (!DATABASE_URL) {
	console.error(
		'Set LIBRARY_DST_DATABASE_URL (or SRC / AUDIT) in .env.local — hosted Direct URI.'
	);
	process.exit(2);
}

type BookRow = {
	id: string;
	title: string;
	subtitle: string | null;
	isbn: string;
	year: number | null;
	genre: string | null;
	owned: boolean;
	needs_review: boolean;
	authors: string;
	author_last_keys: string;
};

type OlHit = {
	title: string | null;
	authors: string[];
	publishers: string[];
	publish_date: string | null;
	found: boolean;
};

type Finding = {
	bookId: string;
	title: string;
	authors: string;
	isbn: string;
	isbnNormalized: string | null;
	year: number | null;
	genre: string | null;
	needsReview: boolean;
	severity: 'high' | 'medium' | 'low';
	signals: string[];
	olTitle: string | null;
	olAuthors: string;
	titleScore: number | null;
	authorOk: boolean | null;
	detail: string;
};

async function sleep(ms: number): Promise<void> {
	await new Promise((r) => setTimeout(r, ms));
}

function normalizeTitleKey(raw: string | null | undefined): string {
	if (!raw) return '';
	const lowered = raw
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/['']/g, '')
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return stripArticlesForImporterMatchKey(lowered);
}

function titleSimilarity(a: string, b: string): number {
	const ka = normalizeTitleKey(a);
	const kb = normalizeTitleKey(b);
	if (!ka || !kb) return 0;
	if (ka === kb) return 1;
	if (ka.includes(kb) || kb.includes(ka)) {
		const shorter = Math.min(ka.length, kb.length);
		const longer = Math.max(ka.length, kb.length);
		return Math.max(0.75, shorter / longer);
	}
	// Compare first significant segment (before colon / subtitle) too
	const aMain = ka.split(/\s{2,}|\s:\s|:/)[0]!.trim() || ka;
	const bMain = kb.split(/\s{2,}|\s:\s|:/)[0]!.trim() || kb;
	const full = similarityApprox(ka, kb);
	const main = similarityApprox(aMain, bMain);
	return Math.max(full, main);
}

function authorLastNamesMatch(ours: string, olAuthors: string[]): boolean | null {
	const ourKeys = ours
		.split('|')
		.map((s) => s.trim().toLowerCase())
		.filter((s) => s.length >= 2);
	if (ourKeys.length === 0) return null;
	if (olAuthors.length === 0) return null;
	const olBlob = olAuthors.join(' | ').toLowerCase();
	const hit = ourKeys.some((k) => olBlob.includes(k));
	return hit;
}

function yearFromOl(publishDate: string | null): number | null {
	if (!publishDate) return null;
	const m = publishDate.match(/(\d{4})/);
	return m ? Number.parseInt(m[1]!, 10) : null;
}

async function fetchOlBatch(isbns: string[]): Promise<Map<string, OlHit>> {
	const out = new Map<string, OlHit>();
	if (isbns.length === 0) return out;
	const bibkeys = isbns.map((i) => `ISBN:${i}`).join(',');
	const url = `https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(bibkeys)}&format=json&jscmd=data`;
	try {
		const res = await fetch(url, { headers: { Accept: 'application/json' } });
		if (!res.ok) {
			for (const i of isbns) out.set(i, { title: null, authors: [], publishers: [], publish_date: null, found: false });
			return out;
		}
		const data = (await res.json()) as Record<
			string,
			{
				title?: string;
				authors?: { name?: string }[];
				publishers?: { name?: string }[];
				publish_date?: string;
			}
		>;
		for (const isbn of isbns) {
			const doc = data[`ISBN:${isbn}`];
			if (!doc) {
				out.set(isbn, { title: null, authors: [], publishers: [], publish_date: null, found: false });
				continue;
			}
			out.set(isbn, {
				title: typeof doc.title === 'string' ? doc.title : null,
				authors: (doc.authors ?? []).map((a) => a.name ?? '').filter(Boolean),
				publishers: (doc.publishers ?? []).map((p) => p.name ?? '').filter(Boolean),
				publish_date: typeof doc.publish_date === 'string' ? doc.publish_date : null,
				found: true
			});
		}
	} catch {
		for (const i of isbns) out.set(i, { title: null, authors: [], publishers: [], publish_date: null, found: false });
	}
	return out;
}

function tsvEscape(s: string): string {
	return s.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
}

async function main(): Promise<void> {
	const sql = postgres(DATABASE_URL!, { max: 1, prepare: false, ssl: 'require' });
	try {
		const rows = await sql<BookRow[]>`
			SELECT
				b.id,
				b.title,
				b.subtitle,
				b.isbn,
				b.year,
				b.genre,
				b.owned,
				b.needs_review,
				coalesce((
					SELECT string_agg(
						trim(both ' ' FROM concat_ws(' ', nullif(p.first_name, ''), nullif(p.last_name, ''))),
						'; ' ORDER BY ba.sort_order NULLS LAST
					)
					FROM book_authors ba
					JOIN people p ON p.id = ba.person_id AND p.deleted_at IS NULL
					WHERE ba.book_id = b.id
				), '') AS authors,
				coalesce((
					SELECT string_agg(lower(coalesce(p.last_name, '')), '|' ORDER BY ba.sort_order NULLS LAST)
					FROM book_authors ba
					JOIN people p ON p.id = ba.person_id AND p.deleted_at IS NULL
					WHERE ba.book_id = b.id
				), '') AS author_last_keys
			FROM books b
			WHERE b.deleted_at IS NULL
				AND b.isbn IS NOT NULL
				AND btrim(b.isbn) <> ''
			ORDER BY b.title
			${LIMIT != null && Number.isFinite(LIMIT) ? sql`LIMIT ${LIMIT}` : sql``}
		`;

		console.error(`Loaded ${rows.length} books with ISBN`);

		const findings: Finding[] = [];
		const checksumBad: Finding[] = [];
		const notFound: { id: string; title: string; isbn: string }[] = [];

		// --- local: checksum + twin-key duplicates ---
		const byMatchKey = new Map<string, BookRow[]>();
		for (const row of rows) {
			const norm = normalizeIsbnDigits(row.isbn);
			if (!norm) {
				const f: Finding = {
					bookId: row.id,
					title: row.title,
					authors: row.authors,
					isbn: row.isbn,
					isbnNormalized: null,
					year: row.year,
					genre: row.genre,
					needsReview: row.needs_review,
					severity: 'high',
					signals: ['malformed-isbn'],
					olTitle: null,
					olAuthors: '',
					titleScore: null,
					authorOk: null,
					detail: 'ISBN does not normalize to 10 or 13 digits'
				};
				checksumBad.push(f);
				findings.push(f);
				continue;
			}
			if (!isValidIsbnChecksum(norm)) {
				const f: Finding = {
					bookId: row.id,
					title: row.title,
					authors: row.authors,
					isbn: row.isbn,
					isbnNormalized: norm,
					year: row.year,
					genre: row.genre,
					needsReview: row.needs_review,
					severity: 'high',
					signals: ['bad-checksum'],
					olTitle: null,
					olAuthors: '',
					titleScore: null,
					authorOk: null,
					detail: 'ISBN check digit fails'
				};
				checksumBad.push(f);
				findings.push(f);
			}
			for (const key of isbnMatchKeys(norm)) {
				const list = byMatchKey.get(key) ?? [];
				list.push(row);
				byMatchKey.set(key, list);
			}
		}

		const seenDupPairs = new Set<string>();
		const duplicateGroups: {
			isbnKey: string;
			books: { id: string; title: string; isbn: string; year: number | null }[];
			titlesDiffer: boolean;
		}[] = [];
		for (const [key, list] of byMatchKey) {
			const uniq = new Map<string, BookRow>();
			for (const r of list) uniq.set(r.id, r);
			if (uniq.size < 2) continue;
			const ids = [...uniq.keys()].sort().join('|');
			if (seenDupPairs.has(ids)) continue;
			seenDupPairs.add(ids);
			const books = [...uniq.values()].map((r) => ({
				id: r.id,
				title: r.title,
				isbn: r.isbn,
				year: r.year
			}));
			const titles = new Set(books.map((b) => normalizeTitleKey(b.title)));
			const titlesDiffer = titles.size > 1;
			duplicateGroups.push({ isbnKey: key, books, titlesDiffer });
			if (titlesDiffer) {
				for (const r of uniq.values()) {
					findings.push({
						bookId: r.id,
						title: r.title,
						authors: r.authors,
						isbn: r.isbn,
						isbnNormalized: normalizeIsbnDigits(r.isbn),
						year: r.year,
						genre: r.genre,
						needsReview: r.needs_review,
						severity: 'high',
						signals: ['duplicate-isbn-different-titles'],
						olTitle: null,
						olAuthors: '',
						titleScore: null,
						authorOk: null,
						detail: `Same ISBN key ${key} shared with: ${books
							.filter((b) => b.id !== r.id)
							.map((b) => b.title)
							.join(' | ')}`
					});
				}
			}
		}

		// --- Open Library batch ---
		const lookupIsbns: string[] = [];
		const rowByLookupIsbn = new Map<string, BookRow[]>();
		for (const row of rows) {
			const norm = normalizeIsbnDigits(row.isbn);
			if (!norm || !isValidIsbnChecksum(norm)) continue;
			const prefer13 = norm.length === 10 ? isbn10ToIsbn13(norm) ?? norm : norm;
			const keys = [...new Set([prefer13, norm])];
			for (const k of keys) {
				const list = rowByLookupIsbn.get(k) ?? [];
				list.push(row);
				rowByLookupIsbn.set(k, list);
			}
			lookupIsbns.push(prefer13);
		}
		const uniqueLookup = [...new Set(lookupIsbns)];
		console.error(`Open Library lookups: ${uniqueLookup.length} unique ISBNs`);

		const olByIsbn = new Map<string, OlHit>();
		for (let i = 0; i < uniqueLookup.length; i += OL_BATCH) {
			const chunk = uniqueLookup.slice(i, i + OL_BATCH);
			const hits = await fetchOlBatch(chunk);
			for (const [k, v] of hits) olByIsbn.set(k, v);
			process.stderr.write(
				`\rOL ${Math.min(i + OL_BATCH, uniqueLookup.length)}/${uniqueLookup.length}`
			);
			await sleep(OL_DELAY_MS);
		}
		process.stderr.write('\n');

		const compared: Finding[] = [];
		const okCount = { titleAuthor: 0, titleOnly: 0, authorOnly: 0 };
		let olMissing = 0;
		let olFound = 0;

		const seenBookCompare = new Set<string>();
		for (const row of rows) {
			if (seenBookCompare.has(row.id)) continue;
			const norm = normalizeIsbnDigits(row.isbn);
			if (!norm || !isValidIsbnChecksum(norm)) continue;
			const prefer13 = norm.length === 10 ? isbn10ToIsbn13(norm) ?? norm : norm;
			let hit = olByIsbn.get(prefer13);
			if (!hit?.found && prefer13 !== norm) hit = olByIsbn.get(norm);
			if (!hit?.found) {
				// try any match key
				for (const k of isbnMatchKeys(norm)) {
					const h = olByIsbn.get(k);
					if (h?.found) {
						hit = h;
						break;
					}
				}
			}
			seenBookCompare.add(row.id);
			if (!hit?.found || !hit.title) {
				olMissing++;
				notFound.push({ id: row.id, title: row.title, isbn: row.isbn });
				continue;
			}
			olFound++;
			const ourTitle = row.subtitle ? `${row.title}: ${row.subtitle}` : row.title;
			const score = titleSimilarity(ourTitle, hit.title);
			const authorOk = authorLastNamesMatch(row.author_last_keys, hit.authors);
			const olYear = yearFromOl(hit.publish_date);
			const signals: string[] = [];
			let severity: Finding['severity'] | null = null;

			if (score < 0.35) {
				signals.push('title-mismatch');
				severity = 'high';
			} else if (score < 0.55) {
				signals.push('title-suspicious');
				severity = 'medium';
			}

			if (authorOk === false) {
				signals.push('author-mismatch');
				severity = severity === 'high' ? 'high' : score < 0.55 ? 'high' : 'medium';
			}

			if (
				row.year != null &&
				olYear != null &&
				Math.abs(row.year - olYear) >= 15 &&
				score < 0.7
			) {
				signals.push('year-far-apart');
				if (!severity) severity = 'low';
			}

			if (signals.length === 0) {
				if (authorOk === true || authorOk === null) okCount.titleAuthor++;
				else okCount.titleOnly++;
				continue;
			}

			const detailParts = [
				`titleScore=${score.toFixed(2)}`,
				authorOk === null ? 'author=n/a' : authorOk ? 'author=ok' : 'author=mismatch',
				olYear != null && row.year != null ? `year ours=${row.year} ol=${olYear}` : null
			].filter(Boolean);

			const f: Finding = {
				bookId: row.id,
				title: row.title,
				authors: row.authors,
				isbn: row.isbn,
				isbnNormalized: norm,
				year: row.year,
				genre: row.genre,
				needsReview: row.needs_review,
				severity: severity ?? 'low',
				signals,
				olTitle: hit.title,
				olAuthors: hit.authors.join('; '),
				titleScore: score,
				authorOk,
				detail: detailParts.join('; ')
			};
			compared.push(f);
			findings.push(f);
		}

		const summary = {
			auditedAt: new Date().toISOString(),
			booksWithIsbn: rows.length,
			olFound,
			olMissing,
			checksumFailures: checksumBad.length,
			duplicateGroups: duplicateGroups.length,
			duplicateGroupsTitlesDiffer: duplicateGroups.filter((g) => g.titlesDiffer).length,
			olMismatches: compared.length,
			high: findings.filter((f) => f.severity === 'high').length,
			medium: findings.filter((f) => f.severity === 'medium').length,
			low: findings.filter((f) => f.severity === 'low').length,
			okApprox: okCount.titleAuthor
		};

		const highMedium = findings
			.filter((f) => f.severity === 'high' || f.severity === 'medium')
			.sort((a, b) => {
				const sev = { high: 0, medium: 1, low: 2 };
				return sev[a.severity] - sev[b.severity] || (a.titleScore ?? 1) - (b.titleScore ?? 1);
			});

		const payload = {
			summary,
			duplicateGroups,
			findings: highMedium,
			checksumFailures: checksumBad,
			olNotFoundSample: notFound.slice(0, 40),
			olNotFoundCount: notFound.length
		};

		if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
		writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));

		const header = [
			'severity',
			'signals',
			'isbn',
			'title',
			'authors',
			'ol_title',
			'ol_authors',
			'title_score',
			'year',
			'book_id',
			'detail'
		].join('\t');
		const lines = [header];
		for (const f of highMedium) {
			lines.push(
				[
					f.severity,
					f.signals.join(','),
					f.isbn,
					tsvEscape(f.title),
					tsvEscape(f.authors),
					tsvEscape(f.olTitle ?? ''),
					tsvEscape(f.olAuthors),
					f.titleScore?.toFixed(2) ?? '',
					f.year ?? '',
					f.bookId,
					tsvEscape(f.detail)
				].join('\t')
			);
		}
		writeFileSync(OUT_TSV, lines.join('\n') + '\n');

		console.log(JSON.stringify(summary, null, 2));
		console.error(`Wrote ${OUT_JSON}`);
		console.error(`Wrote ${OUT_TSV} (${highMedium.length} high/medium rows)`);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

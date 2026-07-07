/**
 * AI research pass for the /library/review queue (decision 068, from 064 Q3).
 *
 * For needs_review books (shelf-bound ones excluded), look up missing
 * metadata and INSERT one PENDING row per book into
 * `book_metadata_proposals`. The owner accepts/rejects on the review card —
 * this script NEVER touches `books` and never clears `needs_review`.
 *
 * Sources:
 *   - Open Library (by ISBN): year, publisher, publisher location
 *   - Anthropic (optional, ANTHROPIC_API_KEY): genre classification into the
 *     closed GENRES enum, batched 20 books per call, with a one-line note.
 *     Skipped with a warning when the key is absent (OL-only proposals).
 *
 * README: scripts/library-review-research/README.md
 *
 * Run:
 *   npm run library:review-research                      # dry run → data/library_review_research.tsv
 *   npm run library:review-research -- --limit 100       # first slice
 *   npm run library:review-research -- --all             # include no-ISBN books (genre-only)
 *   LIBRARY_RESEARCH_CONFIRM=yes npm run library:review-research -- --limit 100 --apply
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';
import postgres from 'postgres';
import { GENRES } from '../../src/lib/types/library.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT_DIR = resolve(ROOT, 'data');
const OUT_TSV = resolve(OUT_DIR, 'library_review_research.tsv');

dotenvConfig({ path: resolve(ROOT, '.env') });
dotenvConfig({ path: resolve(ROOT, '.env.local'), override: true });

const APPLY = process.argv.includes('--apply');
const INCLUDE_NO_ISBN = process.argv.includes('--all');
const LIMIT_ARG = process.argv.indexOf('--limit');
const LIMIT = LIMIT_ARG > 0 ? parseInt(process.argv[LIMIT_ARG + 1]!, 10) : null;

const OL_DELAY_MS = 300;
const AI_BATCH_SIZE = 20;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_RESEARCH_MODEL?.trim() || 'claude-sonnet-4-6';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY?.trim() || null;

const DATABASE_URL =
	process.env.LIBRARY_RESEARCH_DATABASE_URL?.trim() ||
	process.env.LIBRARY_DST_DATABASE_URL?.trim() ||
	process.env.LIBRARY_SRC_DATABASE_URL?.trim();
if (!DATABASE_URL) {
	console.error(
		'Set one of LIBRARY_DST_DATABASE_URL, LIBRARY_SRC_DATABASE_URL, or LIBRARY_RESEARCH_DATABASE_URL in .env.local (hosted Direct URI). See scripts/library-review-research/README.md'
	);
	process.exit(2);
}

/** Matches created_by semantics: the owner's profile id when available. */
const CREATED_BY = process.env.POS_OWNER_ID?.trim() || null;

type BookRow = {
	id: string;
	title: string | null;
	subtitle: string | null;
	isbn: string | null;
	genre: string | null;
	year: number | null;
	publisher: string | null;
	publisher_id: string | null;
	publisher_location: string | null;
	language: string;
	author_display: string | null;
};

type FieldDiff = {
	current: string | number | null;
	proposed: string | number;
	source: string;
	note?: string;
};

type ProposalDraft = {
	book: BookRow;
	fields: Record<string, FieldDiff>;
	olSubjects: string[];
};

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

function yearFromPublishDate(raw: unknown): number | null {
	if (typeof raw !== 'string') return null;
	const m = raw.match(/\b(1[5-9]\d\d|20\d\d)\b/);
	return m ? parseInt(m[1]!, 10) : null;
}

function firstString(raw: unknown): string | null {
	if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim()) return raw[0].trim();
	return null;
}

function stringList(raw: unknown, cap: number): string[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
		.slice(0, cap);
}

/** OL edition (+ work for subjects) lookup by ISBN. */
async function openLibraryLookup(isbn: string): Promise<{
	year: number | null;
	publisher: string | null;
	location: string | null;
	subjects: string[];
}> {
	const digits = isbn.replace(/[^0-9Xx]/g, '');
	const empty = { year: null, publisher: null, location: null, subjects: [] as string[] };
	if (!/^(\d{9}[\dXx]|\d{13})$/.test(digits)) return empty;

	const edition = await fetchJson(`https://openlibrary.org/isbn/${digits}.json`);
	await sleep(OL_DELAY_MS);
	if (!edition) return empty;

	const year = yearFromPublishDate(edition.publish_date);
	const publisher = firstString(edition.publishers);
	const location = firstString(edition.publish_places);
	let subjects = stringList(edition.subjects, 8);

	const works = edition.works;
	if (subjects.length === 0 && Array.isArray(works) && works[0] && typeof works[0] === 'object') {
		const wk = (works[0] as { key?: unknown }).key;
		if (typeof wk === 'string' && wk.startsWith('/')) {
			const work = await fetchJson(`https://openlibrary.org${wk}.json`);
			await sleep(OL_DELAY_MS);
			if (work) {
				subjects = stringList(work.subjects, 8).map((s) =>
					typeof s === 'string' ? s : String(s)
				);
			}
		}
	}
	return { year, publisher, location, subjects };
}

// ---------------------------------------------------------------------------
// Anthropic genre classification (batched, closed enum, strict JSON out)
// ---------------------------------------------------------------------------

type GenrePick = { id: string; genre: string; note: string };

async function classifyGenres(
	batch: { id: string; title: string; author: string | null; language: string; subjects: string[] }[]
): Promise<Map<string, GenrePick>> {
	const out = new Map<string, GenrePick>();
	if (!ANTHROPIC_API_KEY || batch.length === 0) return out;

	const genreList = GENRES.join(' | ');
	const bookLines = batch
		.map((b) =>
			JSON.stringify({
				id: b.id,
				title: b.title,
				author: b.author,
				language: b.language,
				ol_subjects: b.subjects
			})
		)
		.join('\n');

	const prompt = `You classify books from a pastor-scholar's personal theological library into EXACTLY one genre from this closed list:\n\n${genreList}\n\nRules:\n- Use ONLY genres from the list, spelled exactly.\n- "* Language Tools" genres are for grammars, lexicons, readers, and dictionaries OF that language — not merely books IN that language.\n- General fiction, novels, poetry collections → Literature or Poetry as appropriate.\n- If genuinely unsure, omit the book from the output.\n\nBooks (one JSON object per line):\n${bookLines}\n\nRespond with ONLY a JSON array, no prose: [{"id": "...", "genre": "...", "note": "<one short reason>"}]`;

	try {
		const res = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-api-key': ANTHROPIC_API_KEY,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: ANTHROPIC_MODEL,
				max_tokens: 4000,
				messages: [{ role: 'user', content: prompt }]
			})
		});
		if (!res.ok) {
			console.warn(`[anthropic] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
			return out;
		}
		const body = (await res.json()) as {
			content?: { type: string; text?: string }[];
		};
		const text = (body.content ?? [])
			.filter((c) => c.type === 'text')
			.map((c) => c.text ?? '')
			.join('');
		const jsonMatch = text.match(/\[[\s\S]*\]/);
		if (!jsonMatch) return out;
		const parsed = JSON.parse(jsonMatch[0]) as unknown;
		if (!Array.isArray(parsed)) return out;
		const genreSet = new Set<string>(GENRES);
		for (const item of parsed) {
			const p = item as Partial<GenrePick>;
			if (
				typeof p.id === 'string' &&
				typeof p.genre === 'string' &&
				genreSet.has(p.genre)
			) {
				out.set(p.id, { id: p.id, genre: p.genre, note: String(p.note ?? '').slice(0, 200) });
			}
		}
	} catch (e) {
		console.warn('[anthropic] request failed:', e);
	}
	return out;
}

// ---------------------------------------------------------------------------

function proposalSource(fields: Record<string, FieldDiff>): string {
	const sources = new Set(Object.values(fields).map((f) => f.source));
	if (sources.size === 1) return [...sources][0] === 'ai-genre' ? 'ai-genre' : 'openlibrary';
	return 'mixed';
}

async function main() {
	const confirm = process.env.LIBRARY_RESEARCH_CONFIRM === 'yes';
	if (APPLY && !confirm) {
		console.error('Refusing --apply without LIBRARY_RESEARCH_CONFIRM=yes');
		process.exit(2);
	}
	if (!ANTHROPIC_API_KEY) {
		console.warn(
			'ANTHROPIC_API_KEY not set — skipping genre classification; proposals will be Open Library only.'
		);
	}

	// ssl required for the Session Pooler path (IPv4 networks can't reach the
	// IPv6-only Direct host); harmless on the Direct URI.
	const sql = postgres(DATABASE_URL!, { max: 1, ssl: 'require' });

	const rows = await sql<BookRow[]>`
		SELECT b.id, b.title, b.subtitle, b.isbn, b.genre, b.year, b.publisher,
			b.publisher_id, b.publisher_location, b.language, b.author_display
		FROM public.books b
		WHERE b.deleted_at IS NULL
			AND b.needs_review
			AND (b.needs_review_note IS NULL OR b.needs_review_note NOT ILIKE '%shelf%')
			AND NOT EXISTS (
				SELECT 1 FROM public.book_metadata_proposals p
				WHERE p.book_id = b.id AND p.status = 'pending' AND p.deleted_at IS NULL
			)
			${INCLUDE_NO_ISBN ? sql`` : sql`AND b.isbn IS NOT NULL`}
		ORDER BY (b.isbn IS NOT NULL) DESC, b.id
		${LIMIT != null && Number.isFinite(LIMIT) && LIMIT > 0 ? sql`LIMIT ${LIMIT}` : sql``}
	`;
	console.log(`${rows.length} candidate books (no pending proposal, not shelf-bound).`);

	// Pass 1: Open Library for books with an ISBN + a missing OL-fillable field.
	const drafts: ProposalDraft[] = [];
	let olCalls = 0;
	for (const book of rows) {
		const fields: Record<string, FieldDiff> = {};
		let olSubjects: string[] = [];

		const missingYear = book.year == null;
		const missingPublisher = book.publisher == null && book.publisher_id == null;
		const missingLocation = book.publisher_location == null;
		const missingGenre = book.genre == null;

		if (book.isbn && (missingYear || missingPublisher || missingLocation || missingGenre)) {
			const ol = await openLibraryLookup(book.isbn);
			olCalls++;
			olSubjects = ol.subjects;
			if (missingYear && ol.year != null) {
				fields.year = { current: null, proposed: ol.year, source: 'openlibrary' };
			}
			if (missingPublisher && ol.publisher) {
				fields.publisher = { current: null, proposed: ol.publisher, source: 'openlibrary' };
			}
			// Location is only proposable alongside a known publisher (existing or proposed).
			if (missingLocation && ol.location && (!missingPublisher || ol.publisher)) {
				fields.publisher_location = {
					current: null,
					proposed: ol.location,
					source: 'openlibrary'
				};
			}
		}

		drafts.push({ book, fields, olSubjects });
		if (olCalls > 0 && olCalls % 25 === 0) console.log(`  …${olCalls} OL lookups`);
	}

	// Pass 2: batched genre classification for genre-less books.
	const genreCandidates = drafts.filter((d) => d.book.genre == null && d.book.title);
	let classified = 0;
	for (let i = 0; i < genreCandidates.length; i += AI_BATCH_SIZE) {
		const batch = genreCandidates.slice(i, i + AI_BATCH_SIZE);
		const picks = await classifyGenres(
			batch.map((d) => ({
				id: d.book.id,
				title: [d.book.title, d.book.subtitle].filter(Boolean).join(': '),
				author: d.book.author_display,
				language: d.book.language,
				subjects: d.olSubjects
			}))
		);
		for (const d of batch) {
			const pick = picks.get(d.book.id);
			if (pick) {
				d.fields.genre = {
					current: null,
					proposed: pick.genre,
					source: 'ai-genre',
					note: pick.note
				};
				classified++;
			}
		}
		if (picks.size > 0) console.log(`  …${classified} genres classified`);
	}

	const proposals = drafts.filter((d) => Object.keys(d.fields).length > 0);

	// TSV report (dry run artifact, also written on --apply for the record).
	const lines: string[] = [['id', 'title', 'isbn', 'proposed_fields', 'source'].join('\t')];
	for (const d of proposals) {
		const summary = Object.entries(d.fields)
			.map(([k, v]) => `${k}=${String(v.proposed)}`)
			.join('; ');
		lines.push(
			[
				d.book.id,
				(d.book.title ?? '(untitled)').replace(/\t/g, ' '),
				d.book.isbn ?? '',
				summary,
				proposalSource(d.fields)
			]
				.map((c) => c.replace(/\n/g, ' '))
				.join('\t')
		);
	}
	if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
	writeFileSync(OUT_TSV, lines.join('\n') + '\n', 'utf8');
	console.log(
		`Wrote ${OUT_TSV} (${rows.length} scanned, ${proposals.length} with proposable fields).`
	);

	if (APPLY && proposals.length > 0) {
		let inserted = 0;
		for (const d of proposals) {
			// The partial unique index (book_id WHERE pending+live) guards races;
			// ON CONFLICT needs the matching predicate to use it.
			const res = await sql`
				INSERT INTO public.book_metadata_proposals (book_id, source, fields, status, created_by)
				VALUES (${d.book.id}, ${proposalSource(d.fields)}, ${sql.json(d.fields)}, 'pending', ${CREATED_BY})
				ON CONFLICT (book_id) WHERE status = 'pending' AND deleted_at IS NULL
				DO NOTHING
			`;
			inserted += res.count;
		}
		console.log(`Inserted ${inserted} pending proposals.`);
	} else if (APPLY) {
		console.log('Nothing to apply (no proposable fields found).');
	}

	await sql.end({ timeout: 5 });
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

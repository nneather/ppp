/**
 * Pure planning for the Turretin scripture-index import: volume resolution,
 * row → scripture_references payload, and dedupe against live/deleted rows.
 * No DB access here — `import-turretin-index.ts` loads state and applies.
 */
import {
	routeIndexRowToVolume,
	stripVolumeFromPageToken,
	type SetVolumeBook
} from '../../src/lib/library/systematics-set-routing.ts';
import { isApocryphaBook } from './turretin-apocrypha.ts';
import type { TurretinRow } from './turretin-gold.ts';

export const TURRETIN_SERIES_NAME = 'Institutes of Elenctic Theology (Turretin)';
export const TURRETIN_VOLUME_NUMBERS = ['I', 'II', 'III'] as const;

/** Text-layer rows passed the gold gate; matches Calvin index rows (confidence 1.00). */
export const TURRETIN_IMPORT_CONFIDENCE = 1;

export type TurretinVolumeBookRow = {
	id: string;
	volume_number: string | null;
	deleted_at: string | null;
};

export type TurretinVolume = SetVolumeBook & { label: string };

export type ScriptureInsertPayload = {
	book_id: string;
	essay_id: null;
	bible_book: string;
	chapter_start: number;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
	page_start: string;
	page_end: string | null;
	needs_review: false;
	review_note: null;
	source_image_url: null;
	confidence_score: number;
	created_by: string;
};

export type ExistingScriptureRef = {
	id: string;
	book_id: string;
	bible_book: string;
	verse_start_abs: number | null;
	verse_end_abs: number | null;
	page_start: string;
	page_end: string | null;
	deleted_at: string | null;
};

/**
 * Pages this far past a volume's last outline page are OCR glue (`2:21142`),
 * not back matter. Closer overruns are inserted with a warning.
 */
export const PAGE_BEYOND_OUTLINE_SLACK = 100;

export type SkipReason =
	| 'unroutable_volume'
	| 'page_out_of_range'
	| 'bible_book_not_in_vocab'
	| 'duplicate_in_file'
	| 'already_live'
	| 'previously_deleted';

export type PlannedSkip = { reason: SkipReason; row: TurretinRow; detail?: string };

export type VolumeTally = {
	canonInsert: number;
	apocryphaInsert: number;
	revive: number;
	alreadyLive: number;
	previouslyDeleted: number;
};

export type TurretinImportPlan = {
	inserts: ScriptureInsertPayload[];
	/** Soft-deleted rows matching the natural key; revived only with --revive-deleted. */
	reviveIds: string[];
	skips: PlannedSkip[];
	byVolume: Record<string, VolumeTally>;
	/** Page beyond the volume's outline span — inserted, but worth a look. */
	pageBeyondOutline: { row: TurretinRow; volume: string; outlineMax: number }[];
};

/**
 * Pick the one live book per volume I/II/III. Soft-deleted duplicates
 * (a deleted vol III exists in prod) are ignored; two live books for the same
 * volume is an error.
 */
export function resolveTurretinVolumes(
	books: TurretinVolumeBookRow[],
	outlineMaxByBookId: Map<string, number> = new Map()
): { ok: true; volumes: TurretinVolume[] } | { ok: false; message: string } {
	const live = books.filter((b) => b.deleted_at == null);
	const volumes: TurretinVolume[] = [];
	for (const label of TURRETIN_VOLUME_NUMBERS) {
		const hits = live.filter((b) => (b.volume_number ?? '').trim().toUpperCase() === label);
		if (hits.length === 0) return { ok: false, message: `No live Turretin volume ${label}.` };
		if (hits.length > 1) {
			return {
				ok: false,
				message: `Multiple live Turretin volume ${label} books: ${hits.map((h) => h.id).join(', ')}`
			};
		}
		const book = hits[0]!;
		volumes.push({
			bookId: book.id,
			volumeNumber: label,
			pageMin: null,
			pageMax: outlineMaxByBookId.get(book.id) ?? null,
			label
		});
	}
	return { ok: true, volumes };
}

/** Mirrors `compute_verse_abs()` (20260429180000) so file rows compare to DB rows. */
export function computeVerseAbs(r: {
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
}): { start: number; end: number } {
	const cs = r.chapter_start;
	const vs = r.verse_start;
	const ce = r.chapter_end;
	const ve = r.verse_end;
	const start = cs != null && vs != null ? cs * 1000 + vs : cs != null ? cs * 1000 : 0;
	let end: number;
	if (ce != null && ve != null) end = ce * 1000 + ve;
	else if (ce != null) end = ce * 1000 + 999;
	else if (cs != null && vs != null) end = cs * 1000 + vs;
	else if (cs != null) end = cs * 1000 + 999;
	else end = 999999;
	return { start, end };
}

/** Same passage + same pages on the same book = same index row. */
export function naturalKey(r: {
	book_id: string;
	bible_book: string;
	verse_start_abs: number | null;
	verse_end_abs: number | null;
	page_start: string;
	page_end: string | null;
}): string {
	return [
		r.book_id,
		r.bible_book,
		r.verse_start_abs ?? '',
		r.verse_end_abs ?? '',
		r.page_start.trim(),
		(r.page_end ?? '').trim()
	].join('|');
}

export function payloadNaturalKey(p: ScriptureInsertPayload): string {
	const abs = computeVerseAbs(p);
	return naturalKey({ ...p, verse_start_abs: abs.start, verse_end_abs: abs.end });
}

function emptyToNull(v: string | null | undefined): string | null {
	const t = (v ?? '').trim();
	return t ? t : null;
}

/**
 * Route one rows.json entry to its volume book and build the insert payload.
 * Only an explicit volume token is trusted; outline/default fallbacks would
 * silently file a row on the wrong volume.
 */
export function rowToScriptureInsert(
	row: TurretinRow,
	volumes: TurretinVolume[],
	ownerId: string
):
	| { ok: true; payload: ScriptureInsertPayload; volume: TurretinVolume }
	| { ok: false; reason: 'unroutable_volume'; detail: string } {
	const routed = routeIndexRowToVolume(
		volumes,
		{ volume: row.volume, pageStart: row.page_start },
		''
	);
	const volume = volumes.find((v) => v.bookId === routed.bookId);
	if (routed.reason !== 'explicit_volume' || !volume) {
		return {
			ok: false,
			reason: 'unroutable_volume',
			detail: `volume=${row.volume ?? '∅'} route=${routed.reason}`
		};
	}
	const pageStart = emptyToNull(stripVolumeFromPageToken(row.page_start));
	if (!pageStart) {
		return { ok: false, reason: 'unroutable_volume', detail: 'empty page_start' };
	}
	return {
		ok: true,
		volume,
		payload: {
			book_id: volume.bookId,
			essay_id: null,
			bible_book: row.bible_book,
			chapter_start: row.chapter_start,
			verse_start: row.verse_start ?? null,
			chapter_end: row.chapter_end ?? null,
			verse_end: row.verse_end ?? null,
			page_start: pageStart,
			page_end: emptyToNull(stripVolumeFromPageToken(row.page_end ?? null)),
			needs_review: false,
			review_note: null,
			source_image_url: null,
			confidence_score: TURRETIN_IMPORT_CONFIDENCE,
			created_by: ownerId
		}
	};
}

function emptyTally(): VolumeTally {
	return { canonInsert: 0, apocryphaInsert: 0, revive: 0, alreadyLive: 0, previouslyDeleted: 0 };
}

export function planTurretinImport(input: {
	rows: TurretinRow[];
	volumes: TurretinVolume[];
	existing: ExistingScriptureRef[];
	knownBibleBooks: ReadonlySet<string>;
	ownerId: string;
	reviveDeleted?: boolean;
}): TurretinImportPlan {
	const live = new Map<string, ExistingScriptureRef>();
	const deleted = new Map<string, ExistingScriptureRef>();
	for (const e of input.existing) {
		const k = naturalKey(e);
		if (e.deleted_at == null) live.set(k, e);
		else if (!deleted.has(k)) deleted.set(k, e);
	}

	const byVolume: Record<string, VolumeTally> = {};
	for (const v of input.volumes) byVolume[v.label] = emptyTally();

	const inserts: ScriptureInsertPayload[] = [];
	const reviveIds: string[] = [];
	const skips: PlannedSkip[] = [];
	const pageBeyondOutline: TurretinImportPlan['pageBeyondOutline'] = [];
	const seen = new Set<string>();

	for (const row of input.rows) {
		const mapped = rowToScriptureInsert(row, input.volumes, input.ownerId);
		if (!mapped.ok) {
			skips.push({ reason: mapped.reason, row, detail: mapped.detail });
			continue;
		}
		const { payload, volume } = mapped;
		const tally = byVolume[volume.label]!;

		const page = Number(payload.page_start);
		const beyondOutline =
			volume.pageMax != null && Number.isInteger(page) && page > volume.pageMax;
		if (beyondOutline && page > volume.pageMax! + PAGE_BEYOND_OUTLINE_SLACK) {
			skips.push({
				reason: 'page_out_of_range',
				row,
				detail: `p.${page} vs vol ${volume.label} outline max ${volume.pageMax}`
			});
			continue;
		}

		if (!input.knownBibleBooks.has(payload.bible_book)) {
			skips.push({ reason: 'bible_book_not_in_vocab', row, detail: payload.bible_book });
			continue;
		}

		const key = payloadNaturalKey(payload);
		if (seen.has(key)) {
			skips.push({ reason: 'duplicate_in_file', row, detail: key });
			continue;
		}
		seen.add(key);

		if (live.has(key)) {
			tally.alreadyLive += 1;
			skips.push({ reason: 'already_live', row });
			continue;
		}
		const gone = deleted.get(key);
		if (gone) {
			if (input.reviveDeleted) {
				tally.revive += 1;
				reviveIds.push(gone.id);
			} else {
				tally.previouslyDeleted += 1;
				skips.push({ reason: 'previously_deleted', row, detail: gone.id });
			}
			continue;
		}

		if (beyondOutline) {
			pageBeyondOutline.push({ row, volume: volume.label, outlineMax: volume.pageMax! });
		}

		inserts.push(payload);
		if (isApocryphaBook(payload.bible_book)) tally.apocryphaInsert += 1;
		else tally.canonInsert += 1;
	}

	return { inserts, reviveIds, skips, byVolume, pageBeyondOutline };
}

export type PendingVocabFile = {
	note: string;
	books: Record<string, number>;
	rows: TurretinRow[];
};

/** Rows held back because `bible_books` lacks the book (apocrypha until the vocab migration). */
export function pendingVocabFile(plan: TurretinImportPlan): PendingVocabFile {
	const rows = plan.skips
		.filter((s) => s.reason === 'bible_book_not_in_vocab')
		.map((s) => s.row);
	const books: Record<string, number> = {};
	for (const r of rows) books[r.bible_book] = (books[r.bible_book] ?? 0) + 1;
	return {
		note:
			'Written by npm run turretin:import. Rows whose bible_book is not in prod bible_books yet. ' +
			'After the vocab migration, re-run the import; these rows insert and this file empties.',
		books,
		rows
	};
}

function describeRow(r: TurretinRow): string {
	const where = r.printed_page != null ? ` (p.${r.printed_page} col ${r.column ?? '?'})` : '';
	return `${r.source_line ?? `${r.bible_book} ${r.chapter_start}`}${where}`;
}

export function formatImportPlan(plan: TurretinImportPlan, totalRows: number): string[] {
	const out: string[] = [];
	out.push(`rows.json: ${totalRows} rows`);
	out.push('');
	out.push('volume | canon insert | apocrypha insert | revive | already live | previously deleted');
	for (const [label, t] of Object.entries(plan.byVolume)) {
		out.push(
			`${label.padEnd(6)} | ${String(t.canonInsert).padStart(12)} | ${String(t.apocryphaInsert).padStart(16)} | ${String(t.revive).padStart(6)} | ${String(t.alreadyLive).padStart(12)} | ${String(t.previouslyDeleted).padStart(18)}`
		);
	}
	const totalCanon = Object.values(plan.byVolume).reduce((n, t) => n + t.canonInsert, 0);
	const totalApoc = Object.values(plan.byVolume).reduce((n, t) => n + t.apocryphaInsert, 0);
	out.push(
		`total  | ${String(totalCanon).padStart(12)} | ${String(totalApoc).padStart(16)} | ${String(plan.reviveIds.length).padStart(6)} |`
	);
	out.push('');

	const byReason = new Map<SkipReason, PlannedSkip[]>();
	for (const s of plan.skips) {
		const list = byReason.get(s.reason) ?? [];
		list.push(s);
		byReason.set(s.reason, list);
	}
	out.push(`skipped: ${plan.skips.length}`);
	for (const [reason, list] of byReason) {
		const apoc = list.filter((s) => isApocryphaBook(s.row.bible_book)).length;
		out.push(`  ${reason}: ${list.length} (canon ${list.length - apoc}, apocrypha ${apoc})`);
		if (reason === 'already_live') continue;
		for (const s of list.slice(0, 15)) {
			out.push(`    - ${describeRow(s.row)}${s.detail ? ` — ${s.detail}` : ''}`);
		}
		if (list.length > 15) out.push(`    … ${list.length - 15} more`);
	}

	if (plan.pageBeyondOutline.length) {
		out.push('');
		out.push(`warn: ${plan.pageBeyondOutline.length} rows cite a page past the volume outline (still inserted)`);
		for (const w of plan.pageBeyondOutline.slice(0, 15)) {
			out.push(`    - vol ${w.volume} (outline max ${w.outlineMax}): ${describeRow(w.row)}`);
		}
		if (plan.pageBeyondOutline.length > 15) out.push(`    … ${plan.pageBeyondOutline.length - 15} more`);
	}
	return out;
}

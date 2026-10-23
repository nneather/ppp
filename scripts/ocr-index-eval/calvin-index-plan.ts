/**
 * Route parsed Battles index rows onto the two McNeill/Battles volumes.
 * A section lands on the one volume whose outline chapter covers it.
 * PA stays on volume 1 (the Prefatory Address is printed there) and is flagged.
 */
import { locatorCoversSectionPointer } from '../../src/lib/library/outline.ts';
import { parseSectionLocator } from '../../src/lib/library/section-pointer.ts';
import type { CalvinCitation } from './calvin-index-parse.ts';
import { computeVerseAbs } from './turretin-import-plan.ts';

export const CALVIN_SERIES_NAME = 'Institutes of the Christian Religion (McNeill/Battles)';
export const CALVIN_IMPORT_CONFIDENCE = 1;

export type CalvinVolumeBookRow = {
	id: string;
	volume_number: string | null;
	deleted_at: string | null;
};

export type CalvinVolume = {
	bookId: string;
	volumeNumber: '1' | '2';
	locators: string[];
};

export type CalvinInsert = {
	book_id: string;
	essay_id: null;
	bible_book: string;
	chapter_start: number;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
	page_start: string;
	page_end: string | null;
	needs_review: boolean;
	review_note: string | null;
	source_image_url: null;
	confidence_score: number;
	created_by: string;
};

export type CalvinExistingRef = {
	id: string;
	book_id: string;
	bible_book: string;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
	page_start: string;
	page_end: string | null;
	deleted_at: string | null;
};

export type CalvinPlanFailure = { reason: string; line: string };

export type CalvinImportPlan = {
	inserts: CalvinInsert[];
	retireIds: string[];
	retireSamples: CalvinExistingRef[];
	skippedLive: number;
	skippedDeleted: number;
	failures: CalvinPlanFailure[];
	byVolume: Record<string, number>;
	needsReview: number;
};

export function usableOutlineLocators(locators: readonly (string | null)[]): string[] {
	const out: string[] = [];
	for (const locator of locators) {
		if (locator && parseSectionLocator(locator)) out.push(locator);
	}
	return out;
}

export function resolveCalvinVolumes(
	books: readonly CalvinVolumeBookRow[],
	locatorsByBookId: ReadonlyMap<string, readonly (string | null)[]>
): { ok: true; volumes: CalvinVolume[] } | { ok: false; message: string } {
	const live = books.filter((b) => b.deleted_at == null);
	const volumes: CalvinVolume[] = [];
	for (const label of ['1', '2'] as const) {
		const hits = live.filter((b) => (b.volume_number ?? '').trim() === label);
		if (hits.length === 0) return { ok: false, message: `No live Battles volume ${label}.` };
		if (hits.length > 1) {
			return {
				ok: false,
				message: `Multiple live Battles volume ${label} books: ${hits.map((h) => h.id).join(', ')}`
			};
		}
		const book = hits[0]!;
		const locators = usableOutlineLocators(locatorsByBookId.get(book.id) ?? []);
		if (locators.length === 0) {
			return { ok: false, message: `Battles volume ${label} has no chapter outline.` };
		}
		volumes.push({ bookId: book.id, volumeNumber: label, locators });
	}
	return { ok: true, volumes };
}

export function calvinNaturalKey(row: {
	book_id: string;
	bible_book: string;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
	page_start: string;
	page_end: string | null;
}): string {
	const abs = computeVerseAbs(row);
	return [
		row.book_id,
		row.bible_book,
		abs.start,
		abs.end,
		row.page_start.trim(),
		(row.page_end ?? '').trim()
	].join('|');
}

/**
 * File is the source of truth for counts. Live matches are kept.
 * Soft-deleted matches stay deleted. Live rows with no file twin are retired
 * (the seven practice citations, whose roman locators do not match this index).
 */
export function planCalvinImport(input: {
	rows: readonly CalvinCitation[];
	volumes: readonly CalvinVolume[];
	existing: readonly CalvinExistingRef[];
	knownBibleBooks: ReadonlySet<string>;
	ownerId: string;
}): CalvinImportPlan {
	const inserts: CalvinInsert[] = [];
	const failures: CalvinPlanFailure[] = [];
	const byVolume: Record<string, number> = { '1': 0, '2': 0 };
	let needsReview = 0;

	const routed: { key: string; payload: CalvinInsert }[] = [];
	for (const row of input.rows) {
		if (!input.knownBibleBooks.has(row.bible_book)) {
			failures.push({ reason: 'bible_book_not_in_vocab', line: describe(row) });
			continue;
		}
		const volume = volumeForRow(input.volumes, row);
		if (!volume.ok) {
			failures.push({ reason: volume.reason, line: describe(row) });
			continue;
		}
		const payload: CalvinInsert = {
			book_id: volume.volume.bookId,
			essay_id: null,
			bible_book: row.bible_book,
			chapter_start: row.chapter_start,
			verse_start: row.verse_start,
			chapter_end: row.chapter_end,
			verse_end: row.verse_end,
			page_start: row.page_start,
			page_end: row.page_end,
			needs_review: row.needs_review,
			review_note: row.review_note,
			source_image_url: null,
			confidence_score: CALVIN_IMPORT_CONFIDENCE,
			created_by: input.ownerId
		};
		routed.push({ key: calvinNaturalKey(payload), payload });
		byVolume[volume.volume.volumeNumber] = (byVolume[volume.volume.volumeNumber] ?? 0) + 1;
		if (row.needs_review) needsReview += 1;
	}

	const liveByKey = new Map<string, CalvinExistingRef[]>();
	const deletedByKey = new Map<string, number>();
	for (const ref of input.existing) {
		const key = calvinNaturalKey({
			...ref,
			chapter_start: ref.chapter_start,
			verse_start: ref.verse_start,
			chapter_end: ref.chapter_end,
			verse_end: ref.verse_end
		});
		if (ref.deleted_at) {
			deletedByKey.set(key, (deletedByKey.get(key) ?? 0) + 1);
		} else {
			const list = liveByKey.get(key) ?? [];
			list.push(ref);
			liveByKey.set(key, list);
		}
	}

	const liveUsed = new Map<string, number>();
	const deletedUsed = new Map<string, number>();
	let skippedLive = 0;
	let skippedDeleted = 0;
	if (failures.length > 0) {
		return {
			inserts: [],
			retireIds: [],
			retireSamples: [],
			skippedLive: 0,
			skippedDeleted: 0,
			failures,
			byVolume,
			needsReview
		};
	}
	for (const row of routed) {
		const live = liveByKey.get(row.key) ?? [];
		const usedLive = liveUsed.get(row.key) ?? 0;
		if (usedLive < live.length) {
			liveUsed.set(row.key, usedLive + 1);
			skippedLive += 1;
			continue;
		}
		const deleted = deletedByKey.get(row.key) ?? 0;
		const usedDeleted = deletedUsed.get(row.key) ?? 0;
		if (usedDeleted < deleted) {
			deletedUsed.set(row.key, usedDeleted + 1);
			skippedDeleted += 1;
			continue;
		}
		inserts.push(row.payload);
	}

	const retire: CalvinExistingRef[] = [];
	for (const [key, refs] of liveByKey) {
		const used = liveUsed.get(key) ?? 0;
		retire.push(...refs.slice(used));
	}

	return {
		inserts,
		retireIds: retire.map((r) => r.id),
		retireSamples: retire,
		skippedLive,
		skippedDeleted,
		failures,
		byVolume,
		needsReview
	};
}

export function formatCalvinPlan(plan: CalvinImportPlan, sourceRows: number): string[] {
	const lines = [
		`parsed rows: ${sourceRows}`,
		`routed vol 1: ${plan.byVolume['1'] ?? 0}`,
		`routed vol 2: ${plan.byVolume['2'] ?? 0}`,
		`needs review: ${plan.needsReview}`,
		`insert: ${plan.inserts.length}`,
		`already live: ${plan.skippedLive}`,
		`stay deleted: ${plan.skippedDeleted}`,
		`retire: ${plan.retireIds.length}`,
		`failures: ${plan.failures.length}`
	];
	for (const sample of plan.retireSamples.slice(0, 12)) {
		lines.push(
			`  retire ${sample.bible_book} ${sample.chapter_start ?? ''}:${sample.verse_start ?? ''} ${sample.page_start}`
		);
	}
	const shown = new Map<string, number>();
	for (const failure of plan.failures) {
		const n = shown.get(failure.reason) ?? 0;
		if (n >= 5) continue;
		shown.set(failure.reason, n + 1);
		lines.push(`  ${failure.reason}: ${failure.line}`);
	}
	return lines;
}

function volumeForRow(
	volumes: readonly CalvinVolume[],
	row: CalvinCitation
): { ok: true; volume: CalvinVolume } | { ok: false; reason: string } {
	if (row.edition) {
		const vol1 = volumes.find((v) => v.volumeNumber === '1');
		if (!vol1) return { ok: false, reason: 'no_volume_1_for_edition' };
		return { ok: true, volume: vol1 };
	}
	const hits = volumes.filter((volume) =>
		volume.locators.some((locator) =>
			locatorCoversSectionPointer(locator, row.page_start, row.page_end)
		)
	);
	if (hits.length === 1) return { ok: true, volume: hits[0]! };
	if (hits.length === 0) return { ok: false, reason: 'outline_chapter_missing' };
	return { ok: false, reason: 'outline_chapter_on_two_volumes' };
}

function describe(row: CalvinCitation): string {
	const verse =
		row.verse_start == null ? String(row.chapter_start) : `${row.chapter_start}:${row.verse_start}`;
	return `${row.bible_book} ${verse} => ${row.page_start}`;
}

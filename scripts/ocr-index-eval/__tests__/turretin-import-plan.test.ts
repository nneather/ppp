import { describe, expect, it } from 'vitest';
import {
	computeVerseAbs,
	naturalKey,
	payloadNaturalKey,
	pendingVocabFile,
	planTurretinImport,
	resolveTurretinVolumes,
	rowToScriptureInsert,
	type ExistingScriptureRef,
	type TurretinVolume
} from '../turretin-import-plan.ts';
import type { TurretinRow } from '../turretin-gold.ts';

const OWNER = '00000000-0000-4000-8000-000000000001';
const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';
const V3 = '33333333-3333-4333-8333-333333333333';

const volumes: TurretinVolume[] = [
	{ bookId: V1, volumeNumber: 'I', pageMin: null, pageMax: 685, label: 'I' },
	{ bookId: V2, volumeNumber: 'II', pageMin: null, pageMax: 724, label: 'II' },
	{ bookId: V3, volumeNumber: 'III', pageMin: null, pageMax: 637, label: 'III' }
];

const CANON = new Set(['Genesis', 'John', 'Job', '1 Thessalonians', 'Revelation']);

function row(partial: Partial<TurretinRow>): TurretinRow {
	return {
		bible_book: 'John',
		chapter_start: 8,
		page_start: '112',
		volume: '2',
		...partial
	};
}

describe('resolveTurretinVolumes', () => {
	it('ignores a soft-deleted duplicate volume', () => {
		const r = resolveTurretinVolumes([
			{ id: V1, volume_number: 'I', deleted_at: null },
			{ id: V2, volume_number: 'II', deleted_at: null },
			{ id: V3, volume_number: 'III', deleted_at: null },
			{ id: 'dead', volume_number: 'III', deleted_at: '2026-07-24T00:00:00Z' }
		]);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.volumes.map((v) => v.bookId)).toEqual([V1, V2, V3]);
	});

	it('fails on a missing or doubled live volume', () => {
		expect(
			resolveTurretinVolumes([
				{ id: V1, volume_number: 'I', deleted_at: null },
				{ id: V2, volume_number: 'II', deleted_at: null }
			]).ok
		).toBe(false);
		expect(
			resolveTurretinVolumes([
				{ id: V1, volume_number: 'I', deleted_at: null },
				{ id: V2, volume_number: 'II', deleted_at: null },
				{ id: V3, volume_number: 'III', deleted_at: null },
				{ id: 'x', volume_number: 'iii', deleted_at: null }
			]).ok
		).toBe(false);
	});

	it('carries outline max pages', () => {
		const r = resolveTurretinVolumes(
			[
				{ id: V1, volume_number: 'I', deleted_at: null },
				{ id: V2, volume_number: 'II', deleted_at: null },
				{ id: V3, volume_number: 'III', deleted_at: null }
			],
			new Map([[V2, 724]])
		);
		expect(r.ok && r.volumes[1]!.pageMax).toBe(724);
	});
});

describe('rowToScriptureInsert', () => {
	it('maps arabic volume to the roman volume book with Calvin-style index fields', () => {
		const r = rowToScriptureInsert(
			row({ bible_book: 'John', chapter_start: 8, verse_start: 11, page_start: '112', volume: '2' }),
			volumes,
			OWNER
		);
		expect(r).toEqual({
			ok: true,
			volume: volumes[1],
			payload: {
				book_id: V2,
				essay_id: null,
				bible_book: 'John',
				chapter_start: 8,
				verse_start: 11,
				chapter_end: null,
				verse_end: null,
				page_start: '112',
				page_end: null,
				needs_review: false,
				review_note: null,
				source_image_url: null,
				confidence_score: 1,
				created_by: OWNER
			}
		});
	});

	it('keeps verse ranges and abbreviated page ends as printed', () => {
		const r = rowToScriptureInsert(
			row({
				bible_book: 'Job',
				chapter_start: 19,
				verse_start: 25,
				chapter_end: 19,
				verse_end: 27,
				page_start: '536',
				page_end: '64',
				volume: '3'
			}),
			volumes,
			OWNER
		);
		expect(r.ok && r.payload).toMatchObject({
			book_id: V3,
			chapter_end: 19,
			verse_end: 27,
			page_start: '536',
			page_end: '64'
		});
	});

	it('strips an embedded vol:page token and keeps roman front-matter pages', () => {
		const a = rowToScriptureInsert(row({ page_start: '2:620', volume: '2' }), volumes, OWNER);
		expect(a.ok && a.payload.page_start).toBe('620');
		const b = rowToScriptureInsert(row({ page_start: 'xli', volume: '1' }), volumes, OWNER);
		expect(b.ok && b.payload).toMatchObject({ book_id: V1, page_start: 'xli' });
	});

	it('refuses a volume the set does not have instead of defaulting', () => {
		const r = rowToScriptureInsert(row({ volume: '4', page_start: '445' }), volumes, OWNER);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe('unroutable_volume');
	});
});

describe('computeVerseAbs', () => {
	it('mirrors compute_verse_abs for chapter-only, verse, and range rows', () => {
		const base = { verse_start: null, chapter_end: null, verse_end: null };
		expect(computeVerseAbs({ ...base, chapter_start: 18 })).toEqual({ start: 18000, end: 18999 });
		expect(computeVerseAbs({ ...base, chapter_start: 1, verse_start: 5 })).toEqual({
			start: 1005,
			end: 1005
		});
		expect(
			computeVerseAbs({ chapter_start: 18, verse_start: 1, chapter_end: 18, verse_end: 15 })
		).toEqual({ start: 18001, end: 18015 });
		expect(
			computeVerseAbs({ chapter_start: 2, verse_start: null, chapter_end: 3, verse_end: null })
		).toEqual({ start: 2000, end: 3999 });
	});
});

describe('planTurretinImport', () => {
	function existingFrom(
		r: TurretinRow,
		over: Partial<ExistingScriptureRef> = {}
	): ExistingScriptureRef {
		const m = rowToScriptureInsert(r, volumes, OWNER);
		if (!m.ok) throw new Error('fixture row must route');
		const abs = computeVerseAbs(m.payload);
		return {
			id: 'e1',
			book_id: m.payload.book_id,
			bible_book: m.payload.bible_book,
			verse_start_abs: abs.start,
			verse_end_abs: abs.end,
			page_start: m.payload.page_start,
			page_end: m.payload.page_end,
			deleted_at: null,
			...over
		};
	}

	it('tallies canon vs apocrypha per volume and blocks books missing from vocab', () => {
		const plan = planTurretinImport({
			rows: [
				row({ bible_book: 'Genesis', chapter_start: 1, page_start: '457', volume: '1' }),
				row({ bible_book: 'John', chapter_start: 8, verse_start: 11, volume: '2' }),
				row({ bible_book: 'Tobit', chapter_start: 5, verse_start: 12, page_start: '103', volume: '1' }),
				row({ bible_book: 'Sirach', chapter_start: 1, page_start: '50', volume: '3' })
			],
			volumes,
			existing: [],
			knownBibleBooks: new Set([...CANON, 'Tobit']),
			ownerId: OWNER
		});
		expect(plan.inserts).toHaveLength(3);
		expect(plan.byVolume.I).toMatchObject({ canonInsert: 1, apocryphaInsert: 1 });
		expect(plan.byVolume.II).toMatchObject({ canonInsert: 1, apocryphaInsert: 0 });
		expect(plan.skips.map((s) => s.reason)).toEqual(['bible_book_not_in_vocab']);
	});

	it('is idempotent: a second plan over the first plan’s writes inserts nothing', () => {
		const rows = [
			row({ bible_book: '1 Thessalonians', chapter_start: 1, verse_start: 5, page_start: '534' }),
			row({ bible_book: '1 Thessalonians', chapter_start: 1, verse_start: 5, page_start: '621' })
		];
		const first = planTurretinImport({
			rows,
			volumes,
			existing: [],
			knownBibleBooks: CANON,
			ownerId: OWNER
		});
		expect(first.inserts).toHaveLength(2);
		const written: ExistingScriptureRef[] = rows.map((r, i) => existingFrom(r, { id: `w${i}` }));
		const second = planTurretinImport({
			rows,
			volumes,
			existing: written,
			knownBibleBooks: CANON,
			ownerId: OWNER
		});
		expect(second.inserts).toHaveLength(0);
		expect(second.byVolume.II!.alreadyLive).toBe(2);
	});

	it('does not treat a different page on the same verse as a duplicate', () => {
		const plan = planTurretinImport({
			rows: [row({ bible_book: '1 Thessalonians', chapter_start: 1, verse_start: 5, page_start: '621' })],
			volumes,
			existing: [
				existingFrom(
					row({ bible_book: '1 Thessalonians', chapter_start: 1, verse_start: 5, page_start: '620' })
				)
			],
			knownBibleBooks: CANON,
			ownerId: OWNER
		});
		expect(plan.inserts).toHaveLength(1);
	});

	it('matches an existing row stored with chapter_end = chapter_start', () => {
		const r = row({ bible_book: 'John', chapter_start: 8, verse_start: 11 });
		const plan = planTurretinImport({
			rows: [r],
			volumes,
			existing: [existingFrom(row({ ...r, chapter_end: 8, verse_end: 11 }))],
			knownBibleBooks: CANON,
			ownerId: OWNER
		});
		expect(plan.inserts).toHaveLength(0);
	});

	it('leaves soft-deleted matches deleted unless revive is requested', () => {
		const r = row({ bible_book: 'John', chapter_start: 8, verse_start: 11 });
		const gone = existingFrom(r, { id: 'gone', deleted_at: '2026-10-20T00:00:00Z' });
		const keep = planTurretinImport({
			rows: [r],
			volumes,
			existing: [gone],
			knownBibleBooks: CANON,
			ownerId: OWNER
		});
		expect(keep.inserts).toHaveLength(0);
		expect(keep.reviveIds).toEqual([]);
		expect(keep.skips[0]!.reason).toBe('previously_deleted');

		const revive = planTurretinImport({
			rows: [r],
			volumes,
			existing: [gone],
			knownBibleBooks: CANON,
			ownerId: OWNER,
			reviveDeleted: true
		});
		expect(revive.reviveIds).toEqual(['gone']);
		expect(revive.inserts).toHaveLength(0);
	});

	it('drops in-file duplicates by natural key', () => {
		const r = row({ bible_book: 'John', chapter_start: 8, verse_start: 11 });
		const plan = planTurretinImport({
			rows: [r, { ...r, chapter_end: 8, verse_end: 11 }],
			volumes,
			existing: [],
			knownBibleBooks: CANON,
			ownerId: OWNER
		});
		expect(plan.inserts).toHaveLength(1);
		expect(plan.skips[0]!.reason).toBe('duplicate_in_file');
	});

	it('skips glued page tokens far past the outline and warns on near overruns', () => {
		const plan = planTurretinImport({
			rows: [
				row({ bible_book: 'Revelation', chapter_start: 12, verse_start: 11, page_start: '21142' }),
				row({ bible_book: 'Revelation', chapter_start: 12, verse_start: 11, page_start: '221' }),
				row({ bible_book: 'Job', chapter_start: 38, page_start: '673', volume: '3' })
			],
			volumes,
			existing: [],
			knownBibleBooks: CANON,
			ownerId: OWNER
		});
		expect(plan.inserts.map((p) => p.page_start)).toEqual(['221', '673']);
		expect(plan.skips.map((s) => s.reason)).toEqual(['page_out_of_range']);
		expect(plan.pageBeyondOutline).toHaveLength(1);
		expect(plan.pageBeyondOutline[0]!.volume).toBe('III');
	});

	it('holds vocab-blocked rows in the pending file, counted by book', () => {
		const plan = planTurretinImport({
			rows: [
				row({ bible_book: 'Tobit', chapter_start: 5, verse_start: 12, page_start: '103', volume: '1' }),
				row({ bible_book: 'Tobit', chapter_start: 6, verse_start: 6, page_start: '103', volume: '1' }),
				row({ bible_book: 'Sirach', chapter_start: 1, page_start: '50', volume: '3' }),
				row({ bible_book: 'John', chapter_start: 8, verse_start: 11 })
			],
			volumes,
			existing: [],
			knownBibleBooks: CANON,
			ownerId: OWNER
		});
		const pending = pendingVocabFile(plan);
		expect(pending.books).toEqual({ Tobit: 2, Sirach: 1 });
		expect(pending.rows.map((r) => r.bible_book)).toEqual(['Tobit', 'Tobit', 'Sirach']);
		expect(plan.inserts).toHaveLength(1);
	});

	it('natural key is stable between payload and DB row shapes', () => {
		const m = rowToScriptureInsert(row({ verse_start: 11 }), volumes, OWNER);
		if (!m.ok) throw new Error('route');
		expect(payloadNaturalKey(m.payload)).toBe(
			naturalKey({
				book_id: V2,
				bible_book: 'John',
				verse_start_abs: 8011,
				verse_end_abs: 8011,
				page_start: '112',
				page_end: null
			})
		);
	});
});

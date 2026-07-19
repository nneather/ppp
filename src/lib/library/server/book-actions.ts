import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GENRES, LANGUAGES, READING_STATUSES, AUTHOR_ROLES, WORK_TYPES } from '$lib/types/library';
import type { AuthorRole, Genre, Language, ReadingStatus, WorkType } from '$lib/types/library';
import { findOrCreatePerson, parseTypedName } from '$lib/library/server/people-actions';
import { markProposalResolved, markProposalPending } from '$lib/library/server/proposal-actions';
import { ensureShelfMarkerNote } from '$lib/library/review';
import { parseIsbnWithChecksum } from '$lib/library/isbn';

/**
 * Server-side helpers for the books vertical slice. Both `/library` (list) and
 * `/library/books/[id]` (detail) host the same form actions; this module
 * shares the implementation so the per-route action handlers stay one-liners.
 *
 * Form-action result shape per `.cursor/rules/sveltekit-routes.mdc`:
 *   { kind, success?, message?, bookId? }
 *
 * Junction handling (book_authors) is diff-based: the form
 * submits the *new* desired state, the action diffs against current rows, and
 * emits INSERT + DELETE (and UPDATE for sort_order) accordingly.
 *
 * NOTE: payloads are typed as Record<string, unknown> for ergonomic form-data
 * parsing, then cast to `never` at the supabase-js boundary. supabase-js's
 * generic Insert/Update typings would otherwise require building the payload
 * as a literal of the generated DB shape, which fights the diff-based junction
 * sync. Pattern matches `src/routes/settings/audit-log/+page.server.ts`.
 */

export type ActionKind =
	| 'createBook'
	| 'updateBook'
	| 'softDeleteBook'
	| 'undoSoftDeleteBook'
	| 'createPerson'
	| 'reviewSaved'
	| 'reviewUndone'
	| 'markedNeedsShelf'
	| 'bulkUpdateBooks';

export type AuthorAssignmentInput = {
	person_id: string;
	role: AuthorRole;
	sort_order: number;
};

/** Parsed from `authors_json` — either a linked person or a raw name to resolve at save. */
export type AuthorFormEntry = {
	person_id?: string;
	name?: string;
	role: AuthorRole;
	sort_order: number;
};

export type BookFormPayload = {
	title: string | null;
	subtitle: string | null;
	publisher: string | null;
	publisher_location: string | null;
	publisher_id: string | null;
	reprint_publisher_id: string | null;
	year: number | null;
	edition: string | null;
	total_volumes: number | null;
	original_year: number | null;
	reprint_publisher: string | null;
	reprint_location: string | null;
	reprint_year: number | null;
	series_id: string | null;
	volume_number: string | null;
	copy_count: number;
	genre: Genre | null;
	work_type: WorkType;
	language: Language;
	isbn: string | null;
	barcode: string | null;
	shelving_location: string | null;
	reading_status: ReadingStatus;
	borrowed_to: string | null;
	personal_notes: string | null;
	rating: number | null;
	needs_review: boolean;
	needs_review_note: string | null;
	no_attributed_author: boolean;
	page_count: number | null;
	authors: AuthorFormEntry[];
};

/**
 * Important fields / missing-citation helpers — pure module
 * `$lib/library/missing-important` (client-safe). Re-export for save-time callers.
 */
export {
	IMPORTANT_FIELDS,
	computeMissingImportant,
	incompleteCitationCaption,
	type ImportantField,
	type MissingImportantAuthor
} from '$lib/library/missing-important';

const GENRE_SET: ReadonlySet<string> = new Set(GENRES);
const LANGUAGE_SET: ReadonlySet<string> = new Set(LANGUAGES);
const READING_STATUS_SET: ReadonlySet<string> = new Set(READING_STATUSES);
const AUTHOR_ROLE_SET: ReadonlySet<string> = new Set(AUTHOR_ROLES);
const WORK_TYPE_SET: ReadonlySet<string> = new Set(WORK_TYPES);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUuidOrNull(raw: FormDataEntryValue | null): string | null {
	const t = String(raw ?? '').trim();
	return t.length > 0 && UUID_RE.test(t) ? t : null;
}

function trimOrNull(raw: FormDataEntryValue | null): string | null {
	const t = String(raw ?? '').trim();
	return t.length > 0 ? t : null;
}

function parseInt0(raw: FormDataEntryValue | null): number | null {
	const t = String(raw ?? '').trim();
	if (t.length === 0) return null;
	const n = Number(t);
	if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
	if (n < 0 || n > 1_000_000) return null;
	return n;
}

function parseRating(raw: FormDataEntryValue | null): number | null {
	const t = String(raw ?? '').trim();
	if (t.length === 0) return null;
	const n = Number(t);
	if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 5) return null;
	return n;
}

function parseBoolean(raw: FormDataEntryValue | null): boolean {
	const t = String(raw ?? '')
		.trim()
		.toLowerCase();
	return t === 'true' || t === 'on' || t === '1';
}

/** Parse `authors_json` form/CSV cell; empty string → `[]`; invalid JSON/shape → `null`. */
export function parseAuthorsJsonString(
	raw: string | null | undefined
): AuthorFormEntry[] | null {
	const s = String(raw ?? '').trim();
	if (s.length === 0) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(s);
	} catch {
		return null;
	}
	if (!Array.isArray(parsed)) return null;
	const out: AuthorFormEntry[] = [];
	for (const item of parsed) {
		if (!item || typeof item !== 'object') return null;
		const r = item as Record<string, unknown>;
		const person_id = typeof r.person_id === 'string' ? r.person_id.trim() : '';
		const name = typeof r.name === 'string' ? r.name.trim() : '';
		const role = typeof r.role === 'string' ? r.role : '';
		const sort_order = Number(r.sort_order);
		if (!person_id && !name) continue;
		if (person_id && name) return null;
		if (!AUTHOR_ROLE_SET.has(role)) return null;
		if (!Number.isFinite(sort_order) || !Number.isInteger(sort_order)) return null;
		if (person_id) {
			out.push({ person_id, role: role as AuthorRole, sort_order });
		} else {
			out.push({ name, role: role as AuthorRole, sort_order });
		}
	}
	return out;
}

function parseAuthorsJson(raw: FormDataEntryValue | null): AuthorFormEntry[] | null {
	return parseAuthorsJsonString(String(raw ?? ''));
}

function authorEntryPresent(e: AuthorFormEntry, role: AuthorRole): boolean {
	if (e.role !== role) return false;
	if (e.person_id?.trim()) return true;
	return (e.name?.trim().length ?? 0) > 0;
}

async function resolveAuthorFormEntries(
	supabase: SupabaseClient,
	userId: string,
	entries: AuthorFormEntry[]
): Promise<{ ok: true; authors: AuthorAssignmentInput[] } | { ok: false; message: string }> {
	const resolved: AuthorAssignmentInput[] = [];
	for (const e of entries) {
		if (e.person_id?.trim()) {
			resolved.push({
				person_id: e.person_id.trim(),
				role: e.role,
				sort_order: e.sort_order
			});
			continue;
		}
		const name = e.name?.trim() ?? '';
		if (!name) continue;
		const parsed = parseTypedName(name);
		if (!parsed) {
			return { ok: false, message: `Could not parse author name "${name}".` };
		}
		try {
			const { personId } = await findOrCreatePerson(supabase, parsed, userId);
			resolved.push({ person_id: personId, role: e.role, sort_order: e.sort_order });
		} catch (err) {
			console.error(err);
			return {
				ok: false,
				message: err instanceof Error ? err.message : 'Could not create author.'
			};
		}
	}
	return { ok: true, authors: resolved };
}

export type ParseResult = { ok: true; payload: BookFormPayload } | { ok: false; message: string };

/**
 * Merge an auto-generated "Missing: …" review note with whatever the user
 * had previously written. If the existing note is empty or itself an old
 * auto-line, replace it. Otherwise prepend the new auto-line and keep the
 * user's text below.
 */
function mergeReviewNote(existing: string | null, autoLine: string | null): string | null {
	if (!autoLine) return existing;
	const trimmed = existing?.trim() ?? '';
	if (!trimmed || /^Missing:\s/.test(trimmed)) return autoLine;
	return `${autoLine}\n\n${existing}`;
}

/**
 * Inverse of `mergeReviewNote`: strip the auto-generated "Missing: …" line
 * (and the blank line beneath it) when the user has reviewed the row and
 * cleared the underlying issue. Preserves any user-authored portion verbatim.
 *
 * Cases:
 *   - null / whitespace → null
 *   - "Missing: …"            (auto-line only)            → null
 *   - "Missing: …\n\n<user>"  (auto-line + user portion)  → "<user>" (trimmed)
 *   - "<user>"                (no auto-line)              → "<user>" (unchanged)
 *
 * Used by `reviewSaveAction` (Session 5.5 review queue): the explicit-user-
 * reviewed contract overrides the auto-flag, so we strip the auto-line even
 * if the underlying field is still missing — keeping it would just re-flag
 * the row at the next regular `parseBookForm` save.
 */
export function stripReviewAutoLine(existing: string | null): string | null {
	const t = (existing ?? '').trim();
	if (t.length === 0) return null;
	// "Missing: …" + optional blank line + user portion. The auto-line is
	// always single-line so consume up to the first \n only.
	const m = t.match(/^Missing:\s[^\n]*(?:\r?\n\r?\n([\s\S]*))?$/);
	if (!m) return existing;
	const userPortion = (m[1] ?? '').trim();
	return userPortion.length > 0 ? userPortion : null;
}

export function parseBookForm(fd: FormData): ParseResult {
	const title = trimOrNull(fd.get('title'));
	if (title != null && title.length > 500) {
		return { ok: false, message: 'Title is too long (500 char max).' };
	}

	// genre is nullable per 20260428170000 — empty = unset; otherwise must be in the list.
	const genreRaw = String(fd.get('genre') ?? '').trim();
	const genre: string | null = genreRaw.length > 0 ? genreRaw : null;
	if (genre != null && !GENRE_SET.has(genre)) {
		return { ok: false, message: 'Pick a genre from the list.' };
	}

	const language = String(fd.get('language') ?? '').trim();
	if (!LANGUAGE_SET.has(language)) return { ok: false, message: 'Pick a language from the list.' };

	const reading_status = String(fd.get('reading_status') ?? '').trim();
	if (!READING_STATUS_SET.has(reading_status))
		return { ok: false, message: 'Pick a reading status from the list.' };

	const work_type = String(fd.get('work_type') ?? 'monograph').trim();
	if (!WORK_TYPE_SET.has(work_type)) {
		return { ok: false, message: 'Pick a work type from the list.' };
	}

	const year = parseInt0(fd.get('year'));
	const total_volumes = parseInt0(fd.get('total_volumes'));
	const original_year = parseInt0(fd.get('original_year'));
	const reprint_year = parseInt0(fd.get('reprint_year'));
	const page_count = parseInt0(fd.get('page_count'));
	const rating = parseRating(fd.get('rating'));

	const authors = parseAuthorsJson(fd.get('authors_json'));
	if (authors == null) {
		return { ok: false, message: 'Authors payload is malformed.' };
	}
	const seen = new Set<string>();
	for (const a of authors) {
		if (!a.person_id?.trim()) continue;
		const key = `${a.person_id}|${a.role}`;
		if (seen.has(key)) {
			return {
				ok: false,
				message: 'Same person cannot be listed twice in the same role.'
			};
		}
		seen.add(key);
	}

	const subtitle = trimOrNull(fd.get('subtitle'));
	const publisher = trimOrNull(fd.get('publisher'));
	const publisher_location = trimOrNull(fd.get('publisher_location'));
	const publisher_id = parseUuidOrNull(fd.get('publisher_id'));
	const reprint_publisher_id = parseUuidOrNull(fd.get('reprint_publisher_id'));
	const edition = trimOrNull(fd.get('edition'));
	const reprint_publisher = trimOrNull(fd.get('reprint_publisher'));
	const reprint_location = trimOrNull(fd.get('reprint_location'));
	const series_id = trimOrNull(fd.get('series_id'));
	const volume_number = trimOrNull(fd.get('volume_number'));
	const copy_count_raw = parseInt0(fd.get('copy_count'));
	const copy_count =
		copy_count_raw == null || copy_count_raw < 1
			? 1
			: copy_count_raw > 99
				? 99
				: copy_count_raw;
	const isbn = trimOrNull(fd.get('isbn'));
	const barcode = trimOrNull(fd.get('barcode'));
	const shelving_location = trimOrNull(fd.get('shelving_location'));
	const borrowed_to = trimOrNull(fd.get('borrowed_to'));
	const personal_notes = trimOrNull(fd.get('personal_notes'));
	const userNeedsReview = parseBoolean(fd.get('needs_review'));
	const userReviewNote = trimOrNull(fd.get('needs_review_note'));
	const no_attributed_author = parseBoolean(fd.get('no_attributed_author'));

	// Save bar: at least one field (any identifying scalar OR a relation).
	// Defaults like language='english' / reading_status='unread' / needs_review=false
	// don't count — they're always present.
	const hasAnyField =
		title != null ||
		subtitle != null ||
		publisher != null ||
		publisher_location != null ||
		publisher_id != null ||
		reprint_publisher_id != null ||
		year != null ||
		edition != null ||
		total_volumes != null ||
		original_year != null ||
		reprint_publisher != null ||
		reprint_location != null ||
		reprint_year != null ||
		volume_number != null ||
		isbn != null ||
		barcode != null ||
		shelving_location != null ||
		borrowed_to != null ||
		personal_notes != null ||
		page_count != null ||
		rating != null ||
		userReviewNote != null ||
		userNeedsReview ||
		genre != null ||
		series_id != null ||
		authors.length > 0;
	if (!hasAnyField) {
		return {
			ok: false,
			message: 'Add at least one detail (title, ISBN, an author, anything) before saving.'
		};
	}

	// Auto-flag for review when important identifying/citation fields are
	// missing. The eventual review queue (Tracker_1 Session 6) consumes this.
	const missingImportant = computeMissingImportant({
		title,
		genre,
		work_type: work_type as WorkType,
		year,
		publisher,
		authors,
		no_attributed_author
	});
	const autoLine = missingImportant.length > 0 ? `Missing: ${missingImportant.join(', ')}` : null;
	const finalNeedsReview = userNeedsReview || missingImportant.length > 0;
	const finalReviewNote = mergeReviewNote(userReviewNote, autoLine);

	return {
		ok: true,
		payload: {
			title,
			subtitle,
			publisher,
			publisher_location,
			publisher_id,
			reprint_publisher_id,
			year,
			edition,
			total_volumes,
			original_year,
			reprint_publisher,
			reprint_location,
			reprint_year,
			series_id,
			volume_number,
			copy_count,
			genre: genre as Genre | null,
			work_type: work_type as WorkType,
			language: language as Language,
			isbn,
			barcode,
			shelving_location,
			reading_status: reading_status as ReadingStatus,
			borrowed_to,
			personal_notes,
			rating,
			needs_review: finalNeedsReview,
			needs_review_note: finalReviewNote,
			no_attributed_author,
			page_count,
			authors
		}
	};
}

function bookColumnsPayload(p: BookFormPayload): Record<string, unknown> {
	return {
		title: p.title,
		subtitle: p.subtitle,
		publisher: p.publisher,
		publisher_location: p.publisher_location,
		publisher_id: p.publisher_id,
		reprint_publisher_id: p.reprint_publisher_id,
		year: p.year,
		edition: p.edition,
		total_volumes: p.total_volumes,
		original_year: p.original_year,
		reprint_publisher: p.reprint_publisher,
		reprint_location: p.reprint_location,
		reprint_year: p.reprint_year,
		series_id: p.series_id,
		volume_number: p.volume_number,
		copy_count: p.copy_count,
		genre: p.genre,
		work_type: p.work_type,
		language: p.language,
		isbn: p.isbn,
		barcode: p.barcode,
		shelving_location: p.shelving_location,
		reading_status: p.reading_status,
		borrowed_to: p.borrowed_to,
		personal_notes: p.personal_notes,
		rating: p.rating,
		needs_review: p.needs_review,
		needs_review_note: p.needs_review_note,
		no_attributed_author: p.no_attributed_author,
		page_count: p.page_count
	};
}

async function syncAuthors(
	supabase: SupabaseClient,
	bookId: string,
	desired: AuthorAssignmentInput[]
): Promise<{ ok: true } | { ok: false; message: string }> {
	const { data: existing, error: fetchErr } = await supabase
		.from('book_authors')
		.select('person_id, role, sort_order')
		.eq('book_id', bookId);
	if (fetchErr) {
		return { ok: false, message: fetchErr.message ?? 'Could not load authors.' };
	}

	const currentMap = new Map<string, { sort_order: number }>();
	for (const r of existing ?? []) {
		const key = `${r.person_id as string}|${r.role as string}`;
		currentMap.set(key, { sort_order: Number(r.sort_order) });
	}
	const desiredMap = new Map<string, AuthorAssignmentInput>();
	for (const a of desired) {
		desiredMap.set(`${a.person_id}|${a.role}`, a);
	}

	const toInsert: AuthorAssignmentInput[] = [];
	const toUpdate: AuthorAssignmentInput[] = [];
	for (const [key, a] of desiredMap) {
		const c = currentMap.get(key);
		if (!c) toInsert.push(a);
		else if (c.sort_order !== a.sort_order) toUpdate.push(a);
	}
	const toDelete: { person_id: string; role: AuthorRole }[] = [];
	for (const [key] of currentMap) {
		if (!desiredMap.has(key)) {
			const [person_id, role] = key.split('|');
			toDelete.push({ person_id, role: role as AuthorRole });
		}
	}

	for (const d of toDelete) {
		const { error } = await supabase
			.from('book_authors')
			.delete()
			.eq('book_id', bookId)
			.eq('person_id', d.person_id)
			.eq('role', d.role);
		if (error) return { ok: false, message: error.message ?? 'Author remove failed.' };
	}
	for (const u of toUpdate) {
		const { error } = await supabase
			.from('book_authors')
			.update({ sort_order: u.sort_order })
			.eq('book_id', bookId)
			.eq('person_id', u.person_id)
			.eq('role', u.role);
		if (error) return { ok: false, message: error.message ?? 'Author reorder failed.' };
	}
	if (toInsert.length > 0) {
		const rows = toInsert.map((a) => ({
			book_id: bookId,
			person_id: a.person_id,
			role: a.role,
			sort_order: a.sort_order
		}));
		const { error } = await supabase.from('book_authors').insert(rows);
		if (error) return { ok: false, message: error.message ?? 'Author add failed.' };
	}
	return { ok: true };
}

export async function ensureNoIsbnCollision(
	supabase: SupabaseClient,
	isbn: string | null,
	excludeId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
	if (!isbn) return { ok: true };
	let q = supabase.from('books').select('id, title').eq('isbn', isbn).is('deleted_at', null);
	if (excludeId) q = q.neq('id', excludeId);
	const { data, error } = await q.maybeSingle();
	if (error) {
		// PGRST116 = multiple rows; treat as collision.
		if (error.code === 'PGRST116') {
			return { ok: false, message: `ISBN ${isbn} is already attached to another book.` };
		}
		return { ok: false, message: error.message ?? 'ISBN check failed.' };
	}
	if (data) {
		return {
			ok: false,
			message: `ISBN ${isbn} is already attached to "${(data.title as string) ?? 'another book'}".`
		};
	}
	return { ok: true };
}

export type ApplyBookPayloadOptions = {
	/** When true, skip `syncAuthors` (CSV reimport without an `authors_json` cell on update). */
	skipAuthorSync?: boolean;
};

export type ApplyBookPayloadResult =
	| { ok: true; bookId: string }
	| { ok: false; message: string; bookId?: string };

/**
 * Shared insert/update path for forms and CSV import: ISBN check, book row,
 * junction sync. Viewer B1/B2 strip applies on update.
 */
export async function applyBookPayload(
	supabase: SupabaseClient,
	userId: string,
	opts:
		| { mode: 'create'; payload: BookFormPayload; options?: ApplyBookPayloadOptions }
		| {
				mode: 'update';
				bookId: string;
				payload: BookFormPayload;
				options?: ApplyBookPayloadOptions;
		  }
): Promise<ApplyBookPayloadResult> {
	const skipAuthorSync = opts.options?.skipAuthorSync === true;
	const collide = await ensureNoIsbnCollision(
		supabase,
		opts.payload.isbn,
		opts.mode === 'update' ? opts.bookId : null
	);
	if (!collide.ok) return { ok: false, message: collide.message };

	if (opts.mode === 'create') {
		const insertPayload = {
			...bookColumnsPayload(opts.payload),
			created_by: userId
		};
		const { data: inserted, error: insErr } = await supabase
			.from('books')
			.insert(insertPayload as never)
			.select('id')
			.single();
		if (insErr || !inserted) {
			console.error(insErr);
			return { ok: false, message: insErr?.message ?? 'Could not create book.' };
		}
		const bookId = inserted.id as string;
		if (!skipAuthorSync) {
			const resolved = await resolveAuthorFormEntries(supabase, userId, opts.payload.authors);
			if (!resolved.ok) return { ok: false, bookId, message: resolved.message };
			const auth = await syncAuthors(supabase, bookId, resolved.authors);
			if (!auth.ok) return { ok: false, bookId, message: auth.message };
		}
		return { ok: true, bookId };
	}

	const id = opts.bookId;
	const { data: existing, error: fetchErr } = await supabase
		.from('books')
		.select('id')
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (fetchErr || !existing) {
		return { ok: false, bookId: id, message: 'Book not found.' };
	}

	const { data: profileRow } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', userId)
		.maybeSingle();
	const isOwner = (profileRow?.role as string | null) === 'owner';
	const payload = bookColumnsPayload(opts.payload);
	if (!isOwner) {
		delete payload.personal_notes;
		delete payload.rating;
	}

	const { error: updErr } = await supabase
		.from('books')
		.update(payload as never)
		.eq('id', id);
	if (updErr) {
		console.error(updErr);
		return { ok: false, bookId: id, message: updErr.message ?? 'Could not update book.' };
	}

	if (!skipAuthorSync) {
		const resolved = await resolveAuthorFormEntries(supabase, userId, opts.payload.authors);
		if (!resolved.ok) return { ok: false, bookId: id, message: resolved.message };
		const auth = await syncAuthors(supabase, id, resolved.authors);
		if (!auth.ok) return { ok: false, bookId: id, message: auth.message };
	}
	return { ok: true, bookId: id };
}

export async function createBookAction(supabase: SupabaseClient, userId: string, fd: FormData) {
	const parsed = parseBookForm(fd);
	if (!parsed.ok) return fail(400, { kind: 'createBook' as const, message: parsed.message });

	const applied = await applyBookPayload(supabase, userId, {
		mode: 'create',
		payload: parsed.payload
	});
	if (!applied.ok) {
		const kind = 'createBook' as const;
		if (applied.bookId)
			return fail(500, { kind, bookId: applied.bookId, message: applied.message });
		return fail(applied.message.includes('ISBN') ? 400 : 500, { kind, message: applied.message });
	}

	const autoBibleBook = String(fd.get('auto_bible_book') ?? '').trim();
	if (autoBibleBook && applied.bookId) {
		const { data: bbRow, error: bbErr } = await supabase
			.from('bible_books')
			.select('name')
			.eq('name', autoBibleBook)
			.maybeSingle();
		if (bbErr) {
			console.error('[createBook] bible_books lookup', bbErr);
		} else if (bbRow) {
			const { error: covErr } = await supabase.from('book_bible_coverage').insert({
				book_id: applied.bookId,
				bible_book: autoBibleBook,
				essay_id: null,
				created_by: userId
			} as never);
			if (covErr) console.error('[createBook] coverage insert', covErr);
		}
	}

	return { kind: 'createBook' as const, bookId: applied.bookId, success: true as const };
}

export async function updateBookAction(supabase: SupabaseClient, userId: string, fd: FormData) {
	const id = String(fd.get('id') ?? '').trim();
	if (!id) return fail(400, { kind: 'updateBook' as const, message: 'Missing book id.' });

	const parsed = parseBookForm(fd);
	if (!parsed.ok)
		return fail(400, { kind: 'updateBook' as const, bookId: id, message: parsed.message });

	const applied = await applyBookPayload(supabase, userId, {
		mode: 'update',
		bookId: id,
		payload: parsed.payload
	});
	if (!applied.ok) {
		const kind = 'updateBook' as const;
		if (applied.message === 'Book not found.') {
			return fail(404, { kind, bookId: id, message: applied.message });
		}
		if (applied.message.includes('ISBN')) {
			return fail(400, { kind, bookId: id, message: applied.message });
		}
		return fail(500, { kind, bookId: id, message: applied.message });
	}

	return { kind: 'updateBook' as const, bookId: id, success: true as const };
}

export async function softDeleteBookAction(supabase: SupabaseClient, fd: FormData) {
	const id = String(fd.get('id') ?? '').trim();
	if (!id) return fail(400, { kind: 'softDeleteBook' as const, message: 'Missing book id.' });

	const { error } = await supabase
		.from('books')
		.update({ deleted_at: new Date().toISOString() })
		.eq('id', id);
	if (error) {
		console.error(error);
		return fail(500, {
			kind: 'softDeleteBook' as const,
			bookId: id,
			message: error.message ?? 'Could not delete book.'
		});
	}
	return { kind: 'softDeleteBook' as const, bookId: id, success: true as const };
}

export async function updateReadingStatusAction(supabase: SupabaseClient, fd: FormData) {
	const id = String(fd.get('id') ?? '').trim();
	if (!id) return fail(400, { kind: 'updateReadingStatus' as const, message: 'Missing book id.' });

	const status = String(fd.get('reading_status') ?? '').trim();
	if (!READING_STATUS_SET.has(status)) {
		return fail(400, {
			kind: 'updateReadingStatus' as const,
			bookId: id,
			message: 'Invalid reading status.'
		});
	}

	const { error } = await supabase
		.from('books')
		.update({ reading_status: status })
		.eq('id', id)
		.is('deleted_at', null);

	if (error) {
		console.error(error);
		return fail(500, {
			kind: 'updateReadingStatus' as const,
			bookId: id,
			message: error.message ?? 'Could not update reading status.'
		});
	}

	return {
		kind: 'updateReadingStatus' as const,
		bookId: id,
		readingStatus: status,
		success: true as const
	};
}

/**
 * Owner-only patch for `rating` and/or `personal_notes` from the book detail
 * card (B1/B2). Include a field in FormData only when it should change —
 * `rating` may be empty string to clear; omit the key to leave unchanged.
 */
export async function updateBookPersonalFieldsAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const id = String(fd.get('id') ?? '').trim();
	if (!id) {
		return fail(400, { kind: 'updateBookPersonalFields' as const, message: 'Missing book id.' });
	}

	const { data: profileRow } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', userId)
		.maybeSingle();
	if ((profileRow?.role as string | null) !== 'owner') {
		return fail(403, {
			kind: 'updateBookPersonalFields' as const,
			bookId: id,
			message: 'Only the owner can edit rating and personal notes.'
		});
	}

	const patch: { rating?: number | null; personal_notes?: string | null } = {};
	if (fd.has('rating')) {
		const raw = String(fd.get('rating') ?? '').trim();
		if (raw.length === 0) {
			patch.rating = null;
		} else {
			const n = parseRating(fd.get('rating'));
			if (n == null) {
				return fail(400, {
					kind: 'updateBookPersonalFields' as const,
					bookId: id,
					message: 'Rating must be 1–5 (or empty to clear).'
				});
			}
			patch.rating = n;
		}
	}
	if (fd.has('personal_notes')) {
		patch.personal_notes = trimOrNull(fd.get('personal_notes'));
	}
	if (Object.keys(patch).length === 0) {
		return fail(400, {
			kind: 'updateBookPersonalFields' as const,
			bookId: id,
			message: 'Nothing to update.'
		});
	}

	const { error } = await supabase
		.from('books')
		.update(patch as never)
		.eq('id', id)
		.is('deleted_at', null);

	if (error) {
		console.error(error);
		return fail(500, {
			kind: 'updateBookPersonalFields' as const,
			bookId: id,
			message: error.message ?? 'Could not update personal fields.'
		});
	}

	return {
		kind: 'updateBookPersonalFields' as const,
		bookId: id,
		success: true as const,
		rating: 'rating' in patch ? (patch.rating ?? null) : undefined,
		personal_notes: 'personal_notes' in patch ? (patch.personal_notes ?? null) : undefined
	};
}

const BULK_UPDATE_MAX_BOOKS = 150;

/**
 * Updates `language`, `reading_status`, and/or `genre` on many live books, and
 * optionally adds a `book_bible_coverage` row (bible book commentary coverage)
 * for each selected volume. Empty select values mean "don't change" (UI sends
 * "" for untouched fields — no `bulk_apply_*` checkboxes).
 */
export async function bulkUpdateBooksAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const idsRaw = String(fd.get('book_ids_json') ?? '').trim();
	let ids: string[];
	try {
		const parsed: unknown = JSON.parse(idsRaw);
		if (!Array.isArray(parsed)) {
			return fail(400, { kind: 'bulkUpdateBooks' as const, message: 'Invalid book id list.' });
		}
		ids = parsed.filter(
			(x): x is string =>
				typeof x === 'string' &&
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x)
		);
	} catch {
		return fail(400, { kind: 'bulkUpdateBooks' as const, message: 'Invalid book id list.' });
	}
	const unique = [...new Set(ids)];
	if (unique.length === 0) {
		return fail(400, { kind: 'bulkUpdateBooks' as const, message: 'Select at least one book.' });
	}
	if (unique.length > BULK_UPDATE_MAX_BOOKS) {
		return fail(400, {
			kind: 'bulkUpdateBooks' as const,
			message: `You can update at most ${BULK_UPDATE_MAX_BOOKS} books at once.`
		});
	}

	const language = String(fd.get('bulk_language') ?? '').trim();
	const reading_status = String(fd.get('bulk_reading_status') ?? '').trim();
	const genre = String(fd.get('bulk_genre') ?? '').trim();
	const bibleBookRaw = String(fd.get('bulk_bible_book') ?? '').trim();

	const patch: Record<string, string> = {};
	if (language) {
		if (!LANGUAGE_SET.has(language)) {
			return fail(400, { kind: 'bulkUpdateBooks' as const, message: 'Pick a valid language.' });
		}
		patch.language = language;
	}
	if (reading_status) {
		if (!READING_STATUS_SET.has(reading_status)) {
			return fail(400, {
				kind: 'bulkUpdateBooks' as const,
				message: 'Pick a valid reading status.'
			});
		}
		patch.reading_status = reading_status;
	}
	if (genre) {
		if (!GENRE_SET.has(genre)) {
			return fail(400, { kind: 'bulkUpdateBooks' as const, message: 'Pick a valid genre.' });
		}
		patch.genre = genre;
	}

	let bibleBookToAdd: string | null = null;
	if (bibleBookRaw) {
		const { data: bbRows, error: bbListErr } = await supabase.from('bible_books').select('name');
		if (bbListErr) {
			console.error(bbListErr);
			return fail(500, {
				kind: 'bulkUpdateBooks' as const,
				message: bbListErr.message ?? 'Could not validate bible book.'
			});
		}
		const valid = new Set((bbRows ?? []).map((r) => (r as { name: string }).name));
		if (!valid.has(bibleBookRaw)) {
			return fail(400, { kind: 'bulkUpdateBooks' as const, message: 'Pick a valid bible book.' });
		}
		bibleBookToAdd = bibleBookRaw;
	}

	if (Object.keys(patch).length === 0 && bibleBookToAdd == null) {
		return fail(400, {
			kind: 'bulkUpdateBooks' as const,
			message: 'Choose at least one field to change.'
		});
	}

	const CHUNK = 50;
	for (let i = 0; i < unique.length; i += CHUNK) {
		const slice = unique.slice(i, i + CHUNK);
		if (Object.keys(patch).length > 0) {
			const { error } = await supabase
				.from('books')
				.update(patch as never)
				.in('id', slice)
				.is('deleted_at', null);
			if (error) {
				console.error(error);
				return fail(500, {
					kind: 'bulkUpdateBooks' as const,
					message: error.message ?? 'Could not update some books.'
				});
			}
		}
	}
	if (bibleBookToAdd != null) {
		for (let i = 0; i < unique.length; i += CHUNK) {
			const slice = unique.slice(i, i + CHUNK);
			const { data: existing, error: exErr } = await supabase
				.from('book_bible_coverage')
				.select('book_id')
				.in('book_id', slice)
				.eq('bible_book', bibleBookToAdd);
			if (exErr) {
				console.error(exErr);
				return fail(500, {
					kind: 'bulkUpdateBooks' as const,
					message: exErr.message ?? 'Could not check existing coverage.'
				});
			}
			const have = new Set(
				(existing ?? [])
					.map((r) => (r as { book_id: string | null }).book_id)
					.filter((id): id is string => id != null)
			);
			const missing = slice.filter((id) => !have.has(id));
			if (missing.length === 0) continue;
			const rows = missing.map((book_id) => ({
				book_id,
				bible_book: bibleBookToAdd,
				essay_id: null,
				created_by: userId
			}));
			const { error: insErr } = await supabase.from('book_bible_coverage').insert(rows as never);
			if (insErr) {
				console.error(insErr);
				return fail(500, {
					kind: 'bulkUpdateBooks' as const,
					message: insErr.message ?? 'Could not add bible book coverage for some books.'
				});
			}
		}
	}

	return {
		kind: 'bulkUpdateBooks' as const,
		updatedCount: unique.length,
		success: true as const
	};
}

export async function undoSoftDeleteBookAction(supabase: SupabaseClient, fd: FormData) {
	const id = String(fd.get('id') ?? '').trim();
	if (!id) return fail(400, { kind: 'undoSoftDeleteBook' as const, message: 'Missing book id.' });

	const { error } = await supabase.from('books').update({ deleted_at: null }).eq('id', id);
	if (error) {
		console.error(error);
		return fail(500, {
			kind: 'undoSoftDeleteBook' as const,
			bookId: id,
			message: error.message ?? 'Could not restore book.'
		});
	}
	return { kind: 'undoSoftDeleteBook' as const, bookId: id, success: true as const };
}

export async function createPersonAction(supabase: SupabaseClient, userId: string, fd: FormData) {
	const last_name = String(fd.get('last_name') ?? '').trim();
	if (!last_name)
		return fail(400, { kind: 'createPerson' as const, message: 'Last name is required.' });
	if (last_name.length > 200)
		return fail(400, { kind: 'createPerson' as const, message: 'Last name is too long.' });

	const first_name = trimOrNull(fd.get('first_name'));
	const middle_name = trimOrNull(fd.get('middle_name'));
	const suffix = trimOrNull(fd.get('suffix'));

	const insertPayload = {
		last_name,
		first_name,
		middle_name,
		suffix,
		created_by: userId
	};

	const { data: inserted, error } = await supabase
		.from('people')
		.insert(insertPayload as never)
		.select('id, first_name, last_name')
		.single();
	if (error || !inserted) {
		console.error(error);
		return fail(500, {
			kind: 'createPerson' as const,
			message: error?.message ?? 'Could not create person.'
		});
	}
	return {
		kind: 'createPerson' as const,
		personId: inserted.id as string,
		success: true as const
	};
}

/**
 * Focused server action for the `/library/review` card-stack queue (Session
 * 5.5). The contract differs from `parseBookForm` + `updateBookAction` in
 * three deliberate ways:
 *
 * 1. **Partial overlay only.** Only the fields the card surfaces (`title`,
 *    `year`, `publisher`, `publisher_location`, `publisher_id`, `genre`,
 *    `work_type`, `language`, `reading_status`, `no_attributed_author`) are read
 *    from FormData and merged onto the existing row. Everything else stays
 *    byte-identical — no junctions, no `personal_notes`, no `rating`.
 * 2. **`needs_review = false` is unconditional.** The user explicitly
 *    reviewed the row; that overrides the missing-fields auto-flag. If
 *    `computeMissingImportant` still returns entries, the auto-line is
 *    STRIPPED (not refreshed) — the user has acknowledged the gaps.
 * 3. **B1/B2 strip is no-op in practice** because the card never exposes
 *    `personal_notes` / `rating`, but kept defensively in line with
 *    `updateBookAction`.
 */
export async function reviewSaveAction(supabase: SupabaseClient, userId: string, fd: FormData) {
	const id = String(fd.get('id') ?? '').trim();
	if (!id) return fail(400, { kind: 'reviewSaved' as const, message: 'Missing book id.' });

	const { data: existingRow, error: fetchErr } = await supabase
		.from('books')
		.select(
			'id, title, year, publisher, publisher_location, publisher_id, genre, work_type, language, reading_status, needs_review_note, no_attributed_author, isbn, deleted_at'
		)
		.eq('id', id)
		.maybeSingle();
	if (fetchErr || !existingRow) {
		return fail(404, {
			kind: 'reviewSaved' as const,
			bookId: id,
			message: 'Book not found.'
		});
	}
	const ex = existingRow as {
		id: string;
		title: string | null;
		year: number | null;
		publisher: string | null;
		publisher_location: string | null;
		publisher_id: string | null;
		genre: string | null;
		work_type: string;
		language: string;
		reading_status: string;
		needs_review_note: string | null;
		no_attributed_author: boolean;
		isbn: string | null;
		deleted_at: string | null;
	};
	if (ex.deleted_at) {
		return fail(404, {
			kind: 'reviewSaved' as const,
			bookId: id,
			message: 'Book was deleted.'
		});
	}

	const title = trimOrNull(fd.get('title')) ?? ex.title;
	const publisher = trimOrNull(fd.get('publisher')) ?? ex.publisher;
	const publisher_location =
		fd.get('publisher_location') !== null
			? trimOrNull(fd.get('publisher_location'))
			: ex.publisher_location;
	const publisher_id =
		fd.get('publisher_id') !== null ? parseUuidOrNull(fd.get('publisher_id')) : ex.publisher_id;
	const yearRaw = fd.get('year');
	const year =
		yearRaw === null
			? ex.year
			: (parseInt0(yearRaw) ?? (String(yearRaw).trim() === '' ? null : ex.year));

	const genreRaw = fd.get('genre');
	let genre: string | null = ex.genre;
	if (genreRaw !== null) {
		const t = String(genreRaw).trim();
		if (t === '') genre = null;
		else if (GENRE_SET.has(t)) genre = t;
		else
			return fail(400, {
				kind: 'reviewSaved' as const,
				bookId: id,
				message: 'Pick a genre from the list.'
			});
	}

	const langRaw = fd.get('language');
	let language: string = ex.language;
	if (langRaw !== null) {
		const t = String(langRaw).trim();
		if (!LANGUAGE_SET.has(t))
			return fail(400, {
				kind: 'reviewSaved' as const,
				bookId: id,
				message: 'Pick a language from the list.'
			});
		language = t;
	}

	const statusRaw = fd.get('reading_status');
	let reading_status: string = ex.reading_status;
	if (statusRaw !== null) {
		const t = String(statusRaw).trim();
		if (!READING_STATUS_SET.has(t))
			return fail(400, {
				kind: 'reviewSaved' as const,
				bookId: id,
				message: 'Pick a reading status from the list.'
			});
		reading_status = t;
	}

	const noAttributedRaw = fd.get('no_attributed_author');
	const no_attributed_author =
		noAttributedRaw !== null ? parseBoolean(noAttributedRaw) : ex.no_attributed_author;

	const workTypeRaw = fd.get('work_type');
	let workType: WorkType =
		ex.work_type === 'edited_volume' || ex.work_type === 'reference_work'
			? ex.work_type
			: 'monograph';
	if (workTypeRaw !== null) {
		const t = String(workTypeRaw).trim();
		if (!WORK_TYPE_SET.has(t))
			return fail(400, {
				kind: 'reviewSaved' as const,
				bookId: id,
				message: 'Pick a work type from the list.'
			});
		workType = t as WorkType;
	}

	const isbnRaw = fd.get('isbn');
	let isbn: string | null = ex.isbn;
	if (isbnRaw !== null) {
		const t = String(isbnRaw).trim();
		if (t === '') isbn = null;
		else {
			const parsed = parseIsbnWithChecksum(t);
			if (!parsed) {
				return fail(400, {
					kind: 'reviewSaved' as const,
					bookId: id,
					message: 'Enter a valid ISBN-10 or ISBN-13.'
				});
			}
			isbn = parsed;
		}
	}
	const isbnCollide = await ensureNoIsbnCollision(supabase, isbn, id);
	if (!isbnCollide.ok) {
		return fail(400, {
			kind: 'reviewSaved' as const,
			bookId: id,
			message: isbnCollide.message
		});
	}

	// Contributor-presence for Missing: computation (author vs editor by work_type).
	const contributorRole = workType === 'monograph' ? 'author' : 'editor';
	const { count: contributorCount } = await supabase
		.from('book_authors')
		.select('*', { count: 'exact', head: true })
		.eq('book_id', id)
		.eq('role', contributorRole);
	const authorsForCheck: AuthorFormEntry[] =
		(contributorCount ?? 0) > 0
			? [{ person_id: '_synthetic_', role: contributorRole, sort_order: 0 }]
			: [];

	// Recompute, but the contract is: needs_review = false REGARDLESS of
	// missing fields. The user just reviewed the card. Strip the auto-line.
	void computeMissingImportant({
		title,
		genre,
		work_type: workType,
		year,
		publisher,
		authors: authorsForCheck,
		no_attributed_author
	});
	const needs_review_note = stripReviewAutoLine(ex.needs_review_note);

	// B1/B2 strip — owner-only writes touch personal_notes/rating; the card
	// doesn't expose them so this is defensive.
	const { data: profileRow } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', userId)
		.maybeSingle();
	const isOwner = (profileRow?.role as string | null) === 'owner';
	void isOwner; // payload below already excludes those columns; kept for parity with updateBookAction

	const payload: Record<string, unknown> = {
		title,
		year,
		publisher,
		publisher_location,
		publisher_id,
		genre,
		language,
		reading_status,
		needs_review: false,
		needs_review_note,
		no_attributed_author,
		work_type: workType,
		isbn
	};

	const { error: updErr } = await supabase
		.from('books')
		.update(payload as never)
		.eq('id', id);
	if (updErr) {
		console.error(updErr);
		return fail(500, {
			kind: 'reviewSaved' as const,
			bookId: id,
			message: updErr.message ?? 'Could not save review.'
		});
	}

	// AI research pass (068): the card sends the pending proposal id plus how
	// the user treated it — 'accepted' when at least one proposed value was
	// applied, 'rejected' otherwise. Resolution is best-effort: the book save
	// already succeeded, so a proposal-update failure only logs (the unique
	// pending index means a stale pending row just resurfaces next visit).
	const proposalId = parseUuidOrNull(fd.get('proposal_id'));
	const resolutionRaw = String(fd.get('proposal_resolution') ?? '').trim();
	if (proposalId && (resolutionRaw === 'accepted' || resolutionRaw === 'rejected')) {
		const err = await markProposalResolved(supabase, proposalId, resolutionRaw, id);
		if (err) console.error('[reviewSaveAction proposal]', err.message);
	}

	return { kind: 'reviewSaved' as const, bookId: id, success: true as const };
}

/**
 * Defer a review card to the physical-shelf deck — keeps `needs_review = true`
 * and appends a shelf marker to `needs_review_note` when absent.
 */
export async function markNeedsShelfAction(supabase: SupabaseClient, fd: FormData) {
	const id = String(fd.get('id') ?? '').trim();
	if (!id) return fail(400, { kind: 'markedNeedsShelf' as const, message: 'Missing book id.' });

	const { data: existingRow, error: fetchErr } = await supabase
		.from('books')
		.select('id, needs_review_note, deleted_at')
		.eq('id', id)
		.maybeSingle();
	if (fetchErr || !existingRow) {
		return fail(404, {
			kind: 'markedNeedsShelf' as const,
			bookId: id,
			message: 'Book not found.'
		});
	}
	const ex = existingRow as {
		id: string;
		needs_review_note: string | null;
		deleted_at: string | null;
	};
	if (ex.deleted_at) {
		return fail(404, {
			kind: 'markedNeedsShelf' as const,
			bookId: id,
			message: 'Book was deleted.'
		});
	}

	const needs_review_note = ensureShelfMarkerNote(ex.needs_review_note);
	const { error: updErr } = await supabase
		.from('books')
		.update({ needs_review: true, needs_review_note } as never)
		.eq('id', id);
	if (updErr) {
		console.error(updErr);
		return fail(500, {
			kind: 'markedNeedsShelf' as const,
			bookId: id,
			message: updErr.message ?? 'Could not mark as shelf-bound.'
		});
	}

	return { kind: 'markedNeedsShelf' as const, bookId: id, success: true as const };
}

/**
 * Undo the most recent review-queue Confirm — restore the pre-save book snapshot
 * and re-flag `needs_review`. Best-effort proposal reset when the confirm had
 * resolved a pending proposal.
 */
export async function undoReviewSaveAction(supabase: SupabaseClient, fd: FormData) {
	const id = String(fd.get('id') ?? '').trim();
	if (!id) return fail(400, { kind: 'reviewUndone' as const, message: 'Missing book id.' });

	const { data: existingRow, error: fetchErr } = await supabase
		.from('books')
		.select('id, deleted_at')
		.eq('id', id)
		.maybeSingle();
	if (fetchErr || !existingRow) {
		return fail(404, {
			kind: 'reviewUndone' as const,
			bookId: id,
			message: 'Book not found.'
		});
	}
	const ex = existingRow as { id: string; deleted_at: string | null };
	if (ex.deleted_at) {
		return fail(404, {
			kind: 'reviewUndone' as const,
			bookId: id,
			message: 'Book was deleted.'
		});
	}

	const title = trimOrNull(fd.get('title'));
	const publisher = trimOrNull(fd.get('publisher'));
	const publisher_location = trimOrNull(fd.get('publisher_location'));
	const publisher_id = parseUuidOrNull(fd.get('publisher_id'));

	const yearRaw = fd.get('year');
	let year: number | null = null;
	if (yearRaw !== null) {
		const t = String(yearRaw).trim();
		if (t !== '') {
			const parsed = parseInt0(yearRaw);
			if (parsed === null)
				return fail(400, {
					kind: 'reviewUndone' as const,
					bookId: id,
					message: 'Invalid year in undo snapshot.'
				});
			year = parsed;
		}
	}

	const genreRaw = fd.get('genre');
	let genre: string | null = null;
	if (genreRaw !== null) {
		const t = String(genreRaw).trim();
		if (t === '') genre = null;
		else if (GENRE_SET.has(t)) genre = t;
		else
			return fail(400, {
				kind: 'reviewUndone' as const,
				bookId: id,
				message: 'Invalid genre in undo snapshot.'
			});
	}

	const langRaw = fd.get('language');
	if (langRaw === null)
		return fail(400, {
			kind: 'reviewUndone' as const,
			bookId: id,
			message: 'Missing language in undo snapshot.'
		});
	const language = String(langRaw).trim();
	if (!LANGUAGE_SET.has(language))
		return fail(400, {
			kind: 'reviewUndone' as const,
			bookId: id,
			message: 'Invalid language in undo snapshot.'
		});

	const statusRaw = fd.get('reading_status');
	if (statusRaw === null)
		return fail(400, {
			kind: 'reviewUndone' as const,
			bookId: id,
			message: 'Missing reading status in undo snapshot.'
		});
	const reading_status = String(statusRaw).trim();
	if (!READING_STATUS_SET.has(reading_status))
		return fail(400, {
			kind: 'reviewUndone' as const,
			bookId: id,
			message: 'Invalid reading status in undo snapshot.'
		});

	const workTypeRaw = fd.get('work_type');
	if (workTypeRaw === null)
		return fail(400, {
			kind: 'reviewUndone' as const,
			bookId: id,
			message: 'Missing work type in undo snapshot.'
		});
	const work_type = String(workTypeRaw).trim();
	if (!WORK_TYPE_SET.has(work_type))
		return fail(400, {
			kind: 'reviewUndone' as const,
			bookId: id,
			message: 'Invalid work type in undo snapshot.'
		});

	const no_attributed_author = parseBoolean(fd.get('no_attributed_author'));
	const needs_review_note = trimOrNull(fd.get('needs_review_note'));
	const isbn = trimOrNull(fd.get('isbn'));

	const payload: Record<string, unknown> = {
		title,
		year,
		publisher,
		publisher_location,
		publisher_id,
		genre,
		language,
		reading_status,
		work_type,
		no_attributed_author,
		needs_review: true,
		needs_review_note,
		isbn
	};

	const { error: updErr } = await supabase
		.from('books')
		.update(payload as never)
		.eq('id', id);
	if (updErr) {
		console.error(updErr);
		return fail(500, {
			kind: 'reviewUndone' as const,
			bookId: id,
			message: updErr.message ?? 'Could not undo review.'
		});
	}

	const proposalId = parseUuidOrNull(fd.get('proposal_id'));
	const resolutionRaw = String(fd.get('proposal_resolution') ?? '').trim();
	if (
		proposalId &&
		(resolutionRaw === 'accepted' || resolutionRaw === 'rejected')
	) {
		const err = await markProposalPending(supabase, proposalId, resolutionRaw, id);
		if (err) console.error('[undoReviewSaveAction proposal]', err.message);
	}

	return { kind: 'reviewUndone' as const, bookId: id, success: true as const };
}

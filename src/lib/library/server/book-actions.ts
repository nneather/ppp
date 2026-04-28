import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GENRES, LANGUAGES, READING_STATUSES, AUTHOR_ROLES } from '$lib/types/library';
import type { AuthorRole, Genre, Language, ReadingStatus } from '$lib/types/library';

/**
 * Server-side helpers for the books vertical slice. Both `/library` (list) and
 * `/library/books/[id]` (detail) host the same form actions; this module
 * shares the implementation so the per-route action handlers stay one-liners.
 *
 * Form-action result shape per `.cursor/rules/sveltekit-routes.mdc`:
 *   { kind, success?, message?, bookId? }
 *
 * Junction handling (book_authors / book_categories) is diff-based: the form
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
	| 'createPerson';

export type AuthorAssignmentInput = {
	person_id: string;
	role: AuthorRole;
	sort_order: number;
};

export type BookFormPayload = {
	title: string | null;
	subtitle: string | null;
	publisher: string | null;
	publisher_location: string | null;
	year: number | null;
	edition: string | null;
	total_volumes: number | null;
	original_year: number | null;
	reprint_publisher: string | null;
	reprint_location: string | null;
	reprint_year: number | null;
	primary_category_id: string | null;
	category_ids: string[];
	series_id: string | null;
	volume_number: string | null;
	genre: Genre | null;
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
	page_count: number | null;
	authors: AuthorAssignmentInput[];
};

/**
 * Important fields whose absence triggers auto-flag-for-review. Surfaced in
 * the form's amber preview so the user knows what will be flagged before they
 * Save. The list is the same on both sides.
 */
export const IMPORTANT_FIELDS = ['title', 'author', 'genre', 'year', 'publisher'] as const;
export type ImportantField = (typeof IMPORTANT_FIELDS)[number];

const GENRE_SET: ReadonlySet<string> = new Set(GENRES);
const LANGUAGE_SET: ReadonlySet<string> = new Set(LANGUAGES);
const READING_STATUS_SET: ReadonlySet<string> = new Set(READING_STATUSES);
const AUTHOR_ROLE_SET: ReadonlySet<string> = new Set(AUTHOR_ROLES);

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
	const t = String(raw ?? '').trim().toLowerCase();
	return t === 'true' || t === 'on' || t === '1';
}

function parseAuthorsJson(raw: FormDataEntryValue | null): AuthorAssignmentInput[] | null {
	const s = String(raw ?? '').trim();
	if (s.length === 0) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(s);
	} catch {
		return null;
	}
	if (!Array.isArray(parsed)) return null;
	const out: AuthorAssignmentInput[] = [];
	for (const item of parsed) {
		if (!item || typeof item !== 'object') return null;
		const r = item as Record<string, unknown>;
		const person_id = typeof r.person_id === 'string' ? r.person_id.trim() : '';
		const role = typeof r.role === 'string' ? r.role : '';
		const sort_order = Number(r.sort_order);
		if (!person_id) return null;
		if (!AUTHOR_ROLE_SET.has(role)) return null;
		if (!Number.isFinite(sort_order) || !Number.isInteger(sort_order)) return null;
		out.push({ person_id, role: role as AuthorRole, sort_order });
	}
	return out;
}

export type ParseResult =
	| { ok: true; payload: BookFormPayload }
	| { ok: false; message: string };

/**
 * Compute which IMPORTANT_FIELDS are missing from a parsed payload. Used by
 * both the auto-flag logic at save time and the form's pre-save preview hint.
 */
export function computeMissingImportant(p: {
	title: string | null;
	genre: string | null;
	year: number | null;
	publisher: string | null;
	authors: AuthorAssignmentInput[];
}): ImportantField[] {
	const out: ImportantField[] = [];
	if (!p.title) out.push('title');
	if (p.authors.filter((a) => a.role === 'author').length === 0) out.push('author');
	if (!p.genre) out.push('genre');
	if (p.year == null) out.push('year');
	if (!p.publisher) out.push('publisher');
	return out;
}

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

export function parseBookForm(fd: FormData): ParseResult {
	const title = trimOrNull(fd.get('title'));
	if (title != null && title.length > 500) {
		return { ok: false, message: 'Title is too long (500 char max).' };
	}

	// primary_category_id is nullable per 20260428160000 — empty = unset.
	const primary_category_id = trimOrNull(fd.get('primary_category_id'));

	// genre is nullable per 20260428170000 — empty = unset; otherwise must be in the list.
	const genreRaw = String(fd.get('genre') ?? '').trim();
	const genre: string | null = genreRaw.length > 0 ? genreRaw : null;
	if (genre != null && !GENRE_SET.has(genre)) {
		return { ok: false, message: 'Pick a genre from the list.' };
	}

	const language = String(fd.get('language') ?? '').trim();
	if (!LANGUAGE_SET.has(language))
		return { ok: false, message: 'Pick a language from the list.' };

	const reading_status = String(fd.get('reading_status') ?? '').trim();
	if (!READING_STATUS_SET.has(reading_status))
		return { ok: false, message: 'Pick a reading status from the list.' };

	const year = parseInt0(fd.get('year'));
	const total_volumes = parseInt0(fd.get('total_volumes'));
	const original_year = parseInt0(fd.get('original_year'));
	const reprint_year = parseInt0(fd.get('reprint_year'));
	const page_count = parseInt0(fd.get('page_count'));
	const rating = parseRating(fd.get('rating'));

	const category_ids = fd
		.getAll('category_ids')
		.map((v) => String(v).trim())
		.filter((v) => v.length > 0);
	if (primary_category_id && !category_ids.includes(primary_category_id)) {
		category_ids.unshift(primary_category_id);
	}

	const authors = parseAuthorsJson(fd.get('authors_json'));
	if (authors == null) {
		return { ok: false, message: 'Authors payload is malformed.' };
	}
	const seen = new Set<string>();
	for (const a of authors) {
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
	const edition = trimOrNull(fd.get('edition'));
	const reprint_publisher = trimOrNull(fd.get('reprint_publisher'));
	const reprint_location = trimOrNull(fd.get('reprint_location'));
	const series_id = trimOrNull(fd.get('series_id'));
	const volume_number = trimOrNull(fd.get('volume_number'));
	const isbn = trimOrNull(fd.get('isbn'));
	const barcode = trimOrNull(fd.get('barcode'));
	const shelving_location = trimOrNull(fd.get('shelving_location'));
	const borrowed_to = trimOrNull(fd.get('borrowed_to'));
	const personal_notes = trimOrNull(fd.get('personal_notes'));
	const userNeedsReview = parseBoolean(fd.get('needs_review'));
	const userReviewNote = trimOrNull(fd.get('needs_review_note'));

	// Save bar: at least one field (any identifying scalar OR a relation).
	// Defaults like language='english' / reading_status='unread' / needs_review=false
	// don't count — they're always present.
	const hasAnyField =
		title != null ||
		subtitle != null ||
		publisher != null ||
		publisher_location != null ||
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
		primary_category_id != null ||
		series_id != null ||
		category_ids.length > 0 ||
		authors.length > 0;
	if (!hasAnyField) {
		return {
			ok: false,
			message: 'Add at least one detail (title, ISBN, an author, anything) before saving.'
		};
	}

	// Auto-flag for review when important identifying/citation fields are
	// missing. The eventual review queue (Tracker_1 Session 6) consumes this.
	const missingImportant = computeMissingImportant({ title, genre, year, publisher, authors });
	const autoLine =
		missingImportant.length > 0 ? `Missing: ${missingImportant.join(', ')}` : null;
	const finalNeedsReview = userNeedsReview || missingImportant.length > 0;
	const finalReviewNote = mergeReviewNote(userReviewNote, autoLine);

	return {
		ok: true,
		payload: {
			title,
			subtitle,
			publisher,
			publisher_location,
			year,
			edition,
			total_volumes,
			original_year,
			reprint_publisher,
			reprint_location,
			reprint_year,
			primary_category_id,
			category_ids: Array.from(new Set(category_ids)),
			series_id,
			volume_number,
			genre: genre as Genre | null,
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
		year: p.year,
		edition: p.edition,
		total_volumes: p.total_volumes,
		original_year: p.original_year,
		reprint_publisher: p.reprint_publisher,
		reprint_location: p.reprint_location,
		reprint_year: p.reprint_year,
		primary_category_id: p.primary_category_id,
		series_id: p.series_id,
		volume_number: p.volume_number,
		genre: p.genre,
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
		page_count: p.page_count
	};
}

async function syncCategories(
	supabase: SupabaseClient,
	bookId: string,
	desiredIds: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
	const { data: existing, error: fetchErr } = await supabase
		.from('book_categories')
		.select('category_id')
		.eq('book_id', bookId);
	if (fetchErr) {
		return { ok: false, message: fetchErr.message ?? 'Could not load categories.' };
	}
	const currentIds = new Set((existing ?? []).map((r) => r.category_id as string));
	const desiredSet = new Set(desiredIds);

	const toInsert = desiredIds.filter((id) => !currentIds.has(id));
	const toDelete = [...currentIds].filter((id) => !desiredSet.has(id));

	if (toDelete.length > 0) {
		const { error: delErr } = await supabase
			.from('book_categories')
			.delete()
			.eq('book_id', bookId)
			.in('category_id', toDelete);
		if (delErr) return { ok: false, message: delErr.message ?? 'Category remove failed.' };
	}
	if (toInsert.length > 0) {
		const rows = toInsert.map((category_id) => ({ book_id: bookId, category_id }));
		const { error: insErr } = await supabase.from('book_categories').insert(rows);
		if (insErr) return { ok: false, message: insErr.message ?? 'Category add failed.' };
	}
	return { ok: true };
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

async function ensureNoIsbnCollision(
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

export async function createBookAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const parsed = parseBookForm(fd);
	if (!parsed.ok) return fail(400, { kind: 'createBook' as const, message: parsed.message });

	const collide = await ensureNoIsbnCollision(supabase, parsed.payload.isbn, null);
	if (!collide.ok) return fail(400, { kind: 'createBook' as const, message: collide.message });

	const insertPayload = {
		...bookColumnsPayload(parsed.payload),
		created_by: userId
	};

	const { data: inserted, error: insErr } = await supabase
		.from('books')
		.insert(insertPayload as never)
		.select('id')
		.single();
	if (insErr || !inserted) {
		console.error(insErr);
		return fail(500, {
			kind: 'createBook' as const,
			message: insErr?.message ?? 'Could not create book.'
		});
	}
	const bookId = inserted.id as string;

	const cat = await syncCategories(supabase, bookId, parsed.payload.category_ids);
	if (!cat.ok) {
		return fail(500, { kind: 'createBook' as const, bookId, message: cat.message });
	}
	const auth = await syncAuthors(supabase, bookId, parsed.payload.authors);
	if (!auth.ok) {
		return fail(500, { kind: 'createBook' as const, bookId, message: auth.message });
	}

	return { kind: 'createBook' as const, bookId, success: true as const };
}

export async function updateBookAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const id = String(fd.get('id') ?? '').trim();
	if (!id) return fail(400, { kind: 'updateBook' as const, message: 'Missing book id.' });

	const parsed = parseBookForm(fd);
	if (!parsed.ok)
		return fail(400, { kind: 'updateBook' as const, bookId: id, message: parsed.message });

	const collide = await ensureNoIsbnCollision(supabase, parsed.payload.isbn, id);
	if (!collide.ok)
		return fail(400, { kind: 'updateBook' as const, bookId: id, message: collide.message });

	const { data: existing, error: fetchErr } = await supabase
		.from('books')
		.select('id')
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (fetchErr || !existing) {
		return fail(404, { kind: 'updateBook' as const, bookId: id, message: 'Book not found.' });
	}

	// B1/B2 viewer column strip (defense-in-depth alongside the trigger in
	// 20260425170000_books_viewer_column_protection.sql). Re-fetch role
	// server-side; never trust the client.
	const { data: profileRow } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', userId)
		.maybeSingle();
	const isOwner = (profileRow?.role as string | null) === 'owner';
	const payload = bookColumnsPayload(parsed.payload);
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
		return fail(500, {
			kind: 'updateBook' as const,
			bookId: id,
			message: updErr.message ?? 'Could not update book.'
		});
	}

	const cat = await syncCategories(supabase, id, parsed.payload.category_ids);
	if (!cat.ok) {
		return fail(500, { kind: 'updateBook' as const, bookId: id, message: cat.message });
	}
	const auth = await syncAuthors(supabase, id, parsed.payload.authors);
	if (!auth.ok) {
		return fail(500, { kind: 'updateBook' as const, bookId: id, message: auth.message });
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
	if (!id)
		return fail(400, { kind: 'updateReadingStatus' as const, message: 'Missing book id.' });

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
		.eq('id', id);

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

export async function undoSoftDeleteBookAction(supabase: SupabaseClient, fd: FormData) {
	const id = String(fd.get('id') ?? '').trim();
	if (!id)
		return fail(400, { kind: 'undoSoftDeleteBook' as const, message: 'Missing book id.' });

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

export async function createPersonAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
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

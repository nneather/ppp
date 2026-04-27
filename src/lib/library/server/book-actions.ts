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
 * NOTE: `needs_review_note` and `page_count` are introduced by
 * `library_delta_v1.sql`. The current `src/lib/types/database.ts` does not yet
 * include them. We cast at the supabase boundary with `as never` per the
 * pattern in `src/routes/settings/audit-log/+page.server.ts` so the build
 * compiles today; after the user runs `npm run supabase:gen-types` post-apply,
 * the casts can be removed in a follow-up commit.
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
	title: string;
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
	primary_category_id: string;
	category_ids: string[];
	series_id: string | null;
	volume_number: string | null;
	genre: Genre;
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

export function parseBookForm(fd: FormData): ParseResult {
	const title = String(fd.get('title') ?? '').trim();
	if (!title) return { ok: false, message: 'Title is required.' };
	if (title.length > 500) return { ok: false, message: 'Title is too long.' };

	const primary_category_id = String(fd.get('primary_category_id') ?? '').trim();
	if (!primary_category_id) return { ok: false, message: 'Primary category is required.' };

	const genre = String(fd.get('genre') ?? '').trim();
	if (!GENRE_SET.has(genre)) return { ok: false, message: 'Pick a genre from the list.' };

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
	if (!category_ids.includes(primary_category_id)) {
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

	return {
		ok: true,
		payload: {
			title,
			subtitle: trimOrNull(fd.get('subtitle')),
			publisher: trimOrNull(fd.get('publisher')),
			publisher_location: trimOrNull(fd.get('publisher_location')),
			year,
			edition: trimOrNull(fd.get('edition')),
			total_volumes,
			original_year,
			reprint_publisher: trimOrNull(fd.get('reprint_publisher')),
			reprint_location: trimOrNull(fd.get('reprint_location')),
			reprint_year,
			primary_category_id,
			category_ids: Array.from(new Set(category_ids)),
			series_id: trimOrNull(fd.get('series_id')),
			volume_number: trimOrNull(fd.get('volume_number')),
			genre: genre as Genre,
			language: language as Language,
			isbn: trimOrNull(fd.get('isbn')),
			barcode: trimOrNull(fd.get('barcode')),
			shelving_location: trimOrNull(fd.get('shelving_location')),
			reading_status: reading_status as ReadingStatus,
			borrowed_to: trimOrNull(fd.get('borrowed_to')),
			personal_notes: trimOrNull(fd.get('personal_notes')),
			rating,
			needs_review: parseBoolean(fd.get('needs_review')),
			needs_review_note: trimOrNull(fd.get('needs_review_note')),
			page_count,
			authors
		}
	};
}

function bookColumnsPayload(p: BookFormPayload): Record<string, unknown> {
	const base: Record<string, unknown> = {
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
		needs_review: p.needs_review
	};
	// Pre-delta-v1 these columns don't exist; only emit when populated so the
	// payload doesn't reference absent columns and trigger a 42703.
	if (p.needs_review_note != null) base.needs_review_note = p.needs_review_note;
	if (p.page_count != null) base.page_count = p.page_count;
	return base;
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

	// Pre-delta-v1 `middle_name` and `suffix` columns don't exist; only emit
	// when populated so the INSERT shape doesn't reference absent columns.
	const insertPayload: Record<string, unknown> = {
		last_name,
		first_name,
		created_by: userId
	};
	if (middle_name != null) insertPayload.middle_name = middle_name;
	if (suffix != null) insertPayload.suffix = suffix;

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

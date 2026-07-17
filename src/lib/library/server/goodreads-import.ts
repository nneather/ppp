import type { SupabaseClient } from '@supabase/supabase-js';
import { parseDelimitedRows } from '$lib/library/server/books-csv';
import {
	headerIndex,
	matchGoodreadsRatings,
	parseGoodreadsIsbnCell,
	parseMyRatingCell,
	trimOrNullText,
	type GoodreadsBookCandidate,
	type GoodreadsExportRow,
	type GoodreadsMatchSummary
} from '$lib/library/goodreads-csv';

function cell(row: string[], idx: number): string {
	if (idx < 0 || idx >= row.length) return '';
	return row[idx] ?? '';
}

/**
 * Parse a Goodreads library export CSV into typed rows.
 */
export function parseGoodreadsExportCsv(
	text: string
): { ok: true; rows: GoodreadsExportRow[] } | { ok: false; message: string } {
	const matrix = parseDelimitedRows(text, ',');
	if (matrix.length < 2) {
		return { ok: false, message: 'CSV looks empty — export from Goodreads and try again.' };
	}
	const headers = matrix[0] ?? [];
	const titleIdx = headerIndex(headers, 'Title');
	const ratingIdx = headerIndex(headers, 'My Rating');
	if (titleIdx < 0 || ratingIdx < 0) {
		return {
			ok: false,
			message:
				'Not a Goodreads library export (need Title and My Rating columns). Use My Books → Import and export → Export Library.'
		};
	}
	const authorIdx = headerIndex(headers, 'Author');
	const authorLfIdx = headerIndex(headers, 'Author l-f');
	const isbnIdx = headerIndex(headers, 'ISBN');
	const isbn13Idx = headerIndex(headers, 'ISBN13');
	const reviewIdx = headerIndex(headers, 'My Review');
	const privateIdx = headerIndex(headers, 'Private Notes');
	const shelfIdx = headerIndex(headers, 'Exclusive Shelf');

	const rows: GoodreadsExportRow[] = [];
	for (let i = 1; i < matrix.length; i++) {
		const row = matrix[i] ?? [];
		if (row.every((c) => c.trim().length === 0)) continue;
		const isbn13 = parseGoodreadsIsbnCell(cell(row, isbn13Idx));
		const isbn10 = parseGoodreadsIsbnCell(cell(row, isbnIdx));
		rows.push({
			line: i + 1,
			title: cell(row, titleIdx).trim(),
			author: cell(row, authorIdx).trim(),
			authorLf: cell(row, authorLfIdx).trim(),
			isbn: isbn13 ?? isbn10,
			myRating: parseMyRatingCell(cell(row, ratingIdx)),
			myReview: trimOrNullText(cell(row, reviewIdx)),
			privateNotes: trimOrNullText(cell(row, privateIdx)),
			exclusiveShelf: trimOrNullText(cell(row, shelfIdx))
		});
	}
	return { ok: true, rows };
}

export async function loadGoodreadsBookCandidates(
	supabase: SupabaseClient
): Promise<GoodreadsBookCandidate[]> {
	const { data, error } = await supabase
		.from('books')
		.select('id, title, subtitle, isbn, author_display, rating, personal_notes')
		.is('deleted_at', null);
	if (error) {
		console.error(error);
		throw new Error(error.message ?? 'Could not load books for Goodreads match.');
	}
	return (data ?? []).map((r) => ({
		id: r.id as string,
		title: (r.title as string | null) ?? null,
		subtitle: (r.subtitle as string | null) ?? null,
		isbn: (r.isbn as string | null) ?? null,
		author_display: (r.author_display as string | null) ?? null,
		rating: (r.rating as number | null) ?? null,
		personal_notes: (r.personal_notes as string | null) ?? null
	}));
}

export async function previewGoodreadsRatingsImport(
	supabase: SupabaseClient,
	csvText: string,
	opts: { overwriteExisting?: boolean; fillEmptyNotes?: boolean }
): Promise<
	| { ok: true; summary: GoodreadsMatchSummary; rowCount: number }
	| { ok: false; message: string }
> {
	const parsed = parseGoodreadsExportCsv(csvText);
	if (!parsed.ok) return parsed;
	const books = await loadGoodreadsBookCandidates(supabase);
	const summary = matchGoodreadsRatings({
		grRows: parsed.rows,
		books,
		overwriteExisting: opts.overwriteExisting,
		fillEmptyNotes: opts.fillEmptyNotes
	});
	return { ok: true, summary, rowCount: parsed.rows.length };
}

export async function applyGoodreadsRatingsImport(
	supabase: SupabaseClient,
	csvText: string,
	opts: { overwriteExisting?: boolean; fillEmptyNotes?: boolean }
): Promise<
	| { ok: true; updated: number; skippedExisting: number; unmatched: number; unrated: number }
	| { ok: false; message: string }
> {
	const preview = await previewGoodreadsRatingsImport(supabase, csvText, opts);
	if (!preview.ok) return preview;

	let updated = 0;
	for (const row of preview.summary.apply) {
		if (!row.bookId || row.rating == null) continue;
		const patch: { rating: number; personal_notes?: string } = { rating: row.rating };
		if (row.notesToSet) patch.personal_notes = row.notesToSet;
		const { error } = await supabase
			.from('books')
			.update(patch as never)
			.eq('id', row.bookId)
			.is('deleted_at', null);
		if (error) {
			console.error(error);
			return {
				ok: false,
				message: `Failed updating “${row.bookTitle ?? row.gr.title}”: ${error.message}`
			};
		}
		updated += 1;
	}

	return {
		ok: true,
		updated,
		skippedExisting: preview.summary.skipExisting.length,
		unmatched: preview.summary.unmatched.length,
		unrated: preview.summary.unrated
	};
}

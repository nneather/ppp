import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	insertPolymorphicRow,
	polymorphicToColumns,
	validateXor
} from '$lib/library/polymorphic';
import type { PolymorphicParent, PolymorphicParentInput } from '$lib/library/polymorphic';

/**
 * Server-side helpers for `book_bible_coverage`, `book_ancient_coverage`,
 * and inline `ancient_texts` creation. Each junction is a thin wrapper
 * around `insertPolymorphicRow` per `.cursor/rules/library-module.mdc` —
 * zero new polymorphic primitives this session.
 *
 * Coverage deletes are HARD deletes — the junctions have no `deleted_at`.
 * Re-adds are idempotent:
 *   - `book_bible_coverage` has UNIQUE (book_id, bible_book) enforcing it.
 *   - `book_ancient_coverage` relies on the app layer to dedupe before INSERT.
 *
 * Form-action result shape per `.cursor/rules/sveltekit-routes.mdc`:
 *   { kind, success?, message?, coverageId? / ancientTextId? }
 */

export type CoverageActionKind =
	| 'createBibleCoverage'
	| 'softDeleteBibleCoverage'
	| 'createAncientCoverage'
	| 'softDeleteAncientCoverage'
	| 'createAncientText';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseParent(fd: FormData): PolymorphicParent | { error: string } {
	const kind = String(fd.get('source_kind') ?? '').trim();
	if (kind !== 'book' && kind !== 'essay') {
		return { error: 'Source must be a book or an essay.' };
	}
	const raw: PolymorphicParentInput =
		kind === 'book'
			? { kind: 'book', book_id: String(fd.get('book_id') ?? '').trim() }
			: { kind: 'essay', essay_id: String(fd.get('essay_id') ?? '').trim() };
	try {
		return validateXor(raw);
	} catch (err) {
		return { error: err instanceof Error ? err.message : 'Invalid source.' };
	}
}

// ---------------------------------------------------------------------------
// Bible coverage
// ---------------------------------------------------------------------------

export async function createBibleCoverageAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const parent = parseParent(fd);
	if ('error' in parent) {
		return fail(400, { kind: 'createBibleCoverage' as const, message: parent.error });
	}
	const bible_book = String(fd.get('bible_book') ?? '').trim();
	if (!bible_book) {
		return fail(400, {
			kind: 'createBibleCoverage' as const,
			message: 'Bible book is required.'
		});
	}

	// UNIQUE (book_id, bible_book) at the schema makes this idempotent, but a
	// pre-check lets us surface "already covered" without a CHECK violation.
	const cols = polymorphicToColumns(parent);
	if (cols.book_id) {
		const { data: existing } = await supabase
			.from('book_bible_coverage')
			.select('id')
			.eq('book_id', cols.book_id)
			.eq('bible_book', bible_book)
			.maybeSingle();
		if (existing) {
			return {
				kind: 'createBibleCoverage' as const,
				coverageId: (existing as { id: string }).id,
				bible_book,
				success: true as const
			};
		}
	}

	const result = await insertPolymorphicRow(supabase, 'book_bible_coverage', parent, {
		bible_book,
		created_by: userId
	});
	if (!result.ok) {
		console.error('[createBibleCoverage]', result.message);
		return fail(500, { kind: 'createBibleCoverage' as const, message: result.message });
	}
	return {
		kind: 'createBibleCoverage' as const,
		coverageId: result.id,
		bible_book,
		success: true as const
	};
}

export async function softDeleteBibleCoverageAction(supabase: SupabaseClient, fd: FormData) {
	const bookId = String(fd.get('book_id') ?? '').trim();
	const bible_book = String(fd.get('bible_book') ?? '').trim();
	if (!UUID_RE.test(bookId) || !bible_book) {
		return fail(400, {
			kind: 'softDeleteBibleCoverage' as const,
			message: 'book_id + bible_book are required.'
		});
	}
	const { error } = await supabase
		.from('book_bible_coverage')
		.delete()
		.eq('book_id', bookId)
		.eq('bible_book', bible_book);
	if (error) {
		console.error('[softDeleteBibleCoverage]', error);
		return fail(500, {
			kind: 'softDeleteBibleCoverage' as const,
			message: error.message ?? 'Could not remove coverage.'
		});
	}
	return {
		kind: 'softDeleteBibleCoverage' as const,
		bible_book,
		success: true as const
	};
}

// ---------------------------------------------------------------------------
// Ancient coverage
// ---------------------------------------------------------------------------

export async function createAncientCoverageAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const parent = parseParent(fd);
	if ('error' in parent) {
		return fail(400, { kind: 'createAncientCoverage' as const, message: parent.error });
	}
	const ancient_text_id = String(fd.get('ancient_text_id') ?? '').trim();
	if (!UUID_RE.test(ancient_text_id)) {
		return fail(400, {
			kind: 'createAncientCoverage' as const,
			message: 'Ancient text is required.'
		});
	}

	const cols = polymorphicToColumns(parent);
	if (cols.book_id) {
		const { data: existing } = await supabase
			.from('book_ancient_coverage')
			.select('id')
			.eq('book_id', cols.book_id)
			.eq('ancient_text_id', ancient_text_id)
			.maybeSingle();
		if (existing) {
			return {
				kind: 'createAncientCoverage' as const,
				coverageId: (existing as { id: string }).id,
				ancient_text_id,
				success: true as const
			};
		}
	}

	const result = await insertPolymorphicRow(
		supabase,
		'book_ancient_coverage',
		parent,
		{ ancient_text_id, created_by: userId }
	);
	if (!result.ok) {
		console.error('[createAncientCoverage]', result.message);
		return fail(500, { kind: 'createAncientCoverage' as const, message: result.message });
	}
	return {
		kind: 'createAncientCoverage' as const,
		coverageId: result.id,
		ancient_text_id,
		success: true as const
	};
}

export async function softDeleteAncientCoverageAction(supabase: SupabaseClient, fd: FormData) {
	const id = String(fd.get('id') ?? '').trim();
	if (!UUID_RE.test(id)) {
		return fail(400, {
			kind: 'softDeleteAncientCoverage' as const,
			message: 'Missing coverage id.'
		});
	}
	const { error } = await supabase.from('book_ancient_coverage').delete().eq('id', id);
	if (error) {
		console.error('[softDeleteAncientCoverage]', error);
		return fail(500, {
			kind: 'softDeleteAncientCoverage' as const,
			message: error.message ?? 'Could not remove coverage.'
		});
	}
	return { kind: 'softDeleteAncientCoverage' as const, success: true as const };
}

// ---------------------------------------------------------------------------
// Inline ancient_texts create (owner-only per Session 0 A2)
// ---------------------------------------------------------------------------

export async function createAncientTextAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const canonical_name = String(fd.get('canonical_name') ?? '').trim();
	if (!canonical_name) {
		return fail(400, {
			kind: 'createAncientText' as const,
			message: 'Canonical name is required.'
		});
	}
	if (canonical_name.length > 200) {
		return fail(400, {
			kind: 'createAncientText' as const,
			message: 'Canonical name is too long.'
		});
	}
	const abbrevRaw = String(fd.get('abbreviations') ?? '').trim();
	const abbreviations = abbrevRaw
		? abbrevRaw
				.split(',')
				.map((s) => s.trim())
				.filter((s) => s.length > 0)
		: [];
	const category =
		String(fd.get('category') ?? '').trim().length > 0
			? String(fd.get('category')).trim()
			: null;

	const { data, error } = await supabase
		.from('ancient_texts')
		.insert({
			canonical_name,
			abbreviations: abbreviations.length > 0 ? abbreviations : null,
			category,
			created_by: userId
		} as never)
		.select('id, canonical_name, abbreviations, category')
		.single();
	if (error) {
		console.error('[createAncientText]', error);
		// UNIQUE(canonical_name) collision surfaces as 23505 Postgres error.
		return fail(500, {
			kind: 'createAncientText' as const,
			message: error.message ?? 'Could not create ancient text.'
		});
	}
	const row = data as {
		id: string;
		canonical_name: string;
		abbreviations: string[] | null;
		category: string | null;
	};
	return {
		kind: 'createAncientText' as const,
		ancientText: {
			id: row.id,
			canonical_name: row.canonical_name,
			abbreviations: Array.isArray(row.abbreviations) ? row.abbreviations : [],
			category: row.category
		},
		success: true as const
	};
}

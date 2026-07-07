import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve a `book_metadata_proposals` row without touching the book. Used by
 * the review card's "Dismiss proposal" path (`status = rejected`) and — via
 * `markProposalResolved` — by `reviewSaveAction` after a successful confirm.
 * A proposal never clears `books.needs_review` by itself (064 Q3).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function markProposalResolved(
	supabase: SupabaseClient,
	proposalId: string,
	status: 'accepted' | 'rejected',
	/** When provided, the proposal must belong to this book (confirm-path integrity). */
	bookId?: string
): Promise<{ message: string } | null> {
	let query = supabase
		.from('book_metadata_proposals')
		.update({ status, reviewed_at: new Date().toISOString() } as never)
		.eq('id', proposalId)
		.eq('status', 'pending')
		.is('deleted_at', null);
	if (bookId) query = query.eq('book_id', bookId);
	const { error } = await query;
	if (error) {
		console.error('[markProposalResolved]', error);
		return { message: error.message ?? 'Could not update proposal.' };
	}
	return null;
}

export async function resolveProposalAction(supabase: SupabaseClient, fd: FormData) {
	const id = String(fd.get('proposal_id') ?? '').trim();
	if (!UUID_RE.test(id))
		return fail(400, { kind: 'proposalResolved' as const, message: 'Missing proposal id.' });

	const statusRaw = String(fd.get('status') ?? '').trim();
	if (statusRaw !== 'accepted' && statusRaw !== 'rejected')
		return fail(400, {
			kind: 'proposalResolved' as const,
			proposalId: id,
			message: 'Status must be accepted or rejected.'
		});

	const err = await markProposalResolved(supabase, id, statusRaw);
	if (err)
		return fail(500, { kind: 'proposalResolved' as const, proposalId: id, message: err.message });

	return { kind: 'proposalResolved' as const, proposalId: id, success: true as const };
}

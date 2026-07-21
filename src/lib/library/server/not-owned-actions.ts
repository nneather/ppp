import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findQueueItem, normalizeTitleKey } from '$lib/library/not-owned-queue';
import { findOrCreatePerson, parseTypedName } from '$lib/library/server/people-actions';

/**
 * Create a research/not-owned stub from the curated queue ([101]).
 * Title required; author optional; ★ → rating; notes → personal_notes;
 * owned=false; needs_review=false; never invent ISBN.
 */
export async function createNotOwnedStubAction(
	supabase: SupabaseClient,
	userId: string,
	fd: FormData
) {
	const { data: profileRow } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', userId)
		.maybeSingle();
	if ((profileRow?.role as string | null) !== 'owner') {
		return fail(403, {
			kind: 'createNotOwnedStub' as const,
			message: 'Only the owner can create not-owned stubs.'
		});
	}

	const queueKey = String(fd.get('queue_key') ?? '').trim();
	const item = findQueueItem(queueKey);
	if (!item) {
		return fail(400, {
			kind: 'createNotOwnedStub' as const,
			queueKey,
			message: 'Unknown queue item.'
		});
	}

	const titleNorm = normalizeTitleKey(item.title);
	const { data: existing, error: existErr } = await supabase
		.from('books')
		.select('id, title')
		.is('deleted_at', null)
		.limit(5000);
	if (existErr) {
		console.error(existErr);
		return fail(500, {
			kind: 'createNotOwnedStub' as const,
			queueKey,
			message: existErr.message ?? 'Could not check existing books.'
		});
	}
	const already = (existing ?? []).find(
		(r) => normalizeTitleKey(String((r as { title: string | null }).title ?? '')) === titleNorm
	);
	if (already) {
		return {
			kind: 'createNotOwnedStub' as const,
			queueKey,
			success: true as const,
			bookId: (already as { id: string }).id,
			alreadyExisted: true as const
		};
	}

	const insertPayload: Record<string, unknown> = {
		title: item.title,
		owned: false,
		needs_review: false,
		needs_review_note: null,
		language: 'english',
		reading_status: 'unread',
		work_type: 'monograph',
		copy_count: 1,
		rating: item.rating,
		personal_notes: item.notes,
		created_by: userId
	};

	const { data: bookRow, error: insErr } = await supabase
		.from('books')
		.insert(insertPayload as never)
		.select('id')
		.single();

	if (insErr || !bookRow) {
		console.error(insErr);
		return fail(500, {
			kind: 'createNotOwnedStub' as const,
			queueKey,
			message: insErr?.message ?? 'Could not create stub.'
		});
	}

	const bookId = (bookRow as { id: string }).id;

	if (item.author?.trim()) {
		const parsed = parseTypedName(item.author.trim());
		if (parsed) {
			try {
				const { personId } = await findOrCreatePerson(supabase, parsed, userId);
				const { error: authErr } = await supabase.from('book_authors').insert({
					book_id: bookId,
					person_id: personId,
					role: 'author',
					sort_order: 0
				} as never);
				if (authErr) console.error('[createNotOwnedStub] author', authErr);
			} catch (e) {
				console.error('[createNotOwnedStub] person', e);
			}
		}
	}

	return {
		kind: 'createNotOwnedStub' as const,
		queueKey,
		success: true as const,
		bookId,
		alreadyExisted: false as const
	};
}

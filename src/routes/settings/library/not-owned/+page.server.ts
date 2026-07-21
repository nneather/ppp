import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	NOT_OWNED_QUEUE,
	normalizeTitleKey,
	type NotOwnedQueueItem
} from '$lib/library/not-owned-queue';
import { createNotOwnedStubAction } from '$lib/library/server/not-owned-actions';

export type NotOwnedSettingsRow = NotOwnedQueueItem & {
	existingBookId: string | null;
	/** True when the matched live book is owned (still leaves pending). */
	existingOwned: boolean | null;
};

export const load: PageServerLoad = async ({ locals, parent, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	const { isOwner } = await parent();
	if (!isOwner) redirect(303, '/settings/library');

	depends('app:library:not-owned');

	// Match any live book by title — owned stubs must not reappear as pending ([107] follow-up).
	const { data, error } = await locals.supabase
		.from('books')
		.select('id, title, owned')
		.is('deleted_at', null)
		.limit(5000);

	if (error) {
		console.error(error);
		return {
			rows: NOT_OWNED_QUEUE.map(
				(q): NotOwnedSettingsRow => ({
					...q,
					existingBookId: null,
					existingOwned: null
				})
			),
			loadError: 'Could not load existing books.'
		};
	}

	const byTitle = new Map<string, { id: string; owned: boolean }>();
	for (const r of data ?? []) {
		const row = r as { id: string; title: string | null; owned: boolean };
		const k = normalizeTitleKey(row.title ?? '');
		if (!k || byTitle.has(k)) continue;
		byTitle.set(k, { id: row.id, owned: row.owned !== false });
	}

	const rows: NotOwnedSettingsRow[] = NOT_OWNED_QUEUE.map((q) => {
		const hit = byTitle.get(normalizeTitleKey(q.title));
		return {
			...q,
			existingBookId: hit?.id ?? null,
			existingOwned: hit != null ? hit.owned : null
		};
	});

	return { rows, loadError: null as string | null };
};

export const actions: Actions = {
	createStub: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createNotOwnedStub' as const, message: 'Unauthorized' });
		const fd = await request.formData();
		return createNotOwnedStubAction(locals.supabase, user.id, fd);
	}
};

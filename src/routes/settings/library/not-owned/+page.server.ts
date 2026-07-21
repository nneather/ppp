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
};

export const load: PageServerLoad = async ({ locals, parent, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	const { isOwner } = await parent();
	if (!isOwner) redirect(303, '/settings/library');

	depends('app:library:not-owned');

	const { data, error } = await locals.supabase
		.from('books')
		.select('id, title')
		.is('deleted_at', null)
		.eq('owned', false)
		.limit(500);

	if (error) {
		console.error(error);
		return {
			rows: NOT_OWNED_QUEUE.map(
				(q): NotOwnedSettingsRow => ({ ...q, existingBookId: null })
			),
			loadError: 'Could not load existing stubs.'
		};
	}

	const byTitle = new Map<string, string>();
	for (const r of data ?? []) {
		const row = r as { id: string; title: string | null };
		const k = normalizeTitleKey(row.title ?? '');
		if (k && !byTitle.has(k)) byTitle.set(k, row.id);
	}

	const rows: NotOwnedSettingsRow[] = NOT_OWNED_QUEUE.map((q) => ({
		...q,
		existingBookId: byTitle.get(normalizeTitleKey(q.title)) ?? null
	}));

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

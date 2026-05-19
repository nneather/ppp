import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { PublisherRow } from '$lib/types/library';
import { loadPublishers } from '$lib/library/server/loaders';
import { fetchLiveBookIdsByPublisherId } from '$lib/library/server/publishers-settings-book-counts';
import {
	createPublisherSettingsAction,
	mergePublishersSettingsAction,
	softDeletePublisherSettingsAction,
	updatePublisherSettingsAction
} from '$lib/library/server/publishers-settings-actions';

export type PublishersSettingsListRow = PublisherRow & {
	book_count: number;
	children: PublishersSettingsListRow[];
};

function buildPublisherTree(rows: PublisherRow[], counts: Map<string, number>): PublishersSettingsListRow[] {
	const byId = new Map<string, PublishersSettingsListRow>();
	for (const r of rows) {
		byId.set(r.id, {
			...r,
			aliases: Array.isArray(r.aliases) ? r.aliases : [],
			book_count: counts.get(r.id) ?? 0,
			children: []
		});
	}
	const roots: PublishersSettingsListRow[] = [];
	for (const node of byId.values()) {
		if (node.parent_id && byId.has(node.parent_id)) {
			byId.get(node.parent_id)!.children.push(node);
		} else {
			roots.push(node);
		}
	}
	const sortNodes = (list: PublishersSettingsListRow[]) => {
		list.sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));
		for (const n of list) sortNodes(n.children);
	};
	sortNodes(roots);
	return roots;
}

export const load: PageServerLoad = async ({ locals, depends, parent }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const { isOwner } = await parent();
	depends('app:library:publishers');

	const supabase = locals.supabase;
	const rows = await loadPublishers(supabase);
	const ids = rows.map((r) => r.id);
	const { map: counts, error: countErr } = await fetchLiveBookIdsByPublisherId(supabase, ids);

	return {
		isOwner,
		tree: buildPublisherTree(rows, counts),
		flat: rows,
		loadError: null as string | null,
		countError: countErr
	};
};

export const actions: Actions = {
	createPublisher: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'createPublisher' as const, message: 'Unauthorized' });
		return createPublisherSettingsAction(locals.supabase, user.id, await request.formData());
	},
	updatePublisher: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, { kind: 'updatePublisher' as const, publisherId: '', message: 'Unauthorized' });
		return updatePublisherSettingsAction(locals.supabase, user.id, await request.formData());
	},
	softDeletePublisher: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user)
			return fail(401, {
				kind: 'softDeletePublisher' as const,
				publisherId: '',
				message: 'Unauthorized'
			});
		return softDeletePublisherSettingsAction(locals.supabase, user.id, await request.formData());
	},
	mergePublishers: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'mergePublishers' as const, message: 'Unauthorized' });
		return mergePublishersSettingsAction(locals.supabase, user.id, await request.formData());
	}
};

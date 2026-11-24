import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	assertOwner,
	loadPostcardPage,
	saveDesignAction,
	sendBatchAction,
	sendProofsAction,
	sendSelfAction,
	uploadArtworkAction
} from '$lib/contacts/server/postcards';

/** Lob calls retry with 15s timeouts; give a chunk room so it isn't killed mid-send. */
export const config = { maxDuration: 300 };

export const load: PageServerLoad = async ({ locals, params, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	depends('app:postcards');
	return loadPostcardPage(locals.supabase, user.id, params.listId);
};

/** Session + owner gate shared by every action. */
async function gate(locals: App.Locals, kind: string) {
	const { user } = await locals.safeGetSession();
	if (!user) return { denied: fail(401, { kind, message: 'Unauthorized' }) };
	const denied = await assertOwner(locals.supabase, user.id, kind);
	return denied ? { denied } : { userId: user.id };
}

export const actions: Actions = {
	saveDesign: async ({ request, locals, params }) => {
		const g = await gate(locals, 'saveDesign');
		if ('denied' in g) return g.denied;
		return saveDesignAction(locals.supabase, g.userId, params.listId, await request.formData());
	},
	uploadArtwork: async ({ request, locals, params }) => {
		const g = await gate(locals, 'uploadArtwork');
		if ('denied' in g) return g.denied;
		return uploadArtworkAction(locals.supabase, g.userId, params.listId, await request.formData());
	},
	sendProofs: async ({ request, locals, params }) => {
		const g = await gate(locals, 'sendProofs');
		if ('denied' in g) return g.denied;
		return sendProofsAction(locals.supabase, g.userId, params.listId, await request.formData());
	},
	sendSelf: async ({ locals, params }) => {
		const g = await gate(locals, 'sendSelf');
		if ('denied' in g) return g.denied;
		return sendSelfAction(locals.supabase, g.userId, params.listId);
	},
	sendBatch: async ({ request, locals, params }) => {
		const g = await gate(locals, 'sendBatch');
		if ('denied' in g) return g.denied;
		return sendBatchAction(locals.supabase, g.userId, params.listId, await request.formData());
	}
};

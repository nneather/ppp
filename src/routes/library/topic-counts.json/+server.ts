import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadAllTopicCounts } from '$lib/library/server/loaders';

/** Global topic vocabulary for `<BookTopicForm>` typo gate — lazy-loaded from book detail. */
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const topicCounts = await loadAllTopicCounts(locals.supabase);
	return json({ topicCounts });
};

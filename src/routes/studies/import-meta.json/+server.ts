import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadStudyImportMeta } from '$lib/studies/server/study-workspace';
import type { StudyParent } from '$lib/studies/study-parent';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Set suggestions, prior papers, and create-section list for the import dialog.
 * Fetched when the dialog opens so sermon and paper detail do not wait on it.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const parentKind = url.searchParams.get('parent_kind');
	const parentId = url.searchParams.get('parent_id');
	if ((parentKind !== 'paper' && parentKind !== 'sermon') || !parentId || !UUID_RE.test(parentId)) {
		error(400, 'Invalid parent');
	}
	const parent: StudyParent = { kind: parentKind, id: parentId };
	const supabase = locals.supabase;

	const studyRes =
		parent.kind === 'sermon'
			? await supabase
					.from('sermons')
					.select('topical, passage_display, topic')
					.eq('id', parent.id)
					.is('deleted_at', null)
					.maybeSingle()
			: await supabase
					.from('papers')
					.select('topical, passage_display, topic')
					.eq('id', parent.id)
					.is('deleted_at', null)
					.maybeSingle();
	if (studyRes.error) console.error('[studies] import meta parent', studyRes.error);
	const row = studyRes.data as {
		topical: boolean;
		passage_display: string | null;
		topic: string | null;
	} | null;
	if (!row) error(404, 'Study not found');

	const meta = await loadStudyImportMeta(supabase, parent, {
		topical: row.topical,
		passageDisplay: row.passage_display,
		topic: row.topic
	});
	return json(meta);
};

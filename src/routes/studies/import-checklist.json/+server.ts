import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseImportTarget } from '$lib/studies/import-suggest';
import { loadImportChecklistPayload } from '$lib/studies/server/import-checklist';
import type { StudyParent } from '$lib/studies/study-parent';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Import checklist for one set / prior paper / passage sections.
 * Fetched from the open dialog so the paper page does not reload.
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

	const target = parseImportTarget(url.searchParams.get('import'));
	if (!target) error(400, 'Invalid import target');

	const passageDisplay = url.searchParams.get('passage') || null;
	const payload = await loadImportChecklistPayload(
		locals.supabase,
		parent,
		target,
		passageDisplay
	);

	return json(payload, {
		headers: { 'Cache-Control': 'private, no-store' }
	});
};

import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildBibliographyDocx } from '$lib/library/server/bibliography-docx';
import { loadSermonById } from '$lib/sermons/server/loaders';
import { paperDisplayLead } from '$lib/studies/paper-display';
import {
	bibliographyDownloadName,
	formatPaperBibliographyEntries,
	sectionPaperBibliography
} from '$lib/studies/paper-bibliography';
import { loadPaperDetail, loadStudyGroups, loadStudySourceViews } from '$lib/studies/server/paper-loaders';
import { includeInCompiledBibliography } from '$lib/studies/source-usage';
import type { StudyParent } from '$lib/studies/study-parent';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const config = { maxDuration: 30 };

export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const paperId = url.searchParams.get('paper_id')?.trim() ?? '';
	const sermonId = url.searchParams.get('sermon_id')?.trim() ?? '';
	if ((paperId && sermonId) || (!paperId && !sermonId)) {
		error(400, 'Pass paper_id or sermon_id');
	}
	const id = paperId || sermonId;
	if (!UUID_RE.test(id)) error(400, 'Invalid id');

	const parent: StudyParent = paperId
		? { kind: 'paper', id: paperId }
		: { kind: 'sermon', id: sermonId };
	const sectioned = url.searchParams.get('sectioned') === '1';
	const includeCandidates = url.searchParams.get('candidates') === '1';
	const supabase = locals.supabase;

	const [paperRes, sermonRes, sourcesRes, groupsRes] = await Promise.all([
		parent.kind === 'paper' ? loadPaperDetail(supabase, parent.id) : Promise.resolve(null),
		parent.kind === 'sermon' ? loadSermonById(supabase, parent.id) : Promise.resolve(null),
		loadStudySourceViews(supabase, parent),
		loadStudyGroups(supabase, parent)
	]);

	const loadError = paperRes?.error ?? sermonRes?.error ?? sourcesRes.error ?? groupsRes.error;
	if (loadError) error(500, 'Could not load bibliography');

	const lead = paperRes?.paper
		? paperDisplayLead(paperRes.paper).lead
		: sermonRes?.sermon
			? sermonRes.sermon.passage_display?.trim() || sermonRes.sermon.topic?.trim() || 'Sermon'
			: null;
	if (!lead) error(404, 'Study not found');

	const opts = { includeCandidates };
	const sections = sectioned
		? sectionPaperBibliography(sourcesRes.sources, groupsRes.groups, opts)
		: null;
	const entries = sections
		? sections.flatMap((section) => section.entries)
		: formatPaperBibliographyEntries(
				sourcesRes.sources.filter((source) =>
					includeInCompiledBibliography(source.usage, includeCandidates)
				)
			);
	if (entries.length === 0) error(400, 'No bibliography entries');

	const buffer = await buildBibliographyDocx(entries, sections ? { sections } : undefined);
	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Content-Disposition': `attachment; filename="${bibliographyDownloadName(lead)}"`
		}
	});
};

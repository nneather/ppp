/**
 * Smoke-test read tools against hosted prod (no MCP protocol).
 *
 *   npm run mcp:smoke
 *   npx tsx scripts/ppp-mcp/smoke.ts
 *   npx tsx scripts/ppp-mcp/smoke.ts list_now_tasks search_library
 */

import { getPppMcpClient } from './client.ts';
import {
	getAssignmentsForCourse,
	getBookCitation,
	listCommentariesForBibleBook,
	listContactsDue,
	listDueSoon,
	listNowTasks,
	listProjectHealth,
	listSermonsForBibleBook,
	listUpcomingSermonsTool,
	listWeekTasks,
	searchLibrary,
	TOOL_NAMES,
	type ToolName
} from './tools.ts';

async function runTool(name: ToolName): Promise<unknown> {
	const { supabase } = await getPppMcpClient();
	switch (name) {
		case 'list_now_tasks':
			return listNowTasks(supabase);
		case 'list_week_tasks':
			return listWeekTasks(supabase, { days: 7 });
		case 'list_due_soon':
			return listDueSoon(supabase, { horizon_days: 14 });
		case 'get_assignments_for_course': {
			// Prefer a real course when any exist; otherwise exercise the resolve-miss path.
			const { loadCourses } = await import('../../src/lib/classwork/server/loaders.ts');
			const { courses } = await loadCourses(supabase);
			const sample = courses[0];
			const course = sample?.code?.trim() || sample?.name?.trim() || 'Psalms';
			return getAssignmentsForCourse(supabase, { course });
		}
		case 'list_contacts_due':
			return listContactsDue(supabase);
		case 'search_library':
			return searchLibrary(supabase, { q: 'piot', limit: 5 });
		case 'get_book_citation': {
			const search = await searchLibrary(supabase, { q: 'romans', limit: 1 });
			const parsed = JSON.parse(search.content[0]!.text) as {
				books?: { id: string }[];
			};
			const id = parsed.books?.[0]?.id;
			if (!id) return { skipped: true, reason: 'no search hit for citation smoke' };
			return getBookCitation(supabase, { book_id: id });
		}
		case 'list_upcoming_sermons':
			return listUpcomingSermonsTool(supabase, { limit: 3 });
		case 'list_project_health': {
			// Default (full list) + Education subtree + WoW changes (Monday-protocol filters).
			const full = await listProjectHealth(supabase);
			const subtree = await listProjectHealth(supabase, { root: 'Education' });
			const changed = await listProjectHealth(supabase, { changed_only: true });
			return {
				full: JSON.parse(full.content[0]!.text),
				education: JSON.parse(subtree.content[0]!.text),
				changed_only: JSON.parse(changed.content[0]!.text)
			};
		}
		case 'list_commentaries_for_bible_book':
			return listCommentariesForBibleBook(supabase, { bible_book: 'Matthew' });
		case 'list_sermons_for_bible_book':
			return listSermonsForBibleBook(supabase, { bible_book: 'Mark' });
		default: {
			const _exhaustive: never = name;
			return _exhaustive;
		}
	}
}

async function main() {
	const requested = process.argv.slice(2).filter((a): a is ToolName =>
		(TOOL_NAMES as readonly string[]).includes(a)
	);
	const tools = requested.length > 0 ? requested : ([...TOOL_NAMES] as ToolName[]);

	console.error(`[ppp-mcp smoke] running ${tools.length} tool(s)…`);
	let failed = 0;
	for (const name of tools) {
		try {
			const result = await runTool(name);
			const text =
				result &&
				typeof result === 'object' &&
				'content' in result &&
				Array.isArray((result as { content: unknown }).content)
					? (result as { content: { text: string }[] }).content[0]?.text
					: JSON.stringify(result);
			const preview = (text ?? '').slice(0, 240).replace(/\s+/g, ' ');
			console.error(`  OK  ${name} — ${preview}${(text?.length ?? 0) > 240 ? '…' : ''}`);
		} catch (err) {
			failed += 1;
			console.error(`  FAIL ${name}`, err);
		}
	}
	if (failed > 0) {
		console.error(`[ppp-mcp smoke] ${failed} failed`);
		process.exit(1);
	}
	console.error('[ppp-mcp smoke] all ok');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

/**
 * ppp MCP server — local stdio, read-only tools against hosted prod.
 *
 * Run (Cursor / Claude Code spawn this):
 *   npx tsx scripts/ppp-mcp/index.ts
 *
 * Secrets: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, POS_OWNER_ID
 * from repo .env / .env.local (loaded in client.ts). Do not put service role in mcp.json.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getPppMcpClient } from './client.ts';
import {
	getBookCitation,
	getAssignmentsForCourse,
	listCommentariesForBibleBook,
	listContactsDue,
	listDueSoon,
	listNowTasks,
	listProjectHealth,
	listSermonsForBibleBook,
	listUpcomingSermonsTool,
	listWeekTasks,
	searchLibrary
} from './tools.ts';

const server = new McpServer({
	name: 'ppp',
	version: '1.0.0'
});

server.registerTool(
	'list_now_tasks',
	{
		description:
			'List Critical Now + Opportunity Now MYN tasks (same as desktop /dashboard pane).'
	},
	async () => {
		const { supabase } = await getPppMcpClient();
		return listNowTasks(supabase);
	}
);

server.registerTool(
	'list_week_tasks',
	{
		description:
			"Coming week's MYN task horizon (all zones incl. Over-the-Horizon). Non-done tasks whose start_date falls in [today .. today+days] America/Chicago. Not just Critical/Opportunity Now — use list_now_tasks for that.",
		inputSchema: {
			days: z
				.number()
				.int()
				.min(1)
				.max(31)
				.optional()
				.describe('Inclusive days ahead from Chicago today (default 7, max 31).')
		}
	},
	async (args) => {
		const { supabase } = await getPppMcpClient();
		return listWeekTasks(supabase, args);
	}
);

server.registerTool(
	'list_due_soon',
	{
		description:
			'Open classwork assignments due within horizon_days (default 14). Overdue included first. MYN tasks have no due_date.',
		inputSchema: {
			horizon_days: z
				.number()
				.int()
				.min(0)
				.max(365)
				.optional()
				.describe('Days ahead from Chicago today (default 14). Overdue always included.')
		}
	},
	async (args) => {
		const { supabase } = await getPppMcpClient();
		return listDueSoon(supabase, args);
	}
);

server.registerTool(
	'get_assignments_for_course',
	{
		description:
			'All assignments for a course (resolve by name or code; fuzzy prefix/substring). Includes parent grouping fields and courses.project_id for health joins.',
		inputSchema: {
			course: z
				.string()
				.describe('Course name or code (e.g. "Psalms", "OT512")')
		}
	},
	async (args) => {
		const { supabase } = await getPppMcpClient();
		return getAssignmentsForCourse(supabase, args);
	}
);

server.registerTool(
	'list_contacts_due',
	{
		description:
			'Contacts due for a meet / Christmas card. Stub until the contacts CRM module ships.'
	},
	async () => {
		const { supabase } = await getPppMcpClient();
		return listContactsDue(supabase);
	}
);

server.registerTool(
	'search_library',
	{
		description:
			'Search owned library books by keyword (prefix FTS on title/authors/etc.). Returns compact list rows.',
		inputSchema: {
			q: z.string().describe('Search query (partial last names / titles OK)'),
			limit: z.number().int().min(1).max(50).optional().describe('Max rows (default 20)'),
			include_unowned: z
				.boolean()
				.optional()
				.describe('Include research stubs (owned=false). Default false.')
		}
	},
	async (args) => {
		const { supabase } = await getPppMcpClient();
		return searchLibrary(supabase, args);
	}
);

server.registerTool(
	'get_book_citation',
	{
		description:
			'Turabian 9th-ed footnote + bibliography for a book id (plain text). Optional page for the footnote.',
		inputSchema: {
			book_id: z.string().uuid().describe('books.id UUID'),
			page: z.string().optional().describe('Page or page range for the footnote')
		}
	},
	async (args) => {
		const { supabase } = await getPppMcpClient();
		return getBookCitation(supabase, args);
	}
);

server.registerTool(
	'list_upcoming_sermons',
	{
		description: 'Upcoming sermons with preached_on >= today (Chicago), soonest first.',
		inputSchema: {
			limit: z.number().int().min(1).max(20).optional().describe('Max rows (default 5)')
		}
	},
	async (args) => {
		const { supabase } = await getPppMcpClient();
		return listUpcomingSermonsTool(supabase, args);
	}
);

server.registerTool(
	'list_project_health',
	{
		description:
			'Non-done/archived projects with latest weekly check-in health (and previous when present).'
	},
	async () => {
		const { supabase } = await getPppMcpClient();
		return listProjectHealth(supabase);
	}
);

server.registerTool(
	'list_commentaries_for_bible_book',
	{
		description:
			'Commentaries (and also-on-shelf hits) for a Protestant Bible book — same data as /sermons/by-book.',
		inputSchema: {
			bible_book: z
				.string()
				.describe('Bible book name, e.g. Matthew, Romans, 1 Corinthians (aliases OK)')
		}
	},
	async (args) => {
		const { supabase } = await getPppMcpClient();
		return listCommentariesForBibleBook(supabase, args);
	}
);

server.registerTool(
	'list_sermons_for_bible_book',
	{
		description: 'Sermons preached that include a passage in the given Bible book.',
		inputSchema: {
			bible_book: z
				.string()
				.describe('Bible book name, e.g. Mark, Isaiah (aliases OK)')
		}
	},
	async (args) => {
		const { supabase } = await getPppMcpClient();
		return listSermonsForBibleBook(supabase, args);
	}
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((err) => {
	console.error('[ppp-mcp]', err);
	process.exit(1);
});

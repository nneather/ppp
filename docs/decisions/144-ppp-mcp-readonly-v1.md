# 144 — ppp MCP server read-only v1

**Date:** 2026-07-24
**Module:** cross-cutting (MCP)
**Tracker session:** Fall priority from [138](138-fall-semester-priorities.md)

## Built

- Local **stdio** MCP server at [`scripts/ppp-mcp/`](../../scripts/ppp-mcp/) (`index.ts` entry, `client.ts` auth, `tools.ts` handlers, `smoke.ts`, [README](../../scripts/ppp-mcp/README.md)).
- Shared Bible-book resolver [`src/lib/mcp/bible-book.ts`](../../src/lib/mcp/bible-book.ts) + unit tests.
- `npm run mcp:smoke` — all 9 tools against hosted prod (2026-07-24).
- `.env.example` stubs for `SUPABASE_SERVICE_ROLE_KEY` + `POS_OWNER_ID`.

## Decided

- **Transport:** local stdio only (no remote/hosted MCP). Same process works for **Cursor** and **Claude Code** via separate client configs pointing at `npx tsx scripts/ppp-mcp/index.ts` (cwd = repo root).
- **Auth:** service role + startup assert that `POS_OWNER_ID` is a live `profiles.role = 'owner'` row. Matches library-import. Bypasses RLS; solo laptop use. User-JWT path deferred (token refresh friction). Service role **never** to browser; prefer dotenv from `.env` / `.env.local` over putting the key in mcp.json.
- **Tools v1 (read-only):**
  - Live: `list_now_tasks`, `search_library`, `get_book_citation`, `list_upcoming_sermons`, `list_project_health`, `list_commentaries_for_bible_book`, `list_sermons_for_bible_book`
  - Stubs: `list_due_soon` (classwork), `list_contacts_due` (CRM)
- **Reuse:** wrap existing loaders (`loadDashboardNowTasks`, `loadBookListFiltered`, `loadBookCitationInputs` + Turabian formatters, `loadUpcomingSermons`, `loadProjectRows` + `loadLatestHealth`, `loadByBookStats`, `loadSermons`). No duplicated RLS SQL.
- **No write tools** in v1.

## Schema changes

- None.

## New components / patterns added

- `scripts/ppp-mcp/` — stdio MCP package (documented wiring in README).
- `src/lib/mcp/bible-book.ts` — canon name resolve + aliases for MCP bible-book tools.

## Open questions surfaced

- When classwork / CRM ship, replace stubs with real loaders (same tool names preferred).
- Optional later: user-JWT auth if a second consumer or remote host appears.

## Surprises (read these before the next session)

- `tsx` from repo root resolves `$lib` path aliases, so MCP tools can import SvelteKit server loaders without a separate build step.
- Owner + service role live in gitignored `.env` (not only `.env.local`) on this machine — `client.ts` loads both.

## Cursor / Claude Code wiring

See [`scripts/ppp-mcp/README.md`](../../scripts/ppp-mcp/README.md). Summary:

**Cursor** (`~/.cursor/mcp.json`):

```json
"ppp": {
  "command": "npm",
  "args": ["run", "mcp:serve", "--prefix", "/Users/Neal/ppp"]
}
```

**Claude Code:**

```bash
claude mcp add --scope user ppp -- npm run mcp:serve --prefix /Users/Neal/ppp
```

## Carry-forward updates

- [x] components.mdc — n/a (no UI component)
- [x] AGENTS.md inventory updated
- [x] new env vars documented (`.env.example` + this file)
- [x] PLAN.md refreshed

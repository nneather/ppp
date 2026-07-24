# ppp MCP server (read-only v1)

Local **stdio** MCP so Cursor and Claude Code can query hosted ppp without opening the PWA.

Decision: [docs/decisions/144-ppp-mcp-readonly-v1.md](../../docs/decisions/144-ppp-mcp-readonly-v1.md)

## Requirements

In `.env.local` (gitignored):

| Var | Purpose |
|---|---|
| `PUBLIC_SUPABASE_URL` | Hosted project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (bypasses RLS; **never** to browser) |
| `POS_OWNER_ID` | Owner `profiles.id` — asserted at startup |

The server loads `.env` then `.env.local` from the repo root. Prefer **not** putting secrets in MCP client config JSON.

## Tools (read-only)

| Tool | Notes |
|---|---|
| `list_now_tasks` | Critical + Opportunity Now |
| `list_due_soon` | Stub (classwork not shipped) |
| `list_contacts_due` | Stub (CRM not shipped) |
| `search_library` | Keyword search |
| `get_book_citation` | Turabian footnote + bibliography |
| `list_upcoming_sermons` | `preached_on >= today` |
| `list_project_health` | Non-done/archived + latest health |
| `list_commentaries_for_bible_book` | `/sermons/by-book` commentaries |
| `list_sermons_for_bible_book` | Sermons touching a Bible book |

No write/mutate tools in v1.

## Smoke (without MCP client)

```bash
npm run mcp:smoke
# or specific tools:
npx tsx scripts/ppp-mcp/smoke.ts list_now_tasks search_library list_commentaries_for_bible_book
```

## Cursor wiring

Add to `~/.cursor/mcp.json` — **use npm `--prefix` so cwd is always the repo** (required for `$lib` path aliases):

```json
{
  "mcpServers": {
    "ppp": {
      "command": "npm",
      "args": ["run", "mcp:serve", "--prefix", "/Users/Neal/ppp"]
    }
  }
}
```

Restart Cursor (or reload MCP servers). Confirm tools appear under the `ppp` server.

## Claude Code wiring

```bash
claude mcp add --scope user ppp -- npm run mcp:serve --prefix /Users/Neal/ppp
```

(If the CLI already has a `ppp` entry, remove it first: `claude mcp remove ppp -s user`.)

Verify: `claude mcp list` shows `ppp`, then ask a chat to call `list_now_tasks`.

## Auth model

Service role + `POS_OWNER_ID` assert (`profiles.role = owner`, live). Solo local use only. User-JWT auth deferred.

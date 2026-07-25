---
name: ppp-add-task
description: >-
  Create a MYN project_task in ppp under a domain project. Use when Parker asks
  to add a task, remind him later, park something on /tasks, or put a follow-up
  on Education/Personal/Work/Ministry. Defaults: Personal, start=today (Chicago),
  Opportunity Now, no recurrence.
---

# ppp — add MYN task

Create one (or a short batch of) `project_tasks` rows on **hosted** ppp so they show on `/tasks`.

**Hard rules:** MYN tasks have **no due dates** — dated seminary work belongs in `/classwork`. `start_date` is when the task becomes actionable (appears in its zone); future starts sit in Deferred until that day.

## Defaults (unless Parker overrides)

| Field | Default |
|---|---|
| `project` | **Personal** (domain root) |
| `start_date` | **Today** Chicago civil (`ymdInChicago()`) |
| `priority` (zone) | **`opportunity_now`** |
| `notes` | omit, or fill from conversation context when useful |
| recurrence | **none** |

Zones: `critical_now` | `opportunity_now` | `over_horizon`.

## Ideal ask shape (accept freer prose too)

```text
Add MYN task:
- title: …
- project: Personal | Education | Work | Ministry | <child name>   # default Personal
- start: YYYY-MM-DD   # default today Chicago
- zone: critical_now | opportunity_now | over_horizon   # default opportunity_now
- notes: …   # optional
- recurring: no   # default; if yes, ask Parker to confirm rule or use /tasks UI
```

## Steps

1. **Resolve project** — prefer domain roots. Look up live id (do not trust stale UUIDs forever):

```sql
SELECT id, name, parent_id FROM projects
WHERE deleted_at IS NULL
  AND name ILIKE '<name>'
ORDER BY (parent_id IS NULL) DESC, name
LIMIT 5;
```

If ambiguous, ask. Domain roots (as of 2026-07): Personal, Education, Work, Ministry.

2. **Resolve start date** — if omitted, Chicago today via `ymdInChicago` from `$lib/invoicing/chicago-date` (or SQL `timezone('America/Chicago', now())::date`). Parse explicit `YYYY-MM-DD`.

3. **Title** — required; trim; ≤500 chars.

4. **Notes** — optional. If Parker gave a decision path / URL / checklist in chat, put a short version in notes.

5. **Insert** — Supabase MCP `execute_sql` is **read-only**; write with service role from repo root `.env` + `.env.local` (`PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POS_OWNER_ID`):

```ts
// npx tsx … — wrap in async main(); no top-level await under tsx -e cjs
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { ymdInChicago } from './src/lib/invoicing/chicago-date.ts';

config({ path: resolve('.env') });
config({ path: resolve('.env.local'), override: true });

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { data, error } = await supabase
  .from('project_tasks')
  .insert({
    project_id: '<resolved>',
    title: '<title>',
    priority: 'opportunity_now', // or override
    start_date: ymdInChicago(), // or override YYYY-MM-DD
    notes: null, // or string
    created_by: process.env.POS_OWNER_ID!
  })
  .select('id, title, priority, start_date, project_id')
  .single();
```

6. **Confirm to Parker** — title, project name, zone, start date, and that future starts appear under Deferred until that day. Link mindset: open `/tasks` (optional `?project=` filter).

## Do not

- Invent due dates on `project_tasks`.
- Default to Education/Work because the chat topic is seminary/work — only if stated or clearly implied (“under Education”).
- Create recurrence series unless Parker explicitly wants recurring **and** you can set `project_task_series` correctly (prefer `/tasks` sheet if unsure).
- Put service role keys in commits, skills output, or MCP client config.

## Batch

Multiple titles in one message → one insert each, same defaults, one confirmation table.

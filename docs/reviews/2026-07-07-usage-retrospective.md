# Usage retrospective — is ppp being used as designed?

**Date:** 2026-07-07 (overnight run, data as of 2026-07-06 ~9 PM Chicago)
**Method:** SELECT-only queries against the hosted production database (trigger-driven `audit_log` + module tables) via Supabase MCP. No analytics infra — the audit log *is* the analytics. Single-user context: every row is Parker, so "usage" means "did the ritual happen," not cohort math. Key SQL in the appendix.

---

## TLDR

- **Invoicing is the workhorse and is used exactly as designed.** 13 consecutive weeks of time entries (Apr 13 → today), logged same-day or next-day (avg lag ≤ 0.6 days), on 5–7 days of every week. $16,850 paid + $2,950 outstanding across 8 live invoices, all for 229 Project.
- **The projects weekly check-in ritual is real.** 5 of the 6 weeks since launch have **full 24/24 project coverage**, done in one sitting (single timestamp batch); health statuses are genuinely re-evaluated week to week (2–9 changes/week), not blind carry-forward. One week skipped (week of 6/21).
- **But three shipped projects features have literally zero rows:** MYN tasks (`/projects/tasks`), project links, and check-in progress tracking (048) — 0 tasks, 0 links, 0/120 check-ins with progress values, ever.
- **The library behaved exactly like a trip build:** a giant import burst (1,331 books in the week of Apr 26), an OCR blitz right before the move (555 scripture refs on May 16 + 18, all reviewed to zero), then near-dormancy — **17 books added since moving May 21**, zero OCR calls since.
- **The book review backlog is stuck:** 799 of 1,378 live books still `needs_review` (750 from the import), untouched since mid-May. Scripture-ref review was finished; book review was not.
- **The essay seed HAS been applied — tonight.** 5 essays + 2 essay authors + 17 `work_type` updates landed 2026-07-06 7:40 PM Chicago. PLAN.md "Next up #1" is done.
- **Newer invoicing features were adopted within days of shipping:** discard-sent (049) used on 6/22 itself (two sent invoices discarded and consolidated into INV-0017); billing preferences (050) set for both clients (6/22 and 6/29). The 059 dashboard shortcut is 1 day old — INV-0019 was generated the same morning it shipped, consistent with (though not provable as) the new button.
- **Several library metadata surfaces have never been touched:** `book_topics` (0 rows), ancient coverage (0 rows despite 70 seeded ancient texts), ratings (0), shelving location (0). Reading status has been static since the initial post-import curation.

---

## Projects (launched 2026-06-03)

**Structure:** 24 live projects, all `active`, 0 soft-deleted — 4 root domains (Education, Ministry, Personal, Work) with 20 descendants.

### Weekly check-in coverage (Sunday weeks, Chicago)

| week_of | check-ins | projects covered | created (one sitting) | watch | health Δ vs prior wk |
|---|---|---|---|---|---|
| 2026-05-31 | 24 | 24/24 | Jun 3–4 (launch) | 8 | — |
| 2026-06-07 | 24 | 24/24 | Mon Jun 8 | 8 | 2 |
| 2026-06-14 | 24 | 24/24 | Fri Jun 19 | 13 | 9 |
| 2026-06-21 | **0** | **skipped** | — | — | — |
| 2026-06-28 | 24 | 24/24 | Sun Jun 28 | 13 | 4 |
| 2026-07-05 | 24 | 24/24 | Mon Jul 6 | 12 | 5 |

This is weekly-ritual-shaped: full coverage, one batch per week, settling toward Sunday/Monday. The Jul 6 batch ran at 11:03 AM Chicago, ~2 minutes after generating and sending the weekly invoice — a tight Monday-morning routine. Health is actively maintained (only `satisfactory`/`watch` used; never a third state). Current watch list: 12 projects, concentrated in Ministry (6) and Education (Summer Hebrew, Summer Writing).

### Unused surfaces

- **`project_tasks`: 0 rows ever.** No creates, completes, defers, promotes — zero audit activity since the MYN page shipped ~Jun 4. Zone distribution: n/a.
- **`project_links`: 0 rows ever.**
- **Check-in progress fields (048): 0 of 120 check-ins** carry `progress_value`; `reason` and `next_steps` are also empty on all 120. The check-in in practice is *health status only*.

## Invoicing (built Mar–Apr 2026)

### Time entries — the strongest habit in the app

169 live entries (172 created, 3 soft-deleted in early April), all for 229 Project. Every week since Apr 13 has entries; hours ramped from ~10/wk in April to ~15–26/wk in May–June:

| week (Sun) | entries | hours | | week (Sun) | entries | hours |
|---|---|---|---|---|---|---|
| 04-12 | 14 | 10.3 | | 05-31 | 19 | 23.3 |
| 04-19 | 13 | 12.3 | | 06-07 | 9 | 19.0 |
| 04-26 | 16 | 16.3 | | 06-14 | 11 | 21.5 |
| 05-03 | 13 | 7.8 | | 06-21 | 12 | 14.5 |
| 05-10 | 9 | 12.0 | | 06-28 | 13 | 15.0 |
| 05-17 | 17 | 20.0 | | 07-05 | 3 | 11.0 (Mon only) |
| 05-24 | 20 | 26.3 | | | | |

Logging lag averages 0.1–0.6 days (max 4). The 333 `time_entries` UPDATE audit ops are mostly invoice-generation stamping `invoice_id`, not corrections.

### Invoices — real money, one real client

19 invoices all-time; 11 discarded, 6 paid ($16,850), 2 sent outstanding ($2,950). All live invoices belong to 229 Project (renamed from "This Week Health" Jun 4).

- April: 6 small Fountain of Life drafts + 2 duplicate drafts, all discarded — learning-curve noise.
- Since mid-May: a clean weekly/biweekly cadence — INV-0012 through 0019, generated Mondays, sent same day.
- **Discard-sent (049): used the day it shipped.** INV-0015 and 0016 (sent 6/9, 6/16, unpaid) were discarded 6/22 and consolidated into INV-0017 covering Jun 1–21 ($6,350, paid 6/30). This is exactly the workflow 049 was built for.
- **Billing preferences (050): both clients configured.** FOL → `monthly`/`monthly` (6/22); 229 Project → `weekly`/`weekly` (6/29). The `by_rate` default survives on neither.
- **Dashboard last-week generate (059):** shipped 7/6; INV-0019 (period Jun 29–Jul 5) was created 7/6 at 11:00 AM Chicago and sent 34 seconds later. Consistent with the one-click flow; too new to call adopted.
- **Fountain of Life is dead in the tool:** 0 live time entries, every invoice discarded, no activity since April. One-off line items: never used (all 8 live line items are period-based).

## Library (trip build, Apr–Jun 2026)

### Books over time

1,378 live books (1,403 created; 22 hard-deleted early, 3 soft-deleted). Creation is one cliff plus a trickle:

| week (Sun) | created | | week (Sun) | created |
|---|---|---|---|---|
| 04-26 | 1,331 (1,210 via import) | | 05-24 | 8 |
| 05-03 | 4 | | 06-14 | 5 |
| 05-10 | 28 | | 06-28 | 4 |
| 05-17 | 1 | | | |

**17 books added since the May 21 move** — light mobile ISBN-add use, matching the "usable from Madison" design goal, but the library is fundamentally in maintenance mode until August. (The large book UPDATE spikes — 1,239 on 5/1, 891 on 5/7, 798 on 5/19, 1,369 on 6/3 — are backfills: review clears, publisher linking, `author_display` denorm; not organic edits.)

### Review burndown — stalled

- **Books:** 799 of 1,378 still `needs_review` (750 from import, 49 other). 389 clears all-time, essentially all on May 7–8 (151 + 228). **Zero burndown since May 16.**
- **Scripture refs:** the opposite story — 555 live refs, **0 needing review, 0 soft-deleted**. All were OCR'd (100% have `source_image_url` + confidence) in a two-day blitz: 69 on May 16, 486 on May 18 — finished and fully reviewed three days before the move. 23 April-era experiments were hard-deleted.

### OCR

`library_ocr_usage` is **empty** — but the tracking table only shipped 5/19 (migration `20260519130000`), one day *after* the big OCR runs. Correct reading: heavy burst usage before tracking existed, **zero OCR calls since May 19**. The pipeline (incl. the PDF work in 030/034) is idle by circumstance (no physical books to scan in Madison), not by verdict.

### Essays — seed applied tonight

`essays` = 5, `essay_authors` = 2, created **2026-07-06 7:40 PM Chicago** — exactly the seed's rows (ἀγάπη/BDAG, Canon + Abraham + Covenant/ABD, λέγω/TDNT; Sanders + Kittel), plus 17 `work_type` updates and the BDAG series link. **Answer to PLAN.md Next up #1: yes, applied.** Owner smoke on ABD vol 1 presumably next.

### Never-used library surfaces

| Surface | Rows | Note |
|---|---|---|
| `book_topics` | 0 ever | successor to legacy `book_categories` (dropped; last activity 5/16) |
| `book_ancient_coverage` | 0 ever | despite 70 `ancient_texts` seeded 4/26 |
| `books.rating` | 0 books | |
| `books.shelving_location` | 0 books | |
| `book_bible_coverage` | 31 rows | light but *ongoing* (5/6 → 7/3) — the exception |

Reading status: `reference` 548 / `read` 469 / `unread` 299 / `in_progress` 61 — set during post-import curation (107 changes in the week of Apr 28), essentially frozen since (3 changes total after).

## Cross-cutting — what carries the load now

Audit ops by Sunday week since June (excluding backfills): the steady state is **time_entries (22–83 ops/wk) + project_updates (24/wk) + a trickle of books/invoices**. Weeks of Jun 7 and Jun 21 show the library at literally zero ops. The app has converged on two weekly rituals — Monday invoicing and the Sunday/Monday project check-in — with the library waiting for August.

---

## Keep / polish / stop-investing calls

| Surface | Call | Why (one line) |
|---|---|---|
| Time entries + weekly invoice flow | **Keep** | 13 unbroken weeks, same-day logging, real revenue |
| Discard-sent (049) + billing prefs (050) | **Keep** | Both adopted within a week of shipping |
| Dashboard last-week generate (059) | **Keep (watch)** | 1 day old; first Monday looks like it was used |
| Projects tree + weekly check-in | **Keep** | 5/6 weeks at 24/24 coverage; health genuinely maintained |
| Check-in progress fields (048) | **Stop investing** | 0/120 check-ins use progress, reason, or next_steps |
| MYN tasks `/projects/tasks` | **Decide (see Q1)** | 0 rows in 4+ weeks; don't build "global Now" on top of an unused base |
| Project links | **Stop investing** | 0 rows ever; leave shipped, build nothing more |
| Library mobile add (ISBN/OL) | **Keep** | 17 adds since the move — small but exactly the designed trip use |
| OCR pipeline | **Keep, pause investment** | Burst-use tool; idle only because the books are 1,000 miles away until August |
| Book review queue `/library/review` | **Polish** | 799-book backlog frozen since mid-May needs a plan, not more features |
| Turabian / essays (Wave 2) | **Keep building** | Driven by the September citation deadline, not usage; seed now live |
| `book_topics` + ancient coverage | **Stop investing** | 0 rows ever; revisit only if a paper workflow demands them |
| Ratings / shelving / reading-status flows | **Stop investing** | Static-after-import metadata; no ongoing workflow exists |

---

## Proposed decisions for Parker

**Q1 — MYN tasks page (`/projects/tasks`) has zero usage since launch. What now?**
- (a) **Deliberate adoption trial: use it as the only task list for 2 weeks (through ~Jul 20), then re-decide.** ← recommended — the build is done and untested by real life; usage data on an untried surface isn't a verdict yet
- (b) Stop investing now: freeze the page, cancel the "global Now view" backlog item until tasks have organic usage
- (c) Remove the nav entry entirely and archive the design
- If (a) fails, drop to (b) automatically.

**Q2 — Check-in progress/reason/next_steps fields are 0/120. What happens to them?**
- (a) Leave as-is (optional, invisible cost)
- (b) **Hide the fields from the check-in form; keep the columns.** ← recommended — cuts weekly form friction to match actual behavior (health-only), fully reversible
- (c) Drop the columns via migration (delete 048's schema)

**Q3 — 799 books stuck in `needs_review` since mid-May. How does it burn down?**
- (a) Scheduled burndown: ~50 books/week on `/library/review` starting now (16 weeks to zero)
- (b) **Bulk-accept import metadata for non-citation-critical genres; hand-review only `CITATION_CRITICAL_GENRES` before September.** ← recommended — the review exists to protect Turabian output, so scope it to what citations touch
- (c) Leave it until Wave 2 `.docx` export makes bad metadata visible organically

**Q4 — Fountain of Life client: 0 live time entries, all invoices discarded, silent since April.**
- (a) Keep active (work may resume)
- (b) **Soft-delete/archive the client until real billing exists.** ← recommended — it currently only adds noise to invoicing surfaces
- (c) Keep, but fix the workflow (monthly cadence is already set, so log entries when work happens)

**Q5 — Projects check-in cadence slipped once (week of 6/21 skipped, 6/14 filed on Friday). Add a nudge?**
- (a) **No mechanism; accept an occasional missed week.** ← recommended — 5/6 coverage with active health edits is a working ritual; don't automate what isn't broken
- (b) Add a dashboard "check-in overdue" banner when the current week has 0 updates
- (c) Fold the check-in into the Monday invoice routine explicitly (it already happens minutes apart)

---

## Method appendix — key SQL (SELECT-only, run 2026-07-06 evening)

All-time audit activity by table:

```sql
SELECT table_name,
  count(*) FILTER (WHERE operation = 'INSERT') AS inserts,
  count(*) FILTER (WHERE operation = 'UPDATE') AS updates,
  count(*) FILTER (WHERE operation = 'DELETE') AS deletes,
  min(changed_at)::date AS first_activity,
  max(changed_at)::date AS last_activity
FROM audit_log GROUP BY table_name ORDER BY count(*) DESC;
```

Weekly audit matrix (Chicago Sunday weeks, matching `src/lib/projects/week.ts`):

```sql
SELECT to_char(date_trunc('week', (changed_at AT TIME ZONE 'America/Chicago') + interval '1 day')
         - interval '1 day', 'YYYY-MM-DD') AS week_sunday,
  table_name, count(*) AS ops
FROM audit_log
WHERE changed_at >= '2026-04-25'
GROUP BY 1, 2 ORDER BY 1, ops DESC;
```

Project check-in coverage + field usage:

```sql
SELECT week_of, count(*) AS checkins, count(DISTINCT project_id) AS projects_covered,
  count(*) FILTER (WHERE progress_value IS NOT NULL) AS with_progress,
  min(created_at) AS batch_start, max(created_at) AS batch_end,
  count(*) FILTER (WHERE health_status = 'watch') AS watch_count
FROM project_updates WHERE deleted_at IS NULL
GROUP BY week_of ORDER BY week_of;
```

Week-over-week health movement (carry-forward vs. real re-evaluation):

```sql
WITH ranked AS (
  SELECT project_id, week_of, health_status,
    lag(health_status) OVER (PARTITION BY project_id ORDER BY week_of) AS prev
  FROM project_updates WHERE deleted_at IS NULL)
SELECT week_of,
  count(*) FILTER (WHERE prev IS NOT NULL AND health_status <> prev) AS health_changed
FROM ranked GROUP BY 1 ORDER BY 1;
```

MYN/links zero-usage check:

```sql
SELECT (SELECT count(*) FROM project_tasks) AS tasks,
  (SELECT count(*) FROM project_links) AS links,
  (SELECT count(*) FROM audit_log WHERE table_name IN ('project_tasks','project_links')) AS audit_rows;
```

Invoices with client, status, discard state:

```sql
SELECT i.invoice_number, c.name AS client, i.status, i.period_start, i.period_end,
  i.created_at::date, i.sent_at::date, i.paid_at::date, i.total,
  i.deleted_at IS NOT NULL AS discarded
FROM invoices i JOIN clients c ON c.id = i.client_id ORDER BY i.created_at;
```

Time-entry cadence and logging lag:

```sql
SELECT to_char(date_trunc('week', date::timestamp + interval '1 day') - interval '1 day',
  'YYYY-MM-DD') AS week_sunday,
  count(*) AS entries, round(sum(hours)::numeric, 1) AS hours,
  round(avg((created_at AT TIME ZONE 'America/Chicago')::date - date)::numeric, 1) AS avg_days_lag
FROM time_entries WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 1;
```

Billing-preference adoption (050):

```sql
SELECT changed_at, new_data->>'name' AS client,
  old_data->>'consultation_grouping' AS old_grouping,
  new_data->>'consultation_grouping' AS new_grouping
FROM audit_log WHERE table_name = 'clients' AND operation = 'UPDATE'
ORDER BY changed_at;
```

Books per week + review backlog + burndown:

```sql
SELECT to_char(date_trunc('week', (created_at AT TIME ZONE 'America/Chicago') + interval '1 day')
  - interval '1 day', 'YYYY-MM-DD') AS week_sunday,
  count(*) AS created, count(*) FILTER (WHERE import_match_type IS NOT NULL) AS via_import
FROM books GROUP BY 1 ORDER BY 1;

SELECT count(*) FILTER (WHERE needs_review) AS backlog,
  count(*) FILTER (WHERE needs_review AND import_match_type IS NOT NULL) AS from_import
FROM books WHERE deleted_at IS NULL;

SELECT changed_at::date, count(*) AS review_cleared
FROM audit_log WHERE table_name = 'books' AND operation = 'UPDATE'
  AND (old_data->>'needs_review')::boolean AND NOT (new_data->>'needs_review')::boolean
GROUP BY 1 ORDER BY 1;
```

Scripture refs OCR provenance; OCR usage table:

```sql
SELECT created_at::date, count(*),
  count(*) FILTER (WHERE source_image_url IS NOT NULL) AS with_source_image,
  count(*) FILTER (WHERE needs_review) AS still_needs_review
FROM scripture_references GROUP BY 1 ORDER BY 1;

SELECT * FROM library_ocr_usage ORDER BY usage_date;  -- returns 0 rows
```

Essay seed verification:

```sql
SELECT e.essay_title, b.title AS parent_book, e.created_at,
  (SELECT count(*) FROM essay_authors ea WHERE ea.essay_id = e.id) AS authors
FROM essays e JOIN books b ON b.id = e.parent_book_id ORDER BY e.created_at;
```

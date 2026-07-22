# 064 — Usage retrospective (overnight deep dive)

**Date:** 2026-07-07 (overnight run 2026-07-06 evening; answers recorded 2026-07-07)
**Module:** cross-module (repo-wide review)
**Tracker session:** Ad-hoc — overnight background agent, decision-first review

## Built

- Overnight SELECT-only usage review against prod (`audit_log` + module tables via Supabase MCP): [docs/reviews/2026-07-07-usage-retrospective.md](../reviews/2026-07-07-usage-retrospective.md) — per-module numbers, keep/polish/stop calls for 13 surfaces, reproducible SQL appendix. Morning synthesis canvas beside the chat.
- Headline: the app has converged on **two weekly rituals** — Monday invoicing (13 unbroken weeks of time entries, $16,850 paid) and the Sunday/Monday project check-in (5/6 weeks at 24/24 coverage) — while MYN tasks, project links, and check-in progress fields have **zero rows ever**, and 799 books sit in `needs_review` untouched since mid-May.

## Decided (Parker's answers, Q1–Q5)

- **Q1 — MYN tasks: 2-week adoption trial** (through ~2026-07-20) as the only task list, then re-decide. If it fails, drop to freeze (no global-Now build on an unused base). Rejected: freeze now; remove nav entry.
- **Q2 — Check-in progress/reason/next_steps: leave as-is** (0/120 usage accepted as optional-field cost). Rejected: hide from form (recommended), drop columns. No work scheduled.
- **Q3 — Review backlog (799 books): improve the queue, don't bulk-accept.** Parker wants `/library/review` made more useful for steady burndown over time, **plus an AI research pass** (agent proposes metadata fixes for `needs_review` books; owner confirms — never auto-clears). Session prompt added to PLAN.md. Rejected: bulk-accept non-critical genres; leave until organic.
- **Q4 — Fountain of Life client: archive** (soft-delete) until real billing exists. Owner quick action. ~~Open~~ — **done 2026-07-22** (owner soft-deleted).
- **Q5 — Check-in nudge: none.** 5/6 coverage with active health edits is a working ritual; occasional missed weeks accepted.

## Schema changes

- None (review was SELECT-only). Q2's columns stay.

## New components / patterns added

- `docs/reviews/` — new folder for deep-dive reports (durable outcomes still land here in `docs/decisions/`).
- Pattern: **overnight background research agents** (one per concern, SELECT-only DB guardrails, one report file each) → morning canvas synthesis → multiple-choice answers → decision files. Extends the 051 review pattern to unattended runs.

## Open questions surfaced

- **MYN trial verdict** — Parker — ~2026-07-20: adopted, or freeze + cancel global-Now backlog item.
- 059 dashboard shortcut adoption — re-check after a few Mondays (looked used on day one; not provable).

## Surprises (read these before the next session)

- The essay seed (PLAN.md Next up #1) was applied **during the overnight run** (2026-07-06 7:40 PM Chicago) — 5 essays, 2 essay_authors, 17 `work_type` updates confirmed in prod. Agents racing owner sessions can invalidate each other's findings same-night; timestamps matter.
- `library_ocr_usage` is empty **because tracking shipped one day after the big OCR runs** (migration `20260519130000` vs. the May 16/18 blitz) — not because OCR was unused.
- Scripture-ref review was drained to zero before the move; **book** review stalled completely — the same queue mechanic worked for one entity and not the other (rows vs. books; batch size).

## Carry-forward updates

- [x] components.mdc — no new components
- [x] AGENTS.md inventory — no new helpers
- [x] new env vars — none
- [x] PLAN.md refreshed (Next up, session prompts, MYN trial)

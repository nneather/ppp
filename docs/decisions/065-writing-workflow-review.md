# 065 — Writing workflow review (shelf → footnote → paper)

**Date:** 2026-07-07 (overnight run 2026-07-06 evening; answers recorded 2026-07-07)
**Module:** library
**Tracker session:** Ad-hoc — overnight background agent, decision-first review (feeds Wave 2)

## Built

- Overnight read-only review of the September citation path: [docs/reviews/2026-07-07-writing-workflow.md](../reviews/2026-07-07-writing-workflow.md) — 10 gaps ranked by September risk, Session 4 scope reconciliation, refined session prompt.
- Headline: **formatters are September-ready; the writing session is not.** A 20-page exegesis paper carries 40–70 *subsequent* references with no UI (`shortForm` in `turabian/format.ts` is only called from tests) and 60–100 `[page]` placeholders to hand-edit per paper.

## Overtaken by events (same night)

- The report's Session 4 recommendation (re-scope away from `.docx`) was **mooted mid-run**: Parker shipped `.docx` bibliography export in a parallel session ([063](063-library-wave2-session4-docx-export.md)), which closes the hanging-indent gap the report flagged (its gap 6). The remaining writing-session gaps become a **new session** (below), not a Session 4 re-scope.
- The essay seed was applied 2026-07-06 7:40 PM (gap 2 half-closed; `work_type` sweep still open → Q8).

## Decided (Parker's answers, Q6–Q9)

- **Q6 — Writing-session gaps session: yes, full scope** — "Copy short form" button (books + essays; essay short-form branch in `article.ts`), page input feeding `opts.page`, amber incomplete-citation caption via `computeMissingImportant`. Session prompt in PLAN.md. **Never build auto-"Ibid."** — ibid-correctness depends on Word-document adjacency the app cannot see; position-independent short form is always valid.
- **Q7 — Essay entries in compiled bibliography: manual merge for September** (3–8 signed entries per paper). The paper-scoped citation session (short-form registry + books-plus-essays compilation) is deferred as **one** future feature, not two.
- **Q8 — `work_type` backfill: one idempotent SQL sweep** over a reviewed list of reference works / edited volumes (IVP dictionaries currently dispatch as monographs), verified during August shelf QA. Rejected: organic per-volume fixes.
- **Q9 — Fixture validation: fold into August shelf QA** — validate all 20 *expected strings* against the Covenant guide itself (turabian-qa skill), not just re-run the suite; fix `article.ts` row-17 signed-ABD title duplication if confirmed wrong.

## Schema changes

- None. (`essays.page_start/page_end` INT-vs-TEXT noted as a defer-until-hit item in the report.)

## New components / patterns added

- None in code. Report documents the TDNT-abbreviated dispatch data dependency (`series_abbreviation` + translator row presence) — key it on something intentional when next touched.

## Open questions surfaced

- Row 17 (signed ABD) footnote title duplication — resolve against the Covenant guide in August (Q9).
- Whether `.docx` Word smoke (063 owner item) passes on Parker's actual Word — contingency already shipped, so this is verification only.

## Surprises (read these before the next session)

- "20/20 fixtures pass" carries **self-reference risk**: several expected strings were drafted from current output (056 says so for row 8; row 17 has the same smell). Green tests prove stability, not Covenant-correctness.
- The report and 063 independently converged on the `docx` npm package but diverged on placement (client-side dynamic import vs. server route). 063's server-only placement won by shipping; its rationale (zero client bundle impact, `docx` kept out of the turabian barrel) is sound.

## Carry-forward updates

- [x] components.mdc — no new components
- [x] AGENTS.md inventory — no new helpers
- [x] new env vars — none
- [x] PLAN.md refreshed (writing-session-gaps prompt; August shelf QA prompt extended with Q8/Q9)

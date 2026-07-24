# 159 — PLAN.md trim + file conventions

**Date:** 2026-07-24
**Module:** cross-cutting (process)
**Tracker session:** ad-hoc — owner: PLAN.md had grown to 460 lines / ~50KB and was mostly completed-work archive

## Built

- Trimmed `PLAN.md` from **460 → ~230 lines**. It is pasted into every Claude.ai session and auto-read by Cursor, so the bloat cost context on every session and buried the actual current state.
- Cuts (nothing lost — all of it persists in `docs/decisions/` and the module trackers):
  - **Recent decisions** ~45 entries → **last 5** (the header had claimed "last 3" while listing back to 065).
  - **Session prompts:** deleted every ✅-done block (Classwork S0/S1, the Library Wave-2 run, Sermons S2, R3/R4/R5 remediation, fall MYN polish, etc.); kept only LIVE prompts.
  - **Current focus:** collapsed the "shipped/complete/done" paragraphs to the actual focus (classwork + CRM) + hard dates.
  - **Active-modules table:** stripped the citation trails out of the State cells down to current status; the trails belong in the trackers.
- Added a **"How to use this file — read this first"** header codifying the record-here / look-there split so it doesn't re-bloat (see Decided).

## Decided

- **PLAN.md = *now*** (active focus, live prompts, Next-up queue). **`docs/decisions/NNN-*.md` = *what happened*** (one per session). **`docs/POS_*_Build_Tracker.md` = per-module detail.** PLAN points to the other two; it does not duplicate them.
- **End-of-session order:** (1) write the decision doc, (2) tick the module tracker, (3) update PLAN — bump Last updated, refresh the module row's *state* (not a citation trail), add one line to Recent decisions and **trim to the last 5**, and **delete any completed session prompt**.
- **Prompt policy:** full copy-paste block only for Do-now / Next work; deferred/someday items get a one-line pointer to their decision doc.

## Schema changes

- None.

## New components / patterns added

- None (docs only).

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- ppp had **in-progress uncommitted work** at trim time (Classwork Session 2 / MCP `course` tooling — modified `scripts/ppp-mcp/*`, new `src/lib/mcp/course.ts`, untracked decision 151). This restructure staged **only** `PLAN.md` + this doc and left that work untouched.

## Carry-forward updates

- [x] PLAN.md refreshed (this is the change)
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
- [ ] new env vars — none

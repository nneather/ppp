# 216 — Canvas classwork one-shot import

**Date:** 2026-08-31
**Module:** classwork
**Tracker session:** Ad-hoc (semester-start import; follows [173](173-canvas-classwork-import-deferred.md))

## Built

- Migration `20260831220000_classwork_canvas_ids.sql` — nullable `courses.canvas_course_id` / `assignments.canvas_assignment_id` with partial unique indexes (live rows only).
- CLI `npm run classwork:canvas-import` (dry-run default; `--apply` writes). Token stays in env (`CANVAS_HOST`, `CANVAS_TOKEN`) — never client.
- Pure mapping in `src/lib/classwork/canvas-map.ts` (Chicago `due_at`, Covenant name parse, kind heuristic, skip rules, Education-child project match).
- First pull applied to prod for **FA-26**: 5 courses + 34 assignments. Summer ST350 left untouched. Re-run is keep-only.

## Decided

- **CLI, not a settings UI** — one-shot / occasional re-pull, same shape as contacts sheet import. Preview prints to stdout; `--apply` writes. No OAuth.
- **Default skip:** unpublished, undated, non-`FA-26` (incl. Default Term exam shells), due before term floor (`FA-26` → 2026-08-01), Attendance/Participation, 0-point checks, Late Article/Book Reading. Flags: `--include-zero-point`, `--include-attendance`, `--include-makeup`, `--term=`, `--min-due=`.
- **Re-pull:** match on Canvas ids. Update title + `due_date` only; never change `status` / `completed_at`. Kind is insert-time heuristic only.
- **Projects:** link to an Education child when names match (`&` → and). CG515 Church Planting Trip had no child — `project_id` left null.
- Persist Canvas ids (the [173](173-canvas-classwork-import-deferred.md) recommendation). 0-point discussion/checks stay opt-in.

## Schema changes

- `20260831220000_classwork_canvas_ids.sql` — `canvas_course_id` / `canvas_assignment_id` bigint + partial uniques.

## New components / patterns added

- `src/lib/classwork/canvas-map.ts` — client-safe mapping.
- `src/lib/classwork/canvas-client.ts` — paginated Canvas REST (CLI).
- `src/lib/classwork/server/canvas-import.ts` — plan + apply.
- `scripts/classwork-canvas-import.ts` — dotenv CLI entry.

## Open questions surfaced

- Include CO330 0-point A-checks on a later re-pull (`--include-zero-point`)? Owner call if weekly reading checks should flood due-soon.
- CG515 has no Education project child — link later if wanted.

## Surprises (read these before the next session)

- Token lived in `.env` (Parker had it open), not `.env.local`. Script loads both. Prefer moving `CANVAS_TOKEN` to `.env.local`.
- AT411 still had a copied **2025-11-08** Case Study — skipped as stale.
- Covenant course titles are newline-glued (`OT340 -01:Psalms & Wisdom LiteratureFall 2026`). Parser strips code / section / term.
- `due_at` `…T04:59:59Z` is 11:59pm Chicago the **previous** civil day — use `ymdInChicago`, never the UTC date part.
- Canvas instructor for CM340 is literally `Dr. Richard`.
- Re-pull after apply: `courses +0/~0  assignments +0/~0`. Audit: 5 course INSERT + 34 assignment INSERT.

## Carry-forward updates

- [x] components.mdc — n/a (no UI)
- [x] AGENTS.md inventory + env + `classwork:canvas-import` script
- [x] new env vars documented (`CANVAS_HOST`, `CANVAS_TOKEN`)
- [x] tracker Open Questions / session arc updated

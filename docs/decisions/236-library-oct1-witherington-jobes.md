# 236 — Witherington SRC + Jobes LXX reader

**Date:** 2026-10-01
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20261001215000_library_oct1_witherington_jobes.sql` (hosted push):
  - *Conflict and Community in Corinth* — Ben Witherington III. New series **SRC** (Socio-Rhetorical Commentary, cited). Eerdmans, Grand Rapids, MI, 1995. ISBN `9780802801449`. Genre Commentary. `reading_status` reference. Coverage: 1 Corinthians, 2 Corinthians. `publisher_id` linked to Eerdmans.
  - *Discovering the Septuagint: A Guided Reader* — Karen H. Jobes (editor). Kregel Academic, Grand Rapids, MI, 2016. ISBN `9780825443428`. Genre Greek Language Tools. `work_type` edited_volume. `reading_status` unread. No bible coverage (not a commentary). No publishers-registry row.

## Decided

- SRC is a real series (Logos / Best Commentaries), not a subtitle. Short title; footnotes cite `SRC`, bibliography cites the series name. No volume number.
- New person `Ben` / null / `Witherington III` (suffix on last name, same as Robert III). Did not reuse any other Walton-style near-name; no prior Witherington row.
- Jobes is senior editor, not sole author. Nine student contributors omitted. Reused existing `Karen` / `H.` / `Jobes`.
- Kregel Academic stays free-text. Did not add a publishers-registry row mid-batch.

## Schema changes

- `20261001215000_library_oct1_witherington_jobes.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- `SRC` was free. Title-page line “A Socio-Rhetorical Commentary on 1 and 2 Corinthians” is the series, so it is not also stored as `subtitle`.
- ISBN checksums passed (`9780802801449`, `9780825443428`).
- `author_display` for the reader is `Karen H. Jobes (ed)`.

## Carry-forward updates

- [x] Decision + PLAN.md
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
- [ ] new env vars — N/A

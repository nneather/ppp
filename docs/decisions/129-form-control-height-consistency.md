# 129 — Form control height consistency (date + select)

**Date:** 2026-07-23
**Module:** app-shell / invoicing
**Tracker session:** ad-hoc — owner smoke (New time entry date field shorter than Client/Hours)

## Built

- `<Input>`: WebKit `date` / `datetime-local` / `month` / `week` / `time` — `appearance-none` + datetime-edit pseudos fill the control height so native date fields match sibling text/number inputs (was visually shorter on iOS despite `h-12`).
- `<Select.Trigger>`: height via mergeable size classes (`sm` / `default` / **`lg`**) instead of `data-[size]:h-*` (higher specificity blocked `class="h-12"` overrides). `lg` = `h-12` + `text-base` for sheet touch targets.
- Time entry + generate-invoice sheets: Client select uses `size="lg"`; one-off charge date aligned to default field height with its siblings.

## Decided

- Fix at shared primitives so every form benefits (tasks, sermons, rates, book form) — not a one-off on `<TimeEntrySheet>`.
- Keep denser `h-8` defaults on project/sermon sheets; invoicing sheets keep explicit `h-12` / `size="lg"` touch targets. Consistency = peers within a form share one height, not one global height for all modules.
- Rejected: custom date picker — keep native control; extend [112](112-task-sheet-date-overflow.md) WebKit hardening (width → height).

## Schema changes

- None.

## New components / patterns added

- `Select.Trigger` `size="lg"` for mobile sheet selects paired with `Input` `h-12`.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- `min-h-12` on Select could force 48px while `data-[size=default]:h-8` still “won” on `height` — Inputs with only `h-12` looked shorter when WebKit ignored date height. Both bugs stacked on the time-entry sheet.

## Carry-forward updates

- [x] PLAN.md — last-updated / Recent / Repo gate / Done recently
- [ ] components.mdc — N/A (primitive tweak only)
- [ ] AGENTS.md inventory — N/A
- [ ] new env vars — N/A

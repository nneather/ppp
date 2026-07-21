# 097 — Vercel deploy failures → CI build gate

**Date:** 2026-07-21
**Module:** cross-module (repo infra)
**Tracker session:** Ad-hoc — Vercel deploy investigation

## Built

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — added `npm run build` after `check` + `test` (same `PUBLIC_SUPABASE_*` placeholders as check).
- Documented the gate in [AGENTS.md](../../AGENTS.md) scripts + [`.cursor/rules/workflow.mdc`](../../.cursor/rules/workflow.mdc) end-of-session note.

## Decided

- **Root cause of the pasted Vercel failure** (commit `04ab2b0`, also `2ca5353`): duplicate `import { Label }` in `src/routes/library/books/[id]/+page.svelte` (once from `ui/label/index.js`, once from `ui/label`). Vite/`vite-plugin-svelte` failed with `Identifier 'Label' has already been declared`.
- **Code fix already on `main`:** [804eb5a](https://github.com/nneather/ppp/commit/804eb5af2ed94b4f591e6124c1b9a2847234678d) (`library: 094-writing-session-gaps`) removed the duplicate import (and fixed related `computeMissingImportant` check errors). HEAD `a31815f` builds locally and Vercel reports Production success.
- **Why it still hit Vercel:** GitHub Actions **did** fail `npm run check` on those commits (same Label error), but **`main` has no branch protection / required status checks**, so broken pushes still triggered Vercel. Adding `build` to CI closes the “check-green / Vite-red” gap for future parse/bundle-only failures; **required checks** remain the hard stop (owner action below).
- **Rejected:** re-breaking the file to “reproduce” — historical Vercel + Actions logs plus `git show 04ab2b0` are sufficient evidence.

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- **Owner — done:** Branch protection on `main` — require `check-and-test`, no force-push / no deletions, include administrators. Reviews left off (solo). Closed out in [105](105-solo-git-ship-agent-guidance.md).
- **Owner (optional smoke):** Confirm a later Vercel Production deploy stays Ready when CI is green.

## Surprises (read these before the next session)

- The writing-session citation UX commit (`2ca5353`) added a second `Label` import without noticing the existing one lower in the script — classic megacomponent import drift.
- ~~CI red on `main` is currently advisory only; Vercel does not wait for Actions.~~ **Superseded:** protection now requires `check-and-test` before landing on `main` ([105](105-solo-git-ship-agent-guidance.md)).

## Carry-forward updates

- [x] AGENTS.md inventory updated (scripts)
- [x] workflow.mdc end-of-session note
- [x] CI workflow includes `npm run build`
- [x] Parker: branch protection on `main` (required check `check-and-test`; no PR theater — [105](105-solo-git-ship-agent-guidance.md))

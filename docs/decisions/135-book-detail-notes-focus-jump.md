# 135 — Book detail personal-notes focus jump

**Date:** 2026-07-23
**Module:** library
**Tracker session:** ad-hoc

## Built

- Stopped personal-notes textarea from losing focus / jumping scroll on book detail while streamed below-fold DOM mounts (worst on commentaries with many scripture refs).
- Gate scripture ref rows + recorded-images block behind `refsOpen` so a closed `<details>` does not build hundreds of `<li>`s on promise resolve.
- One-shot `refsOpen` seed per book after first load (empty → open; has rows → closed); stop continuous effects that re-forced open state.
- While notes are being edited (`notesEditing`, delayed blur): defer assigning streamed `refs` / `topics` / `essays` and defer mounting Bible/ancient coverage editors; flush on settled blur or after notes save.
- Notes save restores `<main>` `scrollTop` + textarea focus (`preventScroll`) when the edit session was active.
- Bible / ancient coverage editors invalidate `app:library:book:<id>` (create ancient text also `app:library:ancient_texts`) instead of `invalidateAll()`.

## Decided

- Defer blur flush ~300ms so tapping **Save notes** (blur → click) does not mount the 66-chip coverage grid under the field mid-submit.
- Keep notes mid-page (no sheet / route move) — fix the stream/mount race instead.

## Schema changes

- None.

## New components / patterns added

- Book-detail pattern: `notesEditing` + pending stream buffers + coverage constructor stash (`loaded*Cmp`) before mount. Reuse when another mid-page field fights streamed below-fold DOM on iOS PWA.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Closed `<details>` still mounts children in the DOM — gating with `{#if refsOpen}` is required, not just `open={false}`.
- Immediate `onblur` flush races Save: blur fires before the submit button's click.

## Carry-forward updates

- [x] components.mdc updated (coverage editors — scoped invalidate)
- [ ] AGENTS.md inventory — N/A (page-local pattern)
- [x] new env vars documented — N/A
- [x] tracker Open Questions — N/A (ad-hoc)

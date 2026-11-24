# 320 — Psalm 23 bibliography export

**Date:** 2026-11-23
**Module:** studies
**Tracker session:** ad-hoc

## Built

- Copy bibliography and Download .docx on a study whose sources are all still candidates. Psalm 23 (17 sources, all `candidate`) had an empty consulted+cited bibliography, so Copy was disabled and the download link had no `href`.
- Include candidates starts checked in that case. One consulted or cited source keeps the narrower default. Unchecking the box still drops candidates.
- A disabled download link uses the same faded, non-clickable treatment as a disabled button. The anchor already had `aria-disabled` and no `href`; it did not look disabled.

## Decided

- Do not promote Psalm 23’s imported sets to consulted or cited. The export is a draft of the attached sources. BDB and HALOT stay out of the bibliography; they are unsigned lexicons.
- The download URL gets `candidates=1` from that starting checkbox, so the `.docx` matches Copy.

## Schema changes

- None.

## New components / patterns added

- `compiledBibliographyStartsWithCandidates` in [`src/lib/studies/source-usage.ts`](../../src/lib/studies/source-usage.ts).

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Psalm 23’s Word file still carries the Proverbs 31 bibliography and body. The app paper is the imported Psalms commentaries and OT language tools, not that file’s works cited.
- The download control is an anchor. `disabled:` styles never applied, so it looked live while the click did nothing.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] tracker follow-on — ad-hoc, no session row

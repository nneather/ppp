# 198 — Library Aug 12 shelf batch (classics + commentaries + Fitzgerald Homer)

**Date:** 2026-08-12
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built
- Migration `20260813032618_library_aug12_shelf_batch.sql` (hosted push):
  - **New series:** `OWC` (Oxford World's Classics).
  - **6 inserts:** Personal Heresy (1939 OUP, ISBN null); LCL Iliad II + Odyssey I; OWC Anselm Major Works (`edited_volume`); AB Knoppers `1 Chronicles 1–9` (vol 12); REC Casto `2 Corinthians`.
  - **Remint (same ids):** Cyber Classics *Iliad* + Buccaneer *Odyssey* → Fitzgerald / Farrar, Straus and Giroux (`9780374529055`, `9780374525743`); `reading_status` preserved `read`; Robert Fitzgerald `translator` rows added.
  - **Coverage verified:** `1 Chronicles` (Knoppers); `2 Corinthians` (Casto).

## Decided
- Personal Heresy: full title; **1939 Oxford** original (not HarperOne reissue); ISBN null.
- Anselm: OWC series; 2008 `9780199540082`; Saint Anselm author + Davies/Evans editors.
- Knoppers: `1 Chronicles 1–9`, Doubleday 2004, AB vol 12.
- English Homer shelf copies = Fitzgerald FSG (not soft-delete + re-insert — remint in place).
- Left **The Odyssey Homer** (Neilson / Harvard Classics HC) untouched — separate reference row.

## Schema changes
- `20260813032618_library_aug12_shelf_batch.sql` — DML only

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- None

## Carry-forward updates
- [x] Decision + PLAN.md
- [ ] components.mdc / AGENTS — n/a
- [ ] tracker Open Questions — n/a

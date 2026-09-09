# 219 — Library Sep 9 shelf batch

**Date:** 2026-09-09
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built
- Migration `20260909204500_library_sep9_shelf_batch.sql` (hosted push):
  - **Thiselton** *The Two Horizons: New Testament Hermeneutics and Philosophical Description* — Eerdmans 1980 paperback `9780802800060`; genre **New Testament** (hermeneutics monograph, not THNTC).
  - **Kidner** *Ezra and Nehemiah* — KCC 2024 `9781514005422` (orig. TOTC 1979); coverage Ezra + Nehemiah.
  - **Kidner** *The Message of Ecclesiastes* — BST 2023 revised `9781514006313` (orig. 1976); coverage Ecclesiastes.
  - **Leo XIV** *Magnifica humanitas: Encyclical Letter on Safeguarding the Human Person in the Time of Artificial Intelligence* — Libreria Editrice Vaticana 2026 `9788826610979`; genre **Ethics**. New person `Leo` / `XIV`.
  - **Sklar** *Additional Notes on Exodus* (2025), *Leviticus* (2023), *Numbers* (2023) — Gleanings Press, St. Louis; Amazon 979s; coverage Exodus / Leviticus / Numbers.
  - **ACCS OT III** *Exodus, Leviticus, Numbers, Deuteronomy* — IVP 2001 hardcover `9780830814732`, vol `3`, `edited_volume`; new person Joseph T. Lienhard (editor). Coverage Exodus–Deuteronomy.
  - Reused people: Anthony C. Thiselton, Derek Kidner, Jay Sklar. Series KCC / BST / ACCS already existed.
  - `needs_review = false` on all eight. Coverage verified for every Commentary.

## Decided
- Thiselton is the 1980 hermeneutics book (paperback), not a Two Horizons Commentary series volume.
- Kidner Ezra–Nehemiah hangs on **KCC**, not TOTC (KCC reprints; TOTC is a different ISBN).
- BST title follows sibling *The Message of Esther*; 2023 revised US imprint, not the 1976 *A Time to Mourn* print.
- Encyclical genre **Ethics** (Catholic social teaching on the human person / AI), not Applied Theology or Politics and Policy. Author display `Leo XIV` (not “Pope Leo XIV”).
- Sklar Additional Notes publisher **Gleanings Press** / St. Louis (title-page imprint), not Amazon’s “Independently Published”.
- ACCS OT III matches siblings: IVP (not IVP Academic string), arabic volume `3`, volume editor only (Oden is series general editor, not attached).
- `needs_review = false`.

## Schema changes
- `20260909204500_library_sep9_shelf_batch.sql` — DML only

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- “Two Horizons by Thiselton” is easy to misread as THNTC; Thiselton has no THNTC/THOTC volume (1–2 Thessalonians THNTC is C. Andrew Johnson). His NIGTC 1 Corinthians was already in the catalog.
- User typo *Liberia* → **Libreria** Editrice Vaticana. English LEV paperback ISBN `9788826610979` (Word on Fire / other imprints exist).
- Sklar Leviticus Additional Notes PDFs sometimes carry a second ISBN `9798397062022`; owner’s barcode `9798862875553` checksums and was used.

## Carry-forward updates
- [x] Decision + PLAN.md
- [ ] components.mdc / AGENTS — n/a
- [ ] tracker Open Questions — n/a

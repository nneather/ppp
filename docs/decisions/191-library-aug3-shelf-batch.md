# 191 — August shelf batch (commentaries + pastoral)

**Date:** 2026-08-03
**Module:** library
**Tracker session:** ad-hoc shelf add (library-add-books)

## Built
- Migration `20260803145115_library_aug3_shelf_batch.sql` (hosted push): **22** shelf books + series **Kidner Classic Commentaries** (`KCC`)
- Soft-deleted accidental Loeb Odyssey Vol I — owner confirmed only Vol II on shelf; follow-up `20260803145410_library_aug3_odyssey_v1_english_title.sql` renames that soft-deleted row to **Odyssey, Volume I: Books 1–12** (LCL `104`, ISBN-13 `9780674995611`) and re-asserts commentary bible coverage
- Skill update: Amazon paste / KCC vs TOTC / ApOTC / early-print ISBN null / standalone INSERT + coverage verify ([`.claude/skills/library-add-books/`](../../.claude/skills/library-add-books/SKILL.md))
- Commentaries: Loeb Odyssey Vol II (LCL 105), ICC Bigg Peter/Jude (1902, no ISBN), OTL Childs Exodus, ApOTC Lucas Daniel, Hermeneia Betz Galatians, KCC Kidner Proverbs + Psalms 1–72 / 73–150, NICOT Waltke Proverbs 1–15 / 15–31
- Non-commentaries: Pollack *Pun Also Rises*; Scazzero Church (expanded) + Discipleship; Kidner *Wisdom of Proverbs, Job and Ecclesiastes*; Allender/Longman *Cry of the Soul*; Branson/Martínez *Churches, Cultures, and Leadership* (2nd); Winter *When Life Goes Dark*; Collins *Reading Genesis Well*; Chan/Gill *Topical Preaching*; Benner *Strategic Pastoral Counseling*; Emlet *Descriptions and Prescriptions*; Greidanus *Preaching Christ from Ecclesiastes*
- Bible coverage on all Commentary volumes (Peter+Jude trio; Exodus; Daniel; Galatians; Proverbs; Psalms)

## Decided
- Soft-delete accidental Odyssey Vol I rather than UPDATE-in-place (owner never owned Vol I)
- Bigg ICC = **1902 print**, ISBN **null** (not T&T Clark reprint barcode)
- Childs Exodus hardcover ISBN `9780664209858`; Lucas Daniel US IVP Academic `9780830825196`
- Kidner Classic reprints → new series **`KCC`**, not attach to `TOTC`
- *Reading Genesis Well* genre **Old Testament** (not Pentateuch); *Pun Also Rises* → **Language**
- Churches/Cultures → **2nd ed 2023** (`9781514002872`)

## Schema changes
- `20260803145115_library_aug3_shelf_batch.sql` — DML only (series/people/books/authors/coverage + one soft-delete)
- `20260803145410_library_aug3_odyssey_v1_english_title.sql` — English title/vol/ISBN on soft-deleted Odyssey I + coverage re-assert

## New components / patterns added
- None (data migration)

## Open questions surfaced
- None blocking. Optional: normalize `author_display` for translator-heavy Loeb rows if Turabian ever needs Murray on the spine label (trigger currently authors-only — Homer only, Murray attached as `translator`)

## Surprises (read these before the next session)
- Existing LCL Odyssey Vol I was Greek-title `Ὀδύσσεια` with ISBN-10 only — soft-deleted rather than reminted
- `Hans Dieter Betz` denorms to **Hans D. Betz**; `Mark Lau Branson` → **Mark L. Branson**; `C. John Collins` → **C. J. Collins** (existing short-form trigger — fine)
- Emlet ISBN is `9781945270116` (common typo `194813…` fails checksum)

## Carry-forward updates
- [x] components.mdc updated (n/a)
- [x] AGENTS.md inventory updated (n/a)
- [x] new env vars documented (n/a)
- [x] tracker Open Questions updated (n/a — ad-hoc shelf)

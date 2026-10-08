# 237 — Library Oct 7 shelf batch

**Date:** 2026-10-07
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20261007222000_library_oct7_shelf_batch.sql` (hosted push). Six books, 21 new people, 25 essays on *Witness to the Gospel*.
  - *The Deep-Rooted Marriage* — Dan B. Allender (existing) and Steve Call. Thomas Nelson, Nashville, TN, 2025 hardcover `9781400344468`. Christian Living. Unread.
  - *Witness to the Gospel* — eds. I. Howard Marshall (existing) and David G. Peterson. Eerdmans, Grand Rapids, MI, 1998 `9780802844354`. Biblical Theology, `edited_volume`. 25 essays with page ranges from the *JETS* 43.2 contents list. Ben Witherington III reused (`last_name` already `Witherington III`).
  - *The Book of Job* — John E. Hartley (existing). NICOT, no volume number. Eerdmans, 1988 `9780802825285`. Commentary. Coverage: Job.
  - *How to Study the Bible's Use of the Bible* — Gary Edward Schnittjer and Matthew S. Harmon (both existing). Zondervan Academic, 2024 `9780310142454`. Biblical Theology.
  - *Septuaginta* — eds. Alfred Rahlfs and Robert Hanhart. Edition *Editio altera*, original year 1935, year 2006. Deutsche Bibelgesellschaft, Stuttgart. Hand edition `9783438051196`. Language Greek. Genre Bibles.
  - *A Greek-English Lexicon of the Septuagint* — Johan Lust, Erik Eynikel, Katrin Hauspie. Edition *Third Corrected Edition*, Deutsche Bibelgesellschaft, Stuttgart, 2015 `9783438051387`. Greek Language Tools.

## Decided

- Rahlfs shelf copy is the small hand edition, not the large-format Grossausgabe (`9783438051127`).
- LEH shelf copy is the 2015 DBG third corrected edition (`9783438051387`), not the Hendrickson 2008 reprint (`9781598562897`).
- Essays go in with the *JETS* page ranges. British spellings kept (*Realisation*, *Saviour*, *Defence*).
- Schnittjer spelling matches the existing person (double t), the same row as *Old Testament Use of the Old Testament*.
- Deutsche Bibelgesellschaft stays free-text. No new publishers-registry row. Place set to Stuttgart (existing DBG rows still have a blank location).
- `needs_review` false. Reading status `reference` for the commentary, Bible, and lexicon; `unread` for the other three.

## Schema changes

- `20261007222000_library_oct7_shelf_batch.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- Ben Witherington III is `last_name = 'Witherington III'`, `suffix` null ([236](236-library-oct1-witherington-jobes.md)). A lookup on last name `Witherington` misses him.
- `author_display` abbreviates a spelled-out middle: Marshall shows as `I. H. Marshall`; Schnittjer as `Gary E. Schnittjer`. Person rows are unchanged (`Howard`, `Edward`).
- Peter G. Bolt is new. John Bolt was already in the catalog. G. Walter Hansen is new. Collin Hansen and Morten T. Hansen were already there.
- ISBN checksums passed, including `9783438051387`.

## Carry-forward updates

- [x] Decision + PLAN.md
- [x] No new helpers (AGENTS.md / components.mdc unchanged)
- [x] DML-only — skipped `gen-types`
- [x] Commentary coverage verified (`Job`)

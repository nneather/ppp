# 087 — Library review-queue research cleanup + genre taxonomy

**Date:** 2026-07-17
**Module:** library
**Tracker session:** Ad-hoc — research pass on `/library/review` backlog (follow-on from [067](067-library-review-sprint-decks.md) / [068](068-library-review-ai-research-pass.md) / [070](070-library-genre-taxonomy-audit.md))

## Built

- **Review-queue burn-down via hosted migrations** — owner-confirmed genre/metadata writes (not proposals-only). Non-shelf `needs_review` went from ~721 → **0**; pending `book_metadata_proposals` → **0**; **50** books remain in Needs the shelf.
- **New genres** (CHECK + `GENRES`): `Politics and Policy`, `Leadership`, `Literary Criticism`, `Ancient Biblical Sources`, `Church Fathers`, `Children's and Young Adult`.
- **Retired / merged:** `Apostolic Fathers and Ancient Sources` → split then renamed: Apostolic Fathers + Ancient Sources → **Church Fathers**; Second Temple / Jewish / ANE primary sources → **Ancient Biblical Sources**.
- **`books.copy_count`** (`integer NOT NULL DEFAULT 1`, check 1–99) for multi-copy ownership without duplicate rows — wired through form, detail, CSV, loaders, actions.
- **Children's and Young Adult remaps** from Literature: Redwall/Jacques, Harry Potter, Narnia, classic kids, L’Engle, Starcatchers, and other clear YA; borderline (Hobbit, Ender’s Game, Catcher, Verne) stayed Literature.
- Notable data fixes during the pass: 7 Habits merge (`copy_count=2`), Urbana 18 Bible (`copy_count=13`), IVP Background NT author correction (Keener), Arnold Colossians ISBN/year, Keyword Study Bible editor/title, soft-delete junk rows, incomplete citation books tagged `Verify at shelf`.

## Decided

- Agent may write genres/metadata directly via migrations after owner Q&A batches (not only `book_metadata_proposals`).
- Politics vs Philosophy: political theory classics → Politics and Policy; Plato *Republic* stays Philosophy; Aristotle *Poetik* stays Philosophy.
- Ecclesiology used for BCO, Waters, Lucas, Ferguson, Niebuhr *Purpose of the Church*, Allison *Sojourners*, Newbigin *Household of God*.
- Shelf-bound books with incomplete year/publisher stay `needs_review` until Madison (except owner-confirmed ISBN clears: Siebenthal `9781789975864`, Casto Deuteronomy `9781629959726`).
- *Start Something New* → Christian Living; remains shelf-bound for title/edition verify.

## Schema changes

- `20260717150000_library_politics_leadership_copy_count.sql` — Politics/Leadership + `copy_count` + Batch 1 data
- `20260717151000` … `20260717174000` — review batches 2–6, Literary Criticism, AF split, Church Fathers / YA, Literature→YA, shelf follow-ups (all applied to hosted prod)

## New components / patterns added

- `books.copy_count` on `<BookForm>` (“Copies owned”) + book detail when `> 1`.
- Genre taxonomy only — no new reusable helpers beyond existing `GENRES` sync rule.

## Open questions surfaced

- None blocking. **50** Needs-the-shelf books await physical check (ISBN/year/publisher/edition).

## Surprises (read these before the next session)

- MCP `execute_sql` is read-only; all writes go through `npm run supabase:db:push` migrations.
- Genre CHECK must be opened (new labels allowed) before remapping off a retired label, then tightened.
- AI Research deck volume is now **drained**; phone smoke of accept flow is less urgent than Madison shelf deck.

## Carry-forward updates

- [x] `GENRES` in `src/lib/types/library.ts` synced
- [x] AGENTS.md / PLAN.md updated this session
- [ ] components.mdc — BookForm copy_count is a field, not a new component (no inventory row)
- [x] `npm run check` + `npm run test` (229/229) 2026-07-17

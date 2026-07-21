---
name: library-recommend-genre
description: >-
  Recommend the correct genre for one or more books against ppp's closed
  library genre taxonomy. Use when adding a book (library-add-books), doing a
  Goodreads/shelf/backlog enrichment pass, resolving an AI research proposal
  on /library/review, or whenever a book's genre is missing, wrong, or
  ambiguous (Commentary vs Reference, Language Tools vs Language, Theology
  family, NT/OT sub-genres, Politics and Policy vs Philosophy, Church Fathers
  vs Ancient Biblical Sources, Literature vs Children's and Young Adult).
---

# Library — recommend genre

## Source of truth (read this first, every time)

`GENRES` in [`src/lib/types/library.ts`](../../../src/lib/types/library.ts) is the **only** valid list — it must exactly mirror the `books_genre_check` CHECK constraint. **It changes often** (41→46→47→57 values across [070](../../../docs/decisions/070-library-genre-taxonomy-audit.md) → [073](../../../docs/decisions/073-library-drama-genre.md) → [087](../../../docs/decisions/087-library-review-queue-research-cleanup.md), 2026-07-07 to 07-17). Read the live array before recommending anything — never rely on a remembered list, including the examples below.

Retired labels — never propose these, even if they sound plausible:
- `Pastoral` → merged into `Pastoral Ministry` (070)
- `Apostolic Fathers and Ancient Sources` → split into `Church Fathers` (patristic-era authors) + `Ancient Biblical Sources` (Second Temple/Jewish/ANE primary sources) (087)

## Decision order (most specific wins)

Check in this order; stop at the first match:

1. **Commentary** — verse-by-verse or passage-by-passage exposition of a specific Bible book/section, regardless of testament or topic. Always wins over any NT/OT sub-genre.
2. **Existing sibling in prod** — same series, same author, or an obviously similar title already shelved? Match its genre over reasoning from scratch (consistency beats a fresh guess). See SQL in [reference.md](reference.md).
3. **Reference work** (dictionary/encyclopedia/lexicon/concordance/handbook) — biblical/theological subject → `Biblical Reference`; general-purpose (a German encyclopedia, a thesaurus) → `Reference`. See the 070 cleanup for the canonical example of this split.
4. **Language study tool** — grammar/lexicon/reader/textbook *for* a specific language → `<Language> Language Tools`. A book merely *written in* that language, or about language/translation as a topic, is not a Language Tool.
5. **NT/OT specific topic, not a commentary** — use the most specific sub-genre before falling back to plain `New Testament` / `Old Testament`.
6. **Theology family** — `Systematic Theology` / `Biblical Theology` / `Historical Theology` / `Applied Theology` / `Christology` / `Ecclesiology` / `Pneumatology` before falling back to plain `Theology`.
7. **History-adjacent** — `Church History` (institutional/denominational history) vs `History` (secular) vs `Historical Theology` (history of doctrine) vs `Church Fathers` / `Ancient Biblical Sources` (primary texts, not histories about them).
8. **Practice/leadership** — `Pastoral Ministry` vs `Leadership` vs `Politics and Policy` vs `Ecclesiology`. Worked examples in [reference.md](reference.md).
9. **Fiction/narrative** — `Literature` vs `Children's and Young Adult` vs `Drama` vs `Poetry` vs `Literary Criticism`.
10. **Catch-alls, last resort** — `General` (secular nonfiction/ideas) vs `Other` (hobby/craft/travel/misc) vs `Self-Help` vs `Hobbies`. Pick the closest fit; don't default to `Other` just because it's first alphabetically... it isn't, and that's not a reason either way.

If nothing genuinely fits, that's a **taxonomy gap, not a recommendation** — propose a new genre to the owner and follow the extend-enum-then-migrate pattern from 070/073/087 (see [reference.md](reference.md)) rather than mis-tagging.

## Functional consequence — check before tagging into/out of these

`CITATION_CRITICAL_GENRES` in `src/lib/library/turabian/types.ts` (`Commentary`, `Bibles`, `Biblical Reference`, and the 5 `* Language Tools` genres) drives the full Turabian citation-completeness gate on `/library/review`. Tagging a book into or out of this set changes what fields it's required to have. Don't do it casually for an edge case.

## Workflow

**Single book, conversational ask** — state the recommended genre + one-line rationale. No DB write needed unless asked.

**Batch / backlog pass** (Goodreads triage, shelf QA, review-queue drain) — mirrors [library-add-books](../library-add-books/SKILL.md) and decisions 087/096:

1. Pull the candidate books + current genre via `execute_sql` (read-only — fine for research).
2. Propose a table (title → recommended genre → one-line rationale); flag genuinely ambiguous ones as numbered questions for the owner.
3. **Never use `execute_sql` to write** — it runs in a read-only transaction (`ERROR 25006`) even in Agent mode. Write via a migration: `npm run supabase:db:push:dry` → `npm run supabase:db:push`.
4. If any proposed genre isn't in the current `GENRES` array, extend the CHECK constraint in the same or a preceding migration first.
5. `npm run supabase:gen-types` (habit, even though `genre` is a plain `string | null` in generated types — keeps the pre-commit hook happy), `npm run check`, `npm run test`.
6. File `docs/decisions/NNN-*.md`, refresh PLAN.md.

## Do not

- Propose a retired label (`Pastoral`, `Apostolic Fathers and Ancient Sources`)
- Trust a remembered genre list instead of reading `GENRES` fresh
- Write genre changes through `execute_sql`
- Silently invent a new genre value without owner sign-off — that's a taxonomy change
- Tag a book `Commentary`/`Bibles`/`Biblical Reference`/a Language Tools genre (or move it out) without checking the `CITATION_CRITICAL_GENRES` consequence

## Additional resources

[reference.md](reference.md) — SQL snippets, migration templates, and the accumulated disambiguation examples (Politics and Policy vs Philosophy, Ecclesiology, YA vs Literature boundary, Drama) from decisions 070/073/087/096.

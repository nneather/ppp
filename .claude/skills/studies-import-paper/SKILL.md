---
name: studies-import-paper
description: >-
  Import a seminary paper into the ppp Studies paper database with its
  bibliography attached as cited sources. Use when Parker hands a paper
  (.docx or pasted text) and asks to add it to papers, studies, or the paper
  database, with its bibliography, as in progress, drafting, or published.
---

# Studies — import a paper and its bibliography

Hosted Supabase only (`objtrdmmqlndtfddtzan`). `execute_sql` is read-only. Writes are one idempotent DML migration, then `npm run supabase:db:push`. Precedent: [306](../../docs/decisions/306-inheritance-paper-bibliography.md).

## Read the paper

Bibliography section only. Names that appear in the prose but not the bibliography stay off the paper unless Parker asks.

From the title page: full title, passage, course code, title-page date, and publication line if any.

`pandoc` may be missing. `textutil -convert txt -stdout file.docx` works on this Mac.

## Stop if this paper already exists

Before inserting, list live papers (`deleted_at` is null). Stop and ask when:

- the normalized titles match, or one long title (24+ characters, articles and punctuation stripped) is a prefix of the other, or
- the primary passage is the same Bible book and chapter (and the same starting verse when both name one).

Use the existing paper. Do not insert a second row. Proverbs 31 was the case this guards.

## Paper row

| He says | `papers.status` |
|---|---|
| in progress, drafting | `drafting` |
| researching | `researching` |
| submitted | `submitted` |
| published | `published` |
| complete, archived | `archived` |

Unstated status → `drafting` (shows under Studies → papers in progress). Say that in the confirm.

- `passage_display` set → the passage leads the page; the title is the second line. Exegesis → `topical = false`. A topical paper → `topical = true` and a topic.
- `due_date` = title-page date when there is one.
- Link `course_id` only when that course already exists. Current classwork often lacks the old course. Put the course (and a journal issue, if published) in `notes`. Do not insert a course.
- Insert `paper_passages` for the primary range (`1 Corinthians 14:26-33a` → chapter 14, verses 26–33). Hit rate reads this table, not the display string. `verse_end` is the integer; the “a” stays in `passage_display`.

## Match the shelf before creating anything

Do not trust keyword search alone. `Baptism and Fullness` missed the owned row `Baptism & Fullness`.

For each bibliography entry, SQL on live `books` (and `essays` + parent book):

- Fold case and punctuation. Treat `and` and `&` as the same.
- Require the author last name on short or generic titles (`1 Corinthians`).
- Include `owned = false` stubs.

| Hit | Do |
|---|---|
| Same work, same year, different imprint (Zondervan vs Baker Academic) | Attach the shelf row. Report the imprint. |
| Same work, different year | Ask. It may be a second copy (1975 shelf vs 2006 citation). |
| Article in a reference work already on the shelf (TDNT, NIDNTT, BDAG) | Attach the **essay** on that volume, not the whole set. NIDNTT (Colin Brown) is not NIDNTTE. |
| Set cited once (*Institutes*, 2 vols; van Mastricht) | Attach every **owned** volume. Say the compiled bibliography will list each volume. |
| No row | It is missing. Do not insert yet. |

Same last name is not the same person (library Foerster ≠ TDNT Werner Foerster). Keep particles in the last name (`de Vos`).

## Stop and ask — missing books

“Add this paper” is the go-ahead for the paper and for clear shelf matches.

It is not permission to mark a missing **book** not-owned. List those titles and ask which he owns. Owned → `owned = true`. Not owned → `owned = false`.

Journal articles are not that question, and they are not books. Insert a `journal_articles` row (title, journal, volume, issue, year, pages, DOI) plus `journal_article_authors`, then attach `study_sources.article_id`. Reuse a live article with the same title and journal. Do not insert a book stub, and do not put the citation in `notes`.

One confirm message:

1. Paper: title, status, passage, due date, notes.
2. Shelf matches, including imprint or year differences.
3. Numbered ownership question for missing books only.
4. Journal articles that will be added (author, journal, year). They are not an ownership question.

Write after he answers. If he already said which ones he owns, do not ask again.

## New book rows

Follow [library-add-books](../library-add-books/SKILL.md) for people, publishers, series, and ISBN checks. Genre from [library-recommend-genre](../library-recommend-genre/SKILL.md).

- Commentary he does not own: `genre = Commentary`, bible coverage for the books in the title, `owned = false`, `needs_review = false`.
- Monograph: publisher + Turabian location. Link `publisher_id` when the imprint exists. Set `publisher_location` when the bibliography’s place differs from `publishers.default_location`.
- `needs_review = false` when title, author, genre, year, and publisher are set. Do not park these on `/library/review`.
- `title_sort_key` is generated. Leave it unset.
- `created_by` = the owner profile (`profiles.role = 'owner'`).

## Sources

Bibliography headings become `study_research_groups` (`Articles and Monographs`, `Commentaries`, `Theology`), in that order.

Each entry is one `study_sources` row: `usage = 'cited'`, `book_id` XOR `essay_id` XOR `article_id`, `sort_order` following the bibliography, `group_id` set.

## Migration

`supabase migration new studies_<slug>`. Idempotent by natural key (paper title; person name parts; book title + author). A follow-up note change is a **new** file — never edit an applied migration.

Then `npm run supabase:db:push`. Verify with SELECT: paper, passage, groups, and each source’s title, author, owned, usage. Open `/studies/papers/<id>` when the dev server is up.

File the next `docs/decisions/` entry, and one line each on PLAN.md and the Studies tracker. No new component.

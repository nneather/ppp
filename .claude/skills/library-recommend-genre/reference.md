# Library genre recommendation — reference

Companion to [SKILL.md](SKILL.md). Read when running a batch pass or resolving a genuinely ambiguous call.

## SQL

**Check a similar/sibling title's existing genre (do this before reasoning from scratch):**

```sql
SELECT id, title, genre FROM books
WHERE deleted_at IS NULL
  AND (title ILIKE '%<keyword>%' OR title ILIKE ANY(ARRAY['%<series/author keyword>%']))
ORDER BY title;
```

**Current distribution (sanity-check a hypothesis before proposing a taxonomy change):**

```sql
SELECT genre, count(*) FROM books WHERE deleted_at IS NULL GROUP BY genre ORDER BY count(*) DESC NULLS LAST;
```

**Sample titles under a candidate genre (to see what it's actually being used for):**

```sql
SELECT title, subtitle FROM books WHERE deleted_at IS NULL AND genre = '<genre>' ORDER BY title;
```

All of the above are safe via MCP `execute_sql` (read-only). **Writes are not** — `execute_sql` runs in a read-only transaction unconditionally (`ERROR 25006: cannot execute UPDATE in a read-only transaction`), even in Agent mode. Use a migration (`npm run supabase:db:push`) for any actual genre write, single book or batch.

## Migration templates

**Data-only genre backfill** (genre already exists in `GENRES` — most batch passes):

```sql
UPDATE public.books
SET genre = '<new genre>'
WHERE deleted_at IS NULL
  AND id IN ('<uuid>', '<uuid>');
-- or, for a title-keyed batch where ids weren't collected up front:
-- AND title IN ('Exact Title One', 'Exact Title Two');
```

**Adding a new genre value** (taxonomy change — needs owner sign-off first): add the value to `GENRES` in `src/lib/types/library.ts` (alphabetical), then a migration that `DROP CONSTRAINT IF EXISTS books_genre_check` / `ADD CONSTRAINT ... CHECK (genre IS NULL OR genre IN (...))` with the full updated list (`NOT VALID` + `VALIDATE CONSTRAINT` — see `20260707223000_library_nt_ot_subgenres.sql` for the exact shape). If any pending `book_metadata_proposals` reference a retired label, backfill `fields->genre->proposed` in the same migration (see `20260707220000_library_merge_pastoral_genre.sql`).

**Retiring/splitting a label**: open the CHECK to allow both old and new labels, backfill every row off the old label, *then* tighten the CHECK to drop it. Never tighten before the backfill — a live row still on the old value will fail `VALIDATE CONSTRAINT`. (087: `Apostolic Fathers and Ancient Sources` → `Church Fathers` + `Ancient Biblical Sources` this way.)

## Accumulated disambiguation examples

Pull from the source decision for full rationale before extending a pattern to a new case — these are illustrative, not exhaustive rules.

| Genre A | Genre B | Rule of thumb | Source |
|---|---|---|---|
| `Biblical Reference` | `Reference` | Biblical/theological subject vs general-purpose (a German encyclopedia set, a thesaurus) | [070](../../../docs/decisions/070-library-genre-taxonomy-audit.md) |
| `Politics and Policy` | `Philosophy` | Political theory classics (e.g. modern political science) → Politics and Policy; Plato's *Republic*, Aristotle's *Poetics* stay Philosophy | [087](../../../docs/decisions/087-library-review-queue-research-cleanup.md) |
| `Literature` | `Children's and Young Adult` | Redwall, Harry Potter, Narnia, L'Engle, Starcatchers, classic kids' books → YA. Borderline (*The Hobbit*, *Ender's Game*, *The Catcher in the Rye*, Verne) stayed Literature — owner call, not mechanical | [087](../../../docs/decisions/087-library-review-queue-research-cleanup.md) |
| `Literature` | `Drama` | Stage plays, play collections, drama anthologies (Shakespeare, Marlowe, Greek drama) → Drama. A book *about* a playwright (e.g. a leadership book using Shakespeare as a lens) is not a play text — stays Literature | [073](../../../docs/decisions/073-library-drama-genre.md) |
| `Pastoral Ministry` | `Leadership` / `Ecclesiology` | `Ecclesiology` used for church-polity/doctrine-of-the-church works: BCO, Waters, Lucas, Ferguson, Niebuhr's *Purpose of the Church*, Allison's *Sojourners*, Newbigin's *Household of God*. General church-leadership practice stays Pastoral Ministry or moves to Leadership depending on whether it's church-specific | [087](../../../docs/decisions/087-library-review-queue-research-cleanup.md) |
| `Church Fathers` | `Ancient Biblical Sources` | Patristic-era named authors (Apostolic Fathers, later fathers) → Church Fathers; Second Temple/Jewish/ANE primary sources (non-patristic) → Ancient Biblical Sources | [087](../../../docs/decisions/087-library-review-queue-research-cleanup.md) |

## Taxonomy change trail

Read the latest of these before assuming the current genre count or rule set — this list will itself go stale:

- [070](../../../docs/decisions/070-library-genre-taxonomy-audit.md) (2026-07-07) — full audit; merged `Pastoral`; added `Acts and Paul`/`Pentateuch`/`Old Testament Historical Books`/`Psalms and Wisdom Literature`/`Prophets`; `Biblical Reference` → `Reference` cleanup. 41→46 values.
- [073](../../../docs/decisions/073-library-drama-genre.md) (2026-07-08) — added `Drama`. 46→47.
- [087](../../../docs/decisions/087-library-review-queue-research-cleanup.md) (2026-07-17) — added `Politics and Policy`, `Leadership`, `Literary Criticism`, `Ancient Biblical Sources`, `Church Fathers`, `Children's and Young Adult`; retired `Apostolic Fathers and Ancient Sources`. 47→57 (also picked up `Christology`/`Ecclesiology`/`Pneumatology`/`Hobbies`/`Self-Help` — check this decision or a newer one for exact provenance if it matters).
- Check `git log -- src/lib/types/library.ts` or `docs/decisions/` for anything after 087.

## Related workflows

- [library-add-books](../library-add-books/SKILL.md) — batch shelf adds; genre is one field in its research pack.
- `library:review-research` (`scripts/library-review-research/`) — automated AI classification for the null-genre backlog at scale; builds its prompt from the live `GENRES` array, so it never needs a code change when the taxonomy grows.
- `ship-library-change` — the gate to run after any migration touching `books_genre_check`.

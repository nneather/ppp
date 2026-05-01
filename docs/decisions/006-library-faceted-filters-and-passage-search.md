# 006 — Library faceted filters + passage search UI (Session 3)

**Date:** 2026-04-29
**Module:** library
**Tracker session:** Session 3

## Built

- **Trigram migration** at [`supabase/migrations/20260429190000_books_title_trigram_index.sql`](../../supabase/migrations/20260429190000_books_title_trigram_index.sql) — `CREATE EXTENSION pg_trgm` + three GIN indexes (`books.title`, `books.subtitle`, `people.last_name`). Backs the `?q=` keyword search across title / subtitle / author last_name. Sized for Session 4's 1,288-row load: substring search `ILIKE '%q%'` hits the GIN trigram index instead of seq-scanning. Types regenerated; only diff is the two pg_trgm helper functions (`show_limit`, `show_trgm`) appearing in the public-schema typegen output.
- **Filter-aware list loader** at [`src/lib/library/server/loaders.ts`](../../src/lib/library/server/loaders.ts) — `loadBookListFiltered(supabase, people, filters)` (alongside the original `loadBookList` for any caller that wants the unfiltered list, e.g. the `<SourcePicker>` Session 2 may add later) plus `countLiveBooks(supabase)` for the "Showing N of M" header chip. Filter shape:
  ```ts
  type BookListFilters = {
    genre?: string[];
    category_id?: string[]; // matches primary OR junction
    series_id?: string[];
    language?: Language[];
    reading_status?: ReadingStatus[];
    needs_review?: boolean;
    q?: string;
  };
  ```
  AND between filter types, OR within. `q` runs across `books.title` / `books.subtitle` (PostgREST `.or('title.ilike.*q*,subtitle.ilike.*q*')`) plus a parallel `people.last_name` ILIKE → `book_authors` join → `id.in.(book_ids)` clause appended into the same `.or()`. Category filter is applied client-side after the row fetch because PostgREST can't easily express "primary_category_id IN ids OR any junction.category_id IN ids" in one query — cheap for the few hundred rows that matter here.
- **`/library` page** rewritten at [`src/routes/library/+page.server.ts`](../../src/routes/library/+page.server.ts) + [`src/routes/library/+page.svelte`](../../src/routes/library/+page.svelte) — parses URL params via `multiParam` (accepts both repeated `?genre=A&genre=B` and CSV `?genre=A,B`; emits repeated form on round-trip), enum-validates `language` / `reading_status` against `LANGUAGES` / `READING_STATUSES`, calls `loadBookListFiltered`. UI: header has search input (200ms debounce → `goto()` with `keepFocus: true, noScroll: true`), "Search passage" link, "New book" button. Desktop renders a left-rail facet panel (sticky, `md:grid-cols-[16rem_1fr]`). Mobile: a "Filters" button opens a `<Sheet side="bottom">` with the same `{#snippet filterBody()}` content (single source of truth — snippet renders identically in both surfaces). Active filters render as removable pill chips above the list with a "Clear all" link.
- **`/library/search-passage` route** at [`src/routes/library/search-passage/+page.server.ts`](../../src/routes/library/search-passage/+page.server.ts) + [`src/routes/library/search-passage/+page.svelte`](../../src/routes/library/search-passage/+page.svelte) — pure GET form. Validates `bible_book` against the `bibleBookNames` allowlist (silently drops bad input rather than 400ing). Calls `supabase.rpc('search_scripture_refs', {...})` with `chapter`/`verse` undefined-when-null so the SQL function's defaults apply. Result rows show book title + subtitle + formatted ref (`fmtRef` reused inline) + page range, plus badges: "Manual" (green, `manual_entry === true`), `XX%` confidence (when OCR), "Review" (amber, when `needs_review`). Each row links to `/library/books/[id]#ref-<uuid>`.
- **Deep-link highlight** in [`src/routes/library/books/[id]/+page.svelte`](../../src/routes/library/books/%5Bid%5D/+page.svelte) — new `$effect` reads `page.url.hash`, matches `^#ref-<uuid>$`, calls `document.getElementById(...).scrollIntoView({ behavior: 'smooth', block: 'center' })`, sets a 2.2s `highlightedRefId` flag that paints the matching `<article>` with an amber ring + shadow. Tracks `page.url.hash` so it re-fires on hash-only navigation (back/forward + result re-clicks) instead of just on mount.
- **`PassageResult` + `BookListFilters` types** at [`src/lib/types/library.ts`](../../src/lib/types/library.ts) — `PassageResult` mirrors the `search_scripture_refs` RPC's RETURNS TABLE shape; `BookListFilters` is the URL-driven filter snapshot.

## Decided (non-obvious)

- **Trigram migration shipped now**, not deferred to Session 4. Pre-plan question called this out as the explicit fork. Rationale: ten lines of SQL + a one-time `db push`, vs. discovering at Session-4-acceptance time that the 1,288-row keyword search seq-scans. The migration is idempotent (`CREATE EXTENSION IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`), so rerunning costs nothing. The pg_trgm extension also installs `show_limit` / `show_trgm` helpers into the public schema, which surface in `database.ts` typegen — committed alongside the migration as the only public-schema diff.
- **Single entry point** to `/library/search-passage` via a header outline button on `/library`. Tabs and inline-mini-form rejected to keep IA simple and give passage search a full mobile screen (it's the most-used summer flow per the tracker).
- **PostgREST `.or()` survived** for the `q` keyword search — no fallback to a `search_books(p_q text)` SQL function was needed. The trick is appending `id.in.(<bookIds>)` from the parallel author-match query into the same `.or()` filter, so a single `books` query covers all three columns (title / subtitle / author last_name).
- **Native `<select>`** for the bible-book picker on the passage-search page — 66 options, mobile-first, iOS Safari renders a native bottom sheet that beats anything we'd build with shadcn's `<Select>` for keyboard + voiceover. Same convention used in scripture-reference-form.
- **Snippet for filter body** — `{#snippet filterBody()}` lets the desktop sticky aside and the mobile `<Sheet>` render the exact same chip rail markup. Beats extracting a third component when the markup is co-owned by a single page.
- **Category filter is client-side post-fetch** — PostgREST has no neat way to express "match primary_category_id OR any book_categories junction row." The "fetch with junction in nested select, filter in JS" path is cheap (max ~few hundred rows pre-Session-4, ~1,288 after) and keeps the rest of the loader honest about its real query shape.
- **`?` URL params encode multi-value as repeated keys**, not CSV — easier to read in dev tools, exactly what `URLSearchParams.getAll(key)` returns. The parser accepts both forms for paste-friendliness; emit only repeated form.
- **Chip-vs-checkbox**: closed enums (genre, language, reading_status) and reference rows (categories, series) all render as toggleable chips, not checkboxes. Less chrome, faster to scan, and the active state (`bg-primary text-primary-foreground`) is unmistakable on both desktop and mobile.

## Schema changes

- [`supabase/migrations/20260429190000_books_title_trigram_index.sql`](../../supabase/migrations/20260429190000_books_title_trigram_index.sql) — `pg_trgm` extension + three GIN indexes. Applied 2026-04-29 via `supabase db push`. Types regenerated.

## New components / patterns added

- **Pattern: URL-param-as-source-of-truth for list filters.** Server `load` parses `url.searchParams` into a typed `Filters` shape; page renders against `data.filters` (not local state); user toggles call a `pushFilters(next)` helper that builds a new URL and `goto(target, { keepFocus: true, noScroll: true })`. Back/forward, deep-linking, and SSR-safety all fall out for free. Scope this pattern to any list page that needs faceted filtering.
- **Pattern: snippet-as-single-source-of-truth for desktop-aside + mobile-sheet panels.** When the same chip-rail / filter form needs to appear in two layout slots (sticky aside on desktop, `<Sheet side="bottom">` on mobile), define `{#snippet panelBody()}` once at module scope and `{@render panelBody()}` in both slots. Beats extracting a third component for markup that's wholly co-owned by a single page.
- **Pattern: hash-driven deep-link highlight with auto-clear.** `$effect` tracks `page.url.hash`, matches a typed pattern (`^#ref-<uuid>$`), `scrollIntoView`s the matched element, sets a state flag for 2.2s, then clears. Tracks the hash state so back/forward navigation (which doesn't trigger a fresh load) re-runs the effect cleanly. Pattern reuses for any list page that linkable sub-rows.
- No new reusable component extracted — the snippet pattern above kept the filter UI inline. If a third surface needs the same chip rail, promote `{#snippet filterBody()}` to `<LibraryFilterPanel>` and register in [`.cursor/rules/components.mdc`](../../.cursor/rules/components.mdc).

## Open questions surfaced

- **Bibliography-export quoting** — search results page hand-rolls `fmtRef` / `fmtPages` helpers; the same helpers exist on the book detail page. Promote to `src/lib/library/format.ts` when (a) Session 6 raw-field copy lands and needs the same shape, or (b) Session 8 Turabian generator wants the canonical reference string. Not blocking now.
- **PostgREST `.or()` cap** — appending `id.in.(<list>)` to a `.or()` works but the URL grows linearly with author-hit count. Untested at scale; if Session 4's 1,288-row library produces author searches matching hundreds of `book_id`s, fall back to a `search_books(p_q text)` SECURITY INVOKER SQL function. Not blocking now.
- **Filter chip overflow** — on mobile when many filters are active the chip rail wraps; not an issue at fixture scale, may want a horizontal scroll or "+N more" collapse when 10+ filters are active. Defer.

## Surprises (read these before the next session)

23. **Snippets MUST live in markup, not script.** I initially tried closing `</script>` after `{#snippet filterBody()}` as if it were a script-block construct — Svelte 5 snippets are top-level markup that lives between `</script>` and the page's outer markup, NOT inside the script tag. The compiler's "`</script>` attempted to close an element that was not open" error is what tells you you've put a snippet in the wrong half of the file.
24. **`$state` initialized from props warns "state_referenced_locally" even when intended.** When initializing local form state from `data.query.foo`, Svelte's analyzer sees that as a "reactive value referenced once at init" pattern and warns. Fix is the same shape as Session 1.5c/h: initialize empty (`$state('')`), then hydrate inside a `$effect(() => { ... = data.foo; })` that runs once on mount AND re-runs on back/forward navigation. Bonus: the form re-syncs to URL state on history navigation for free.

## Carry-forward updates

- [x] [`docs/POS_Library_Build_Tracker.md`](../POS_Library_Build_Tracker.md) — Session 3 row updated.
- [x] [`.cursor/rules/library-module.mdc`](../../.cursor/rules/library-module.mdc) — URL-param-as-source-of-truth pattern + snippet-shared-panel pattern documented.
- [x] No new reusable components extracted; [`.cursor/rules/components.mdc`](../../.cursor/rules/components.mdc) unchanged.
- [x] No new env vars introduced.

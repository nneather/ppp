# Library edition cleanup (OL binding/revision junk)

Lists live `books.edition` values that look like the old Open Library prefill bug
(`physical_format` + revision → e.g. `Paperback — 9`), or binding-only strings.

Uses `isLikelyOlBindingEditionJunk` from `src/lib/library/open-library-prefill.ts`.

## Run

```bash
# Dry-run (default)
npx tsx scripts/library-edition-cleanup/clearBindingEditions.ts

# Apply — clears matching edition to NULL (owner confirm required)
LIBRARY_EDITION_CLEANUP_CONFIRM=yes npx tsx scripts/library-edition-cleanup/clearBindingEditions.ts --apply
```

Needs `LIBRARY_DST_DATABASE_URL` (or `LIBRARY_RESEARCH_DATABASE_URL` Session Pooler) in `.env.local`.
IPv4 networks auto-derive the Session Pooler from the Direct URI (same helper as `library:review-research`).

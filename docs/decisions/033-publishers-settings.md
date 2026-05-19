# 033 — Library publishers settings

**Date:** 2026-05-20
**Module:** library

## Built

- `publishers` table: canonical imprint, `parent_id` groups (IVP / IVP Academic), `default_location`, `aliases[]`, soft-delete + `merged_into_id`.
- `books.publisher_id` + `books.reprint_publisher_id` FKs; backfill migration from normalized text match.
- `library_merge_publishers` RPC (owner-only, non-revertible audit).
- `/settings/library/publishers` CRUD + merge UI.
- `matchPublisher` / `normalizePublisherName` shared by OL prefill, book form, review queue.
- Citation resolution: `publisher_canonical` + `publisher_effective_location` on loaders; Turabian uses book override → imprint default → parent default.

## Decided

- Single `publishers` table with self-FK (not separate groups table) so each imprint stays citable by name.
- Free-text `books.publisher` retained for unmapped books; `publisher_id` optional.
- Covenant `n.p.` placeholders deferred — fill location via registry or per-book override only.

## Schema changes

- `20260520120000_publishers.sql` — table + book FKs
- `20260520120100_publishers_seed.sql` — scholarly core imprints
- `20260520120200_publishers_backfill.sql` — `normalize_publisher_text()` + `books.publisher_id` backfill
- `20260520120300_library_merge_publishers.sql` — merge RPC + audit gating

## New components / patterns

- `src/lib/library/publisher-resolve.ts` — effective location + canonical text
- `src/lib/library/server/publishers-settings-actions.ts` — settings CRUD/merge
- `src/lib/library/server/publishers-settings-book-counts.ts`

## QA

- Add by ISBN → Baker Academic prefills canonical + `Grand Rapids, MI` when OL omits place.
- Review queue → “Use Eerdmans” / “Use location” chips when raw text matches alias.
- Settings → edit IVP Academic default location → existing books without override pick up new city in citations.

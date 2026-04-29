# ppp — Agent Operating Guide

This is the single entry point for any AI assistant working on this repo. Read this first.

The Cursor rules in `.cursor/rules/*.mdc` are loaded automatically by Cursor; if you are running outside Cursor, read them manually:

- [.cursor/rules/always.mdc](.cursor/rules/always.mdc) — stack, conventions, non-negotiables
- [.cursor/rules/db-changes.mdc](.cursor/rules/db-changes.mdc) — migration checklist
- [.cursor/rules/sveltekit-routes.mdc](.cursor/rules/sveltekit-routes.mdc) — page server / form action shape
- [.cursor/rules/edge-functions.mdc](.cursor/rules/edge-functions.mdc) — Edge Function conventions
- [.cursor/rules/components.mdc](.cursor/rules/components.mdc) — component inventory
- [.cursor/rules/hotkeys.mdc](.cursor/rules/hotkeys.mdc) — Mod+letter chord conventions
- [.cursor/rules/library-module.mdc](.cursor/rules/library-module.mdc) — library specifics

## How to start a build session

Paste this template at the top of every chat that begins a tracked session:

```
Session: <module> #N — <name>
Tracker:  <path-to-tracker>.md, Session N
Read:     AGENTS.md, .cursor/rules/<relevant>.mdc, src/lib/types/database.ts,
          docs/decisions/ (latest 3 files)
Goal:     <one sentence>
Acceptance:
  - [ ] <copy from tracker>
  - [ ] npm run check passes
  - [ ] viewer RLS verified for any new table
  - [ ] audit_log row exists for an example write
  - [ ] mobile-width screenshot captured
End-of-session deliverables:
  - [ ] tracker session marked done with notes
  - [ ] docs/decisions/<NNN>-<slug>.md filed (use template at the bottom of this file)
```

## Carry-forward inventory (use these, do not reinvent)

### Database

- `app_is_owner()`, `app_is_viewer_writer(p_module text)` — `SECURITY DEFINER` RLS helpers. **Required** for any new RLS policy. See `supabase/migrations/20260413150000_rls_all_policies_use_helpers.sql`.
- `set_updated_at()` trigger function — attach to every table with `updated_at`.
- `write_audit_log()` trigger + `audit_log_trigger` — attach to every table.
- `generate_invoice_number()` — invoicing-specific; pattern is reusable for any sequenced display id.
- Soft delete: `deleted_at TIMESTAMPTZ`, filtered by `IS NULL` in app queries.
- All baseline objects: `supabase/migrations/00000000000000_baseline.sql`.

### Components — see [.cursor/rules/components.mdc](.cursor/rules/components.mdc) for the full inventory

### Patterns

- **Form action result shape**: `{ kind, success?, message?, <entityId>? }`. See `src/routes/settings/invoicing/+page.server.ts` for the canonical example.
- **Per-row form state**: include the entity id in the result so the page can show the error/success on the right card.
- **Multi-value text fields**: `text[]` columns + `EmailChipsEditor`-style component.
- **Per-user defaults**: column on `profiles`, not a separate table.
- **Edge Function soft-delete handling**: do not filter parents by `deleted_at` — historical artifacts must reload.
- **Audit log UI**: `/settings/audit-log` (`src/routes/settings/audit-log/`). Module-scoped via the `_INVOICING_TABLES` / `_LIBRARY_TABLES` whitelists in `+page.server.ts`. When a new module ships, extend `_LIBRARY_TABLES` (or add a new whitelist) and add the matching option to the module `<select>`. Revert is UPDATE-only and additionally gated by `_REVERTIBLE_TABLES`; library tables are intentionally excluded — see [docs/decisions/001-audit-log-ui.md](docs/decisions/001-audit-log-ui.md).
- **Hotkeys**: every primary-action button (Save, Update, Delete, Edit, Generate) needs a `hotkey` prop on `<Button>` drawn from the reserved set: `s u d e g`, plus `b` as a per-label mnemonic (e.g. "New **B**ook"). **Cancel = `hotkey="Escape"`** (bare Esc, bubble-phase, bails on `event.defaultPrevented` so open autocomplete dropdowns win). **Anchors (`href`) skip the dev-warn but can still take a hotkey.** Letters that conflict with browser/OS chords (`n t w r q l p f m h`) or with clipboard / select-all in inputs (`c x v z y a`) are explicitly NOT registered. Reserved letters live in `src/lib/hotkeys/registry.ts`. Convention + rationale: [.cursor/rules/hotkeys.mdc](.cursor/rules/hotkeys.mdc). Enforcement: dev-only `console.warn` in the Button component + `.cursor/hooks/hotkey-missing.sh` afterFileEdit hook.
- **Library helpers** at `src/lib/library/`:
  - `src/lib/types/library.ts` — closed enums (`GENRES`, `LANGUAGES`, `READING_STATUSES`, `AUTHOR_ROLES`) + view-models (`BookListRow`, `BookDetail`, `PersonRow`, `ScriptureRefRow`, etc.). Reuse before improvising.
  - `src/lib/library/polymorphic.ts` — `PolymorphicParent` discriminated union + `validateXor` + `insertPolymorphicRow<T>`. Reused by `scripture_references`, `book_topics`, `book_bible_coverage`, `book_ancient_coverage`. **Do not invent four versions** per [.cursor/rules/library-module.mdc](.cursor/rules/library-module.mdc).
  - `src/lib/library/storage.ts` — `SCRIPTURE_IMAGES_BUCKET`, `SCRIPTURE_IMAGES_SIGNED_URL_TTL`, `scriptureImagePath({ userId, bookId, ext })`. Single source of truth for the `library-scripture-images` bucket name + path convention; imported from both server (signed-URL generation in loaders) and browser (upload in form components).
  - `src/lib/library/server/loaders.ts` — `loadBookList`, `loadBookDetail`, `loadCategories`, `loadSeries`, `loadPeople`, `loadPersonBookCounts`, `loadBibleBookNames`, `loadScriptureRefsForBook` (with per-row 1h signed-URL generation), `personDisplayShort/Long`. Used by `/library` and `/library/books/[id]`.
  - `src/lib/library/server/book-actions.ts` — `createBookAction`, `updateBookAction`, `softDeleteBookAction`, `undoSoftDeleteBookAction`, `createPersonAction`, `updateReadingStatusAction`. Returns `{ kind, success?, message?, bookId?|personId? }`.
  - `src/lib/library/server/scripture-actions.ts` — same shape for `scripture_references`: `createScriptureRefAction`, `updateScriptureRefAction`, `softDeleteScriptureRefAction`. Wired into `/library/books/[id]` Session 2.

### Scripts

- `npm run check` — svelte-check
- `npm run supabase:db:push:dry` — review migration diff before applying
- `npm run supabase:db:push` — apply migrations to prod
- `npm run supabase:gen-types` — regenerate `src/lib/types/database.ts` (run after every migration)
- `npm run supabase:deploy-functions` — deploy Edge Functions
- `npm run supabase:ship` / `:ship:apply` — combined flow

## Environment variables

Two files. Both are gitignored.

| File | Purpose | Examples |
|---|---|---|
| `.env` | Project ref / non-secret config used by CLI scripts | `SUPABASE_REF` |
| `.env.local` | Real secrets and public client config | `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY` |

Rules:

- Anything prefixed `PUBLIC_` is exposed to the client — only safe-to-publish values (URL, anon key).
- Edge Function secrets live in Supabase: `supabase secrets set NAME=value`. They are **not** read from `.env.local` at runtime — duplicate them in both places (.env.local for local dev, Supabase secrets for prod).
- When you add an env var, document it in the relevant decision-log entry.

## Decision log — `docs/decisions/`

One file per build session. Filed at session end. This is the input to the *next* session's Session 0 audit.

Naming: `NNN-short-slug.md` (`001-app-shell.md`, `002-time-entries.md`, ...).

### Template

```md
# NNN — <session title>

**Date:** YYYY-MM-DD
**Module:** invoicing | library | projects | ...
**Tracker session:** Session N

## Built
- <bullet — what shipped>

## Decided
- <bullet — non-obvious decision and the alternative rejected>

## Schema changes
- <migration filename + one-line summary>

## New components / patterns added
- <path — purpose. Update components.mdc if reusable.>

## Open questions surfaced
- <question — owner — when it must be resolved>

## Surprises (read these before the next session)
- <bullet — anything that bit you>

## Carry-forward updates
- [ ] components.mdc updated
- [ ] AGENTS.md inventory updated
- [ ] new env vars documented
- [ ] tracker Open Questions updated
```

## Pre-commit safety net

A Cursor hook in `.cursor/hooks.json` warns when a migration is changed without regenerating `src/lib/types/database.ts`. If you see that warning, run `npm run supabase:gen-types` and include the result in the same commit.

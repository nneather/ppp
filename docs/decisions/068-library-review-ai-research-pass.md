# 068 — Review queue: AI research pass (gamification Session B)

**Date:** 2026-07-06
**Module:** library
**Tracker session:** Ad-hoc — review-queue improvement ([064](064-usage-retrospective-review.md) Q3, Session B of two; Session A: [067](067-library-review-sprint-decks.md))

## Built

- **`book_metadata_proposals` table** (migration `20260707030000_library_book_metadata_proposals.sql`, applied to prod + `gen-types` run): per-book pending proposal with `fields` JSONB (per-field `{current, proposed, source, note}`), `status` pending|accepted|rejected, `reviewed_at`, full soft-delete/audit/`set_updated_at` conventions. **Partial UNIQUE index enforces one live pending proposal per book.** RLS: owner-all + `app_has_module_read('library')` SELECT + separate viewer-writer INSERT/UPDATE. Added to `_LIBRARY_TABLES` audit-log whitelist.
- **Generation script** `scripts/library-review-research/proposeMetadata.ts` (`npm run library:review-research`, mirrors `library-language-audit`: dry-run TSV default, `--limit`, `--apply` behind `LIBRARY_RESEARCH_CONFIRM=yes`): Open Library by ISBN → year / publisher / publisher-location for missing fields; Anthropic (batched 20 books/call, closed `GENRES` enum, one-line rationale) → genre, when `ANTHROPIC_API_KEY` is present. Excludes shelf-bound books and books with an existing pending proposal; `ON CONFLICT DO NOTHING` against the unique pending index makes re-runs safe. **Never touches `books` / `needs_review`.**
- **Card integration:** `<ReviewProposalPanel>` renders per-field current → proposed rows; Apply fills the card's existing quick-edit state (Apply all included); the normal **Confirm** submits — `reviewSaveAction` then marks the proposal `accepted` (≥1 field applied) or `rejected`, bound to the card's `book_id`. **Dismiss proposal** posts `?/resolveProposal` (rejected) without touching the book; in the Research deck it also advances the card. Genre Sprint chips pre-highlight an AI-proposed genre with a sparkle badge.
- **Research deck live:** `proposal=pending` filter implemented as a `book_metadata_proposals!inner(id)` embed + status filters on both the card loader and count query (verified against prod PostgREST: exactly the 30 seeded books).
- **First real run:** `--limit 100 --apply` against prod (Session Pooler URI) — 100 ISBN books scanned, **30 pending proposals inserted** (OL-only: publisher locations, publishers, years), 30 audit rows confirmed. Genre classification skipped — no local `ANTHROPIC_API_KEY` (see Open questions).

## Decided

- **Accept/reject semantics ride the existing confirm** rather than a separate accept action: `accepted` = at least one proposed value was applied at save time (client computes `proposal_resolution` from the applied-fields set). Rejected alternative: an explicit per-proposal Accept button that writes the book directly — would duplicate `reviewSaveAction`'s merge logic and blur the "owner confirms the card, not the robot" contract.
- **Proposal resolution is best-effort after the book save** — a failed proposal UPDATE only logs; the unique pending index means a stale pending row simply resurfaces. Rejected: transactional RPC (not worth a SECURITY DEFINER function + REVOKE ceremony for a cosmetic failure mode).
- **Proposable fields locked to what the card can apply**: `genre`, `year`, `publisher`, `publisher_location` (`PROPOSAL_FIELDS` in `src/lib/types/library.ts`). Series/authors proposals deferred — no quick-edit surface on the card.
- **Script connects via Session Pooler on IPv4 networks** — the Direct URI host is IPv6-only (same finding as [055]/[066] backups); `LIBRARY_RESEARCH_DATABASE_URL` overrides, derivable with `scripts/backup-restore-verify/derive-pooler-url.ts`. `ssl: 'require'` on the connection (pooler rejects plaintext).
- Security-review subagent pass (RLS migration): **no medium+ findings**; took its optional hardening anyway — `resolveProposalAction` validates the UUID, and confirm-path resolution binds `proposal_id` to the card's `book_id`. Bugbot pass on the full diff: no bugs.

## Schema changes

- `20260707030000_library_book_metadata_proposals.sql` — new `book_metadata_proposals` table (RLS, triggers, grants, one-pending-per-book partial unique index). Applied to prod; `src/lib/types/database.ts` regenerated.

## New components / patterns added

- `src/lib/components/review-proposal-panel.svelte` — proposal diff panel (components.mdc updated).
- `src/lib/library/server/proposal-actions.ts` — `resolveProposalAction`, `markProposalResolved(…, bookId?)`.
- `ReviewProposal` / `ReviewProposalFieldDiff` / `PROPOSAL_FIELDS` view-models in `src/lib/types/library.ts`; `ReviewCard.proposal` attached in `loadReviewQueue` (one extra batched query per card page).
- `scripts/library-review-research/` — proposal generator + README; npm script `library:review-research`.
- Pattern: **conditional `!inner` embed for existence filters** — `select` string gains `child!inner(id)` only when the filter is active, paired with `.eq('child.status', …)` embed filters; works for both data and `head:true` count queries.

## Open questions surfaced

- **`ANTHROPIC_API_KEY` is not in `.env.local`** (it lives only as a Supabase Edge secret) — genre proposals, the highest-value slice (585 genre-only books), are waiting on it. Owner: drop the key into `.env.local`, then `LIBRARY_RESEARCH_CONFIRM=yes npm run library:review-research -- --apply` for the full backlog. OL-only proposals work today.
- Remaining ~440 ISBN books after the first 100 — run the script again (it skips books with pending proposals automatically).
- RLS smoke matrix (`scripts/rls-smoke`) does not yet cover `book_metadata_proposals` — add read-viewer-deny-UPDATE / write-viewer-allow cases next time staging is touched.

## Surprises (read these before the next session)

- **The Direct database URI is unreachable from IPv4-only networks** (ENOTFOUND on the AAAA-only host) — anything CLI that "worked at home" may fail on other networks; the pooler derivation script from 055 saved the session.
- Raw-curl smoke tests of PostgREST select strings must strip whitespace — `child!inner ( id )` is a PGRST100 parse error over the wire, but supabase-js normalizes it before sending, so the same string works in code.
- OL hit rate on the first 100 ISBN books was 30% for proposable fields — most of those books already had year+publisher; the gap OL actually fills is `publisher_location`.

## Carry-forward updates

- [x] components.mdc updated (`review-proposal-panel`)
- [x] AGENTS.md inventory updated (review helpers, proposal actions, script + npm script)
- [x] new env vars documented (`LIBRARY_RESEARCH_DATABASE_URL`, `LIBRARY_RESEARCH_CONFIRM`, optional `ANTHROPIC_RESEARCH_MODEL` — script README + AGENTS.md)
- [x] tracker Open Questions — n/a (ad-hoc; PLAN.md refreshed)

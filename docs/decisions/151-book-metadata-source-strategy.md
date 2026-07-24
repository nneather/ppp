# 151 — Book metadata source strategy (OL quality assessment)

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc — assessment + direction lock (no code)

## Built

- Nothing shipped — decision-only session. Assessed the Open Library prefill pipeline against its failure history and the current landscape of bibliographic sources; locked the next move.

## Decided

- **Root cause named:** OL's problems are structural (crowd-sourced, wiki-style data), not tunable. The recurring patches — edition junk ("Paperback — 9", [143](143-ol-edition-prefill-person-edit.md)), traditional state abbreviations ([115](115-publisher-location-postal.md)), imprint-dedupe hack, mismatched authors via polluted work-level author lists, 30% proposable-field hit rate ([068](068-library-review-ai-research-pass.md)) — all trace to upstream data entry no normalizer can fix.
- **Field classes have different best sources:** edition-exact facts (title/subtitle/authors/year/pages/language) → publisher-ONIX-fed **Google Books**; citation-only facts (publisher place, edition statement, series) → library MARC data or **our own registries**; closed-taxonomy fields (genre, work_type) → AI proposals (already built).
- **Locked (Parker, multiple-choice):** next library session adds **Google Books as a parallel prefill source with per-field cross-checking** — `volumes?q=isbn:` fetched concurrently with OL; GB preferred for edition-exact fields, OL kept for place/series; **agreement = silent autofill, disagreement or single-source = visible provenance flag in the form**. The flag is the real fix: the "Paperback — 9" class of pollution happened because plausible junk sailed through confirmation unmarked.
- **Registries stay the long-term fix** — `publishers.default_location`, canonical imprint names, series registry make citation fields deterministic regardless of source quality; the publisher link passes ([145](145-eerdmans-publisher-link-pass.md)–[149](149-nibc-all-hendrickson.md)) keep compounding.
- **Held in reserve (rejected for now):** server-side prefill proxy for MARC sources (LoC SRU `bath.isbn=` → MODS; Harvard LibraryCloud JSON — strongest citation-grade place/edition/series data, and Harvard Divinity coverage suits the domain) — needs a proxy endpoint + XML parsing, LoC reliability is middling; revisit only if GB cross-check + registries leave gaps.
- **Rejected outright:** ISBNdb (paid monthly, no place data), WorldCat (institutional access only), per-scan AI reconciliation (latency + cost in the phone flow; batch proposals path from [068](068-library-review-ai-research-pass.md) is the right surface and can grow multi-source cross-checks instead).

## Schema changes

- None.

## New components / patterns added

- None (session prompt for the build filed in PLAN.md › Session prompts).

## Open questions surfaced

- Google Books anonymous quota (~100 req/min per user, per-IP fair use) is fine for scan volume; if it ever throttles, add an API key in `.env.local` / Vercel env — note in the build session's decision file if that happens.
- Should `<BookOlRefreshDialog>` grow the same cross-check? Decide in the build session (optional scope).

## Surprises (read these before the next session)

- Decision [084](084-isbn-lookup-csp-openlibrary.md) already anticipated this ("Optional Google Books fallback deferred"); the OL 404 fallback benefit comes free with the cross-check design.
- GB is CORS-friendly, so this stays a client-side fetch — one CSP `connect-src` addition (`https://www.googleapis.com`), same pattern as 084. No proxy needed.

## Carry-forward updates

- [x] PLAN.md refreshed (Recent decisions, Session prompts, Next up)
- [ ] components.mdc — n/a (no code)
- [ ] AGENTS.md inventory — n/a (no code; update when the GB helper ships)
- [ ] new env vars — none (GB key only if quota bites)

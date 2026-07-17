# 084 — ISBN lookup CSP + Open Library

**Date:** 2026-07-17
**Module:** library
**Tracker session:** ad-hoc

## Built

- Allowlisted `https://openlibrary.org` in CSP `connect-src` ([`src/hooks.server.ts`](../../src/hooks.server.ts)) so browser ISBN prefill / OL refresh can `fetch` again after [052](052-security-hardening.md).
- Mapped opaque WebKit network errors (`Load failed`) in [`fetchOpenLibraryPrefill`](../../src/lib/library/open-library-prefill.ts) to a clearer “Could not reach Open Library…” message.

## Decided

- **Keep Open Library as the primary free ISBN source** — no API key, CORS-friendly, edition + work + author keys map cleanly to our prefill / Turabian fields. Rejected switching primary to Google Books (quota / key friction; different shape) or paid ISBNdb for this personal app.
- **CSP allowlist over server proxy** — restore the existing client-side fetch path with a one-origin CSP addition rather than adding a SvelteKit proxy endpoint. Proxy remains an option if we later need multi-source fallback or to hide rate-limit headers.
- **Optional Google Books fallback** deferred — useful when OL 404s a niche seminary ISBN; not needed to fix “Load failed.”

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- None locked. Optional later: OL miss → Google Books volumes `q=isbn:` as secondary prefill (API key in `.env.local` / Vercel if we exceed anonymous quota).

## Surprises (read these before the next session)

- Safari surfaces CSP-blocked `fetch` as `TypeError: Load failed` — easy to misread as “Open Library is down.”
- Security hardening [052](052-security-hardening.md) shipped `connect-src` with only `'self'` + Supabase; ISBN lookup was an unnoticed regression until manual ISBN entry.

## Carry-forward updates

- [x] components.mdc updated (n/a)
- [x] AGENTS.md inventory updated (n/a)
- [x] new env vars documented (n/a)
- [x] PLAN.md refreshed

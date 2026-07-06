# 052 — Security hardening (review 051, Session R2)

**Date:** 2026-07-05
**Module:** cross-module
**Tracker session:** Review remediation R2

## Built

- Security headers on every HTML response via [`src/hooks.server.ts`](../../src/hooks.server.ts): `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, baseline `Content-Security-Policy` (Supabase origin + `wss:` in `connect-src`; `blob:` for pdfjs/zxing/service worker).
- Invoicing Edge Functions [`send-invoice`](../../supabase/functions/send-invoice/index.ts) and [`generate-invoice-pdf`](../../supabase/functions/generate-invoice-pdf/index.ts) use the OCR origin-allowlist CORS pattern (`SITE_URL`, `CORS_ALLOWED_ORIGINS`, `*.vercel.app`) instead of `Access-Control-Allow-Origin: *`.
- OCR daily rate limit in [`ocr_scripture_refs`](../../supabase/functions/ocr_scripture_refs/index.ts) **fails closed** on `library_ocr_usage` read error (returns 429 instead of allowing the Anthropic call).
- `resolveSessionUser` migrated to `auth.getClaims()` with narrow `SessionUser` (`id` + `email` only); `safeGetSession` typing updated in [`src/app.d.ts`](../../src/app.d.ts).

## Decided

- **CSP baseline keeps `'unsafe-inline'`** for scripts/styles — SvelteKit hydration and legacy inline styles (login, invoicing email HTML in Edge) have no nonce pipeline yet. Future tightening via `kit.csp` nonces is deferred.
- **Invoicing CORS tighten is defense-in-depth** — both functions are invoked server-side from `+page.server.ts`; browser CORS never applied in practice.
- **Asymmetric JWT signing keys** — ECC P-256 rotated to **Current** in prod Dashboard (2026-07-06); re-login smoke passed (`/dashboard`, `/library`, invoicing). Prod JWKS publishes ES256. Legacy key in **Previously used** — revoke after ~1h15m if desired (not required for normal operation).

## Schema changes

- `20260705170000_security_regate_storage_publishers_select.sql` — `library_scripture_images_select` regated to `app_has_module_read('library')`; `publishers_select` regated to owner OR (`app_has_module_read('library')` AND `deleted_at IS NULL`).

## New components / patterns added

- `SessionUser` type + `getClaims()` auth path in [`src/lib/server/auth-session.ts`](../../src/lib/server/auth-session.ts).
- Edge secret docs: `SITE_URL` (+ optional `CORS_ALLOWED_ORIGINS`) in [`supabase/README.md`](../../supabase/README.md).

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Supabase’s first-time asymmetric setup creates a **standby** ECC key; tokens stay on the legacy secret until you click **Rotate** (don’t wait for a scheduled rotation if you want the security win now).
- `getClaims()` was already in `@supabase/auth-js@2.102.1` — the stale comment in `auth-session.ts` predated the dependency bump.
- Policy drift on storage SELECT was exactly as 051 described: table policies moved in `20260502160000` but storage bucket policy was never revisited.

## Carry-forward updates

- [x] components.mdc updated (n/a)
- [x] AGENTS.md inventory updated (auth pattern)
- [x] new env vars documented (`SITE_URL` / `CORS_ALLOWED_ORIGINS` as Edge secrets)
- [x] PLAN.md refreshed

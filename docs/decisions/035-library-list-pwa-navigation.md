# 035 — Library list PWA book navigation fix

**Date:** 2026-05-19
**Module:** library
**Tracker:** ad-hoc (iOS PWA regression)

## Built

- Removed `listMounted` client gate on [`src/routes/library/+page.svelte`](../../src/routes/library/+page.svelte) — the list no longer unmounts on hydration (SSR HTML stays wired for SvelteKit link handling).
- Mobile list cards: full-card `absolute inset-0` link + `pointer-events-none` content layer; checkbox and reading-status `<select>` keep `pointer-events-auto` (44px checkbox).

## Decided

- **Do not** defer list render via `{#if browser}` / double `rAF` — it caused iOS standalone PWA taps on book rows to do nothing (URL unchanged). Prefer always rendering the list; infinite scroll stays client-only via `IntersectionObserver` in `onMount`-less `$effect`.
- **No `data-sveltekit-reload`** on list links unless client-nav still fails after deploy — full reload is a heavier fallback.

## Schema changes

- None.

## New components / patterns added

- **Mobile list row pattern:** stretch `<a class="absolute inset-0 z-0">` + interactive controls at `z-10` with explicit `pointer-events-auto`. Reuse for any future selectable card list on phone.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Symptom looked like a broken detail route but was list-side: SvelteKit intercepted clicks yet navigation never started because hydration tore down SSR list markup.
- Tapping the **reading status** dropdown still does not navigate (by design) — only the card body / stretch link opens the book.

## Carry-forward updates

- [x] Owner: iOS home-screen PWA — tap book title area on `/library` → `/library/books/[id]`; change status on same card without navigating — signed off trip QA 2026-06-03 ([043](043-library-trip-qa-signoff-projects-handoff.md)); perf work separate
- [x] Runbook §A step 1 extended
- [x] `library-owner-smoke` skill updated

# 023 — Library mobile polish (PageHeader + tab bar utilities)

**Date:** 2026-05-16
**Module:** library
**Tracker session:** ad-hoc (trip-period mobile UX)

## Built

- **`pb-tabbar` + `bottom-tabbar` Tailwind utilities** in [src/app.css](../../src/app.css) — single source for `calc(4.5rem + env(safe-area-inset-bottom, 0px) + 0.5rem)` used by the fixed mobile tab bar in [src/routes/+layout.svelte](../../src/routes/+layout.svelte) (`pb-tabbar` on the main column) and for floating UI cleared above it (`bottom-tabbar`).
- **`<PageHeader>`** — [src/lib/components/page-header.svelte](../../src/lib/components/page-header.svelte): optional back link, optional `lead` / `eyebrow` / `meta` / `actions` snippets, `title` + optional `titlePlaceholder`, `subtitle`, optional `titleAfter` (e.g. volume suffix). Mobile-friendly title wrapping (`break-words hyphens-auto`). Actions stack in a column on small viewports and sit inline on `md+`.
- **`/library/books/[id]`** — [src/routes/library/books/[id]/+page.svelte](../../src/routes/library/books/%5Bid%5D/+page.svelte): header refactored to `<PageHeader>`; mobile **Edit** + **⋯** overflow sheet for Refresh-from-ISBN + Delete; **Copy for drafts** collapsed under `<details>` on mobile, always-visible `section` on desktop; **Reading status** card duplicated (`md:hidden` above metadata grid, `hidden md:block` in aside); scripture ref rows `min-h-12 md:min-h-9` with larger ghost icon buttons on mobile; copy toast uses `bottom-tabbar` instead of `bottom-20`.
- **`/library` list** — [src/routes/library/+page.svelte](../../src/routes/library/+page.svelte): `<PageHeader>` with icon lead + counts meta; desktop keeps full action row; mobile **New book** + **⋯** sheet for Search passage / Add by ISBN / Review queue; undo toast uses `bottom-tabbar`.
- **`BookForm` sticky save bar** — [src/lib/components/book-form.svelte](../../src/lib/components/book-form.svelte): `max-md:bottom-[calc(...)]` replaced with `max-md:bottom-tabbar`.

## Decided

- **Overflow = bottom `Sheet`, not `DropdownMenu`.** The shadcn dropdown primitive is not in the repo; `Sheet side="bottom"` matches iOS action-sheet muscle memory and gives full-width 44px-tall targets for destructive delete.
- **Duplicate reading-status card on mobile** rather than reordering the whole `md:grid-cols-3` grid — keeps desktop layout unchanged and minimizes churn.

## Schema changes

- None.

## New components / patterns added

- [src/lib/components/page-header.svelte](../../src/lib/components/page-header.svelte) — reusable page chrome for back + title + stacked actions.
- **CSS utilities** `pb-tabbar`, `bottom-tabbar` in [src/app.css](../../src/app.css).

## Open questions surfaced

- **Other modules** (Invoicing FAB inline `style=`, Settings, Dashboard) still duplicate the tab-bar offset in places — out of scope for this session; reuse `bottom-tabbar` / `pb-tabbar` when those surfaces are touched.
- **`Sheet.Footer` safe-area** — bottom sheets with footers may still need explicit `env(safe-area-inset-bottom)` padding; not changed here.

## Surprises

- Root layout already padded main content for the tab bar; perceived “overlap” in screenshots was partly **translucent tab bar + content behind** and partly **misaligned toasts** (`bottom-20` vs tab-bar + home indicator).

## Carry-forward updates

- [x] [.cursor/rules/components.mdc](../../.cursor/rules/components.mdc) — `<PageHeader>` row added
- [x] [AGENTS.md](../../AGENTS.md) — Patterns: tab-bar utilities noted
- [x] [PLAN.md](../../PLAN.md) — Recent decisions + last updated
- [ ] Tracker: optional follow-up row for invoicing/settings to adopt utilities (not filed in tracker this session)

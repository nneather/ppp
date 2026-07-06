# 054 — Invoicing UX standardization (review 051, Session R4)

**Date:** 2026-07-06
**Module:** invoicing (+ one library carry-along)
**Tracker session:** Review remediation R4 — invoicing polish (half-session)

## Built

- **Retired every `window.confirm` in `src/`.** Destructive/confirm invoicing flows now go through the shared [`<ConfirmDialog>`](../../src/lib/components/confirm-dialog.svelte):
  - **Invoice detail** ([`invoices/[id]/+page.svelte`](../../src/routes/invoicing/invoices/%5Bid%5D/+page.svelte)): discard-draft, discard-sent, and mark-paid. One shared dialog driven by `confirmFormId` → hidden `?/discard` / `?/markPaid` forms via `requestSubmit()`; enhance callbacks close the dialog.
  - **Time entry edit sheet** ([`time-entry-sheet.svelte`](../../src/lib/components/time-entry-sheet.svelte)): delete now opens a `<ConfirmDialog>` (nested Dialog-on-Sheet, portal-based) instead of `confirm()`; dedicated `deleteEnhance` closes both dialog + sheet.
  - **Library book-detail batch scripture form** ([`library/books/[id]/+page.svelte`](../../src/routes/library/books/%5Bid%5D/+page.svelte)): the `beforeNavigate` dirty-guard `confirm()` was the last `window.confirm` in the repo — converted to the canonical `cancel()` + `pendingNav` + `<ConfirmDialog>` pattern already used on `/library/books/new`.
- **Confirm-gated trigger pattern from [053](053-ux-safety.md)** applied to the new destructive triggers: `variant="outline"` + `text-destructive`, **no** `hotkey`; the dialog carries `hotkey="d"`. Mark-paid is non-destructive → `secondary` trigger, dialog confirm `hotkey="s"`.
- **`<PageHeader>` migration** on both invoicing surfaces:
  - `/invoicing` — `lead` (Receipt icon), `subtitle="Time entries"`, `actions` snippet (Invoices link + New entry).
  - `/invoicing/invoices/[id]` — `back` link, `meta` snippet (client + billing period), `actions` snippet (status badge + timestamps). Bottom border kept via `class`.
- **FAB de-inlined**: `/invoicing` mobile FAB dropped its inline `style="bottom: calc(...)"` for the **`bottom-tabbar`** utility; page bottom padding switched `pb-28` → **`pb-tabbar`** (both from [app.css](../../src/app.css)). No inline `style=` remains on the page.
- **Hotkey coverage**: `New entry` (`/invoicing`) and `New client` (`/settings/invoicing`) create-sheet triggers now carry `hotkey="b"` (clears the dev-warn on default-variant buttons). Sheet/dialog submits already carried `s` / `Escape`; delete triggers are de-emphasized per the confirm-gated pattern.
- **`formMessage` narrowed on `form.kind`** for `/invoicing`: the three time-entry actions (`create`/`update`/`delete`) now return `kind: 'timeEntry'` on every branch, and the page only surfaces `formMessage` when `form.kind === 'timeEntry'`.

## Decided

- **`hotkey="b"` for "New X" create-sheet triggers** even when the label has no `b`. `s`/`e`/`d` collide with the sheet's own Save / Save-and-New / Delete chords once the sheet mounts; `u`/`g` are semantically wrong. `b` is the reserved "safe Cmd+letter" and matches the existing `/projects` "New project" precedent. Rejected: adding a new reserved letter, or leaving the dev-warn.
- **Mark-paid gets a (non-destructive) confirm dialog**, not a bare click. It was already `confirm()`-gated; keeping a confirm step preserves the guard while removing `window.confirm`. Trigger stays `secondary` (not de-emphasized destructive).
- **The library book-detail `confirm()` was in scope.** The acceptance said "no `window.confirm` left in `src/`", not "invoicing only" — and the replacement is the already-blessed `beforeNavigate` + `<ConfirmDialog>` pattern, so converting it carried no new risk.
- **Shared confirm dialog on the invoice detail page** (one `<ConfirmDialog>` + `confirmFormId`) rather than three dialogs — mirrors `/settings/invoicing`'s existing shape; only one destructive flow is visible per invoice status.

## Schema changes

- None. UI + one server-return-shape change (`kind` discriminator on `/invoicing` actions).

## New components / patterns added

- No new components. Reused `<ConfirmDialog>`, `<PageHeader>`, `pb-tabbar` / `bottom-tabbar`.
- Pattern reaffirmed: **hidden form + `confirmFormId` + `requestSubmit()` + shared `<ConfirmDialog>`** is the standard for page-level destructive actions (invoice detail now joins `/settings/invoicing`).

## Open questions surfaced

- The "Send invoice" trigger on the invoice detail page is a default-variant button that still fires the hotkey dev-warn (pre-existing; giving it `s` would collide with the send dialog's own Save). Left as-is — out of this session's scope. Revisit if a global "open primary flow" chord is ever added.

## Surprises (read these before the next session)

- The dev server (terminal, prod Supabase) **did** have a valid client-side owner session this time, so the mobile-width `/invoicing` screenshot + the nested delete-confirm interaction were verified live (unlike 053's deferred dashboard shot).
- Nested `<ConfirmDialog>` (shadcn Dialog) over the `<TimeEntrySheet>` works because both are portal-based — matches the library-module rule about nested modals needing portal primitives.

## Carry-forward updates

- [x] components.mdc — no change needed (no new components; existing rows already cover ConfirmDialog / PageHeader / tabbar)
- [x] AGENTS.md inventory — no new helpers; invoicing still route-inline by design
- [x] new env vars documented (none)
- [x] PLAN.md refreshed (R4 done, R5 next)

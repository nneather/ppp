---
name: Library filters top layout
overview: Move `/library` facet panel from a narrow left column to a full-width top filter region; fix bulk-selection checkboxes so checked state stays in sync when clicked (bind:group or equivalent).
todos:
  - id: layout-remove-aside
    content: Remove md:grid aside; add full-width filter panel below search; single-column results
    status: pending
  - id: filterbody-grid
    content: Restructure filterBody into responsive grid + optional collapsible wrapper
    status: pending
  - id: checkbox-selection
    content: Fix row/header checkboxes so checked state matches selection (bind:group + header/indeterminate)
    status: pending
  - id: mobile-strategy
    content: Either keep Sheet + hide top panel on small screens OR replace Sheet with top collapsible; remove dead code
    status: pending
  - id: extract-component
    content: Optional — extract filters panel to component if +page.svelte stays unwieldy
    status: pending
  - id: qa-check
    content: Manual responsive pass + npm run check
    status: pending
isProject: false
---

# Library `/library` — filters at top + checkbox selection fix

## Part A — Move filters from left sidebar to top

### Current behavior

- [`src/routes/library/+page.svelte`](src/routes/library/+page.svelte): `{#snippet filterBody()}` — Genre, Author/Series `MultiCombobox`, Language, Reading status, Needs review.
- **Desktop:** `grid md:grid-cols-[13.5rem_1fr]` — sticky aside + results.
- **Mobile:** same snippet in bottom `Sheet`; search row has Filters button.
- URL-driven filters unchanged ([`+page.server.ts`](src/routes/library/+page.server.ts)).

### UX direction

- Remove two-column grid; **full-width filter card** below search (bordered, responsive grid for sections so comboboxes get width).
- Keep active-filter chips + Clear all below the panel (order: header → search → **filters** → chips → results).
- **Optional:** collapsible desktop panel + summary when collapsed (`activeFilterCount`).
- **Mobile:** keep bottom sheet **or** collapsed top panel — pick one and delete the other path.

### Implementation notes

- Extract optional component if file grows ([`.cursor/rules/components.mdc`](.cursor/rules/components.mdc)).
- No server changes.

---

## Part B — Checkboxes show checked when clicked (bulk selection)

### Current code

Row checkboxes (mobile cards ~651–659, desktop table ~759–767) use:

- `checked={selectedIds.includes(b.id)}`
- `onclick` with **`e.preventDefault()`** + `toggleBookSelected(b.id)`

Header “select all” (~735–744) uses the same **`preventDefault` + manual toggle** pattern.

### Problem

Fighting the native checkbox with `preventDefault()` while driving `checked` from `$state` can produce **visual desync** on some browsers/timing (native checked state vs reactive `checked` attribute).

### Recommended fix

1. **Row checkboxes:** Use Svelte **`bind:group={selectedIds}`** with **`value={b.id}`** on each `<input type="checkbox">` (mobile + desktop rows). Svelte maintains the array on toggle — remove `onclick`/`preventDefault` for those inputs.

2. **`selectedIds`:** Keep as `$state<string[]>([])` — `bind:group` works with reactive arrays.

3. **Header “select all”:** Cannot use the same `bind:group` — keep explicit **`onchange`** or **`click`** that calls `toggleSelectAllPage()` **without** relying on conflicting native toggle: use **`indeterminate`** when some but not all page rows selected (`some selected but !allPageSelected`), `checked={allPageSelected`, and in handler update `selectedIds` directly (existing logic). Prefer **`input`** event or **`change`** over **click + preventDefault** for the header checkbox so the control stays aligned with state.

4. **Prune effect** (~338–344): Should still validly trim `selectedIds` when `data.books` changes.

5. **QA:** Click row checkbox → appears checked immediately; select-all → all rows checked; partial selection → header indeterminate if implemented.

---

## QA / acceptance

- Filters: URL params unchanged; back/forward works.
- Checkboxes: visual checked state matches selection on mobile + desktop.
- `npm run check` passes.

---

## Docs

- Optional short decision note if UX change is worth logging; otherwise tracker-only.

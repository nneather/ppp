# 047 — Projects status appearance (Epic palette)

**Date:** 2026-06-03
**Module:** projects
**Tracker session:** Ad-hoc polish (not a tracker session)

## Built

- Shared token map [`src/lib/projects/health-appearance.ts`](../src/lib/projects/health-appearance.ts) — `HEALTH_HEX`, `HEALTH_SEGMENT_SELECTED_CLASS`, `LIFECYCLE_BADGE_CLASS`.
- [`health-status-icon.svelte`](../src/lib/components/health-status-icon.svelte) — Epic PR shapes (circle, half-circle, inverted triangle, half/solid diamond) using `HEALTH_HEX`.
- [`health-trend-arrow.svelte`](../src/lib/components/health-trend-arrow.svelte) — filled green up / red down triangles for week-over-week trend.
- [`health-trend-badge.svelte`](../src/lib/components/health-trend-badge.svelte) — shape icon + optional label + trend; `showStatusIcon` prop.
- [`project-tree.svelte`](../src/lib/components/project-tree.svelte) — picker segments show shapes; **no** status icon under project name (`showStatusIcon={false}`); trend-only row when week-over-week change exists.
- [`project-filter-bar.svelte`](../src/lib/components/project-filter-bar.svelte) — shape icons on health select items + trigger.
- [`project-status-strip.svelte`](../src/lib/components/project-status-strip.svelte) — inherits full badge (shape + label + trend).

## Decided

- **Source:** Epic Progress Report Style Guide (Fall 2023 palette). Doc collapses Excellent+Satisfactory to green and Serious+Critical to red; we use **five distinct** colors from the full palette.
- **Excellent = blue, Satisfactory = green** (user choice; doc text only says both are “green”).
- **Health hex map:** Excellent `#3494CA`, Satisfactory `#44A271`, Watch `#FEE486` (dark text `#454545`), Serious `#F99C2B`, Critical `#DA0000`.
- **Lifecycle display:** neutral gray badge (`#DADADA` / `#454545`, inverted in dark mode). **Lifecycle filter chips** stay as toggle Buttons — not the gray badge — so active/inactive filter state stays clear.
- **Trend wording:** Improved / Declined (doc); flat/none unchanged.
- **Shapes (color-blind):** Excellent = solid circle; Satisfactory = half circle; Watch = **inverted** triangle (doc is point-up); Serious = half diamond; Critical = solid diamond.
- **`/projects` tree:** omit status shape under name (picker already labels status); show green/red trend triangles only when `trend !== 'none'`.
- **Filter panel:** collapsed by default (`bind:open` on `ProjectFilterBar`); desktop summary row (`md+`); mobile **Filters** toggle inline with week prev/date/next; badge shows `countActiveProjectFilters`.

## Schema changes

- None.

## New components / patterns added

- `src/lib/projects/health-appearance.ts` — hex + segment/lifecycle Tailwind classes; shapes live in `health-status-icon.svelte`.
- `health-status-icon.svelte` / `health-trend-arrow.svelte` — reuse everywhere; do not duplicate SVGs.

## Open questions surfaced

- None.

## Surprises

- `npm run check` still reports a pre-existing `patch-sveltekit-pwa.ts` type error; projects files are clean.

## Carry-forward updates

- [x] `components.mdc` updated
- [ ] `AGENTS.md` inventory updated (optional)

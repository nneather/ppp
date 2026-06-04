# 047 — Projects status appearance (Epic palette)

**Date:** 2026-06-03
**Module:** projects
**Tracker session:** Ad-hoc polish (not a tracker session)

## Built

- Shared token map [`src/lib/projects/health-appearance.ts`](../src/lib/projects/health-appearance.ts) — `HEALTH_HEX`, `HEALTH_DOT_CLASS`, `HEALTH_SEGMENT_SELECTED_CLASS`, `LIFECYCLE_BADGE_CLASS`.
- [`health-trend-badge.svelte`](../src/lib/components/health-trend-badge.svelte) — doc palette dots; trend arrows green `#44A271` / red `#DA0000`; labels **Improved** / **Declined**.
- [`project-tree.svelte`](../src/lib/components/project-tree.svelte) — inline 5-segment picker uses shared selected classes; lifecycle label is neutral gray badge.
- [`project-filter-bar.svelte`](../src/lib/components/project-filter-bar.svelte) — colored dots on health select items + trigger when a specific status is selected.
- [`project-status-strip.svelte`](../src/lib/components/project-status-strip.svelte) — unchanged; inherits via `HealthTrendBadge`.

## Decided

- **Source:** Epic Progress Report Style Guide (Fall 2023 palette). Doc collapses Excellent+Satisfactory to green and Serious+Critical to red; we use **five distinct** colors from the full palette.
- **Excellent = blue, Satisfactory = green** (user choice; doc text only says both are “green”).
- **Health hex map:** Excellent `#3494CA`, Satisfactory `#44A271`, Watch `#FEE486` (dark text `#454545`), Serious `#F99C2B`, Critical `#DA0000`.
- **Lifecycle display:** neutral gray badge (`#DADADA` / `#454545`, inverted in dark mode). **Lifecycle filter chips** stay as toggle Buttons — not the gray badge — so active/inactive filter state stays clear.
- **Trend wording:** Improved / Declined (doc); flat/none unchanged.

## Schema changes

- None.

## New components / patterns added

- `src/lib/projects/health-appearance.ts` — single source for health/lifecycle visual tokens. Import from components; do not duplicate Tailwind color maps.

## Open questions surfaced

- None.

## Surprises

- `npm run check` still reports a pre-existing `patch-sveltekit-pwa.ts` type error; projects files are clean.

## Carry-forward updates

- [x] `components.mdc` updated
- [ ] `AGENTS.md` inventory updated (optional)

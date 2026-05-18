# 025 — Library client bundle split + treemap tooling

**Date:** 2026-05-18  
**Module:** library  
**Tracker session:** ad-hoc (Session D — bundle audit from scanner/PWA plan)

## Built

- **`rollup-plugin-visualizer`** (devDependency) wired in [vite.config.ts](../../vite.config.ts) when `PPP_BUNDLE_VIZ=1` — writes `.bundle-viz/treemap.html` (gzip + brotli in treemap). Output path is **gitignored** (see [.gitignore](../../.gitignore) `.bundle-viz/`).
- **`<BookForm>`** — [src/lib/components/book-form.svelte](../../src/lib/components/book-form.svelte): `<BookOlRefreshDialog>` is no longer statically imported; it loads with `{#await import('$lib/components/book-ol-refresh-dialog.svelte')}` only when `olRefreshOpen` is true (edit mode). `OlApplyKey` stays `import type` only.
- **`/library/books/[id]`** — [src/routes/library/books/[id]/+page.svelte](../../src/routes/library/books/%5Bid%5D/+page.svelte): dynamic `import()` + `$state` component holders for `<ScriptureReferenceForm>`, `<BookTopicForm>`, `<BookBibleCoverageEditor>`, `<BookAncientCoverageEditor>`. Scripture/topic chunks load on first user interaction (`addOpen` / `editingId` / `topicAddOpen` / `editingTopicId`); `$effect` gates on `browser` for SSR safety. Coverage editors prefetch in `onMount` with pulse placeholders until resolved.

## Decided

- **Decision file number `025`** — `024-service-worker.md` already occupied 024 this repo; this session files here instead of the plan’s placeholder `024-bundle-split`.
- **Keep Bible + ancient coverage always visible** — no `<details>` collapse; only code-splitting, not UX change.
- **Prefer `$state` constructor + `onMount` / `$effect` over repeated `{#await}`** — one fetch per component class per page; placeholders avoid layout jump.

## Schema changes

- None.

## New components / patterns added

- **Bundle treemap** — `PPP_BUNDLE_VIZ=1 npm run build` → open `.bundle-viz/treemap.html` locally (not committed).
- **Pattern** (also in [.cursor/rules/components.mdc](../../.cursor/rules/components.mdc)): heavy sub-components that only render after a user action should be **dynamic-imported** so the initial route chunk does not pay for them up front.

## Chunk sizes (Vite `npm run build` table — pre vs post)

Hashes change every build; sizes below are from **this session’s** two `PPP_BUNDLE_VIZ=1` runs on the same machine.

| Surface | Baseline (pre-split) | After split |
|--------|----------------------|-------------|
| `/library/books/[id]` page JS (SvelteKit client node for `[id]/+page`) | **106.52 kB** (gzip **31.09 kB**) monolithic `nodes/11.*.js` | **~0.07 kB** stub `nodes/11.*.js` + **`37.80 kB`** lazy chunk (gzip **11.32 kB**) — **~64%** raw reduction on first-load critical path for the route entry |
| `book-form` shared chunk (Vite `name: book-form`) | **58.29 kB** (gzip **17.87 kB**) | **49.20 kB** (gzip **15.37 kB**) — zxing no longer in this chunk |
| `/library` list page (`nodes/9.*.js`) | **41.52 kB** (gzip **12.43 kB**) | **41.52 kB** (gzip **12.43 kB**) — unchanged (expected) |

**`@zxing/*`:** Confirmed absent from the post-split `book-form` chunk (scanner stays on `/library/add` + lazy OL dialog chunk).

**Treemap screenshots:** Not committed (HTML is ~700KB). Run `PPP_BUNDLE_VIZ=1 npm run build` and capture from `.bundle-viz/treemap.html` if you need before/after images for a deck.

## Open questions surfaced

- None blocking.

## Surprises

- SvelteKit emitted a **tiny entry stub** for `/library/books/[id]` and moved almost all page JS into a **single lazy chunk** once the page became import-heavy — larger relative win than splitting in isolation suggested.

## Carry-forward updates

- [x] [.cursor/rules/components.mdc](../../.cursor/rules/components.mdc) — bundle-split pattern
- [x] [AGENTS.md](../../AGENTS.md) — `PPP_BUNDLE_VIZ` script note
- [x] [PLAN.md](../../PLAN.md) — Recent decisions + last updated

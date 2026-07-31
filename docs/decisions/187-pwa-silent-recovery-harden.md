# 187 — PWA silent recovery harden

**Date:** 2026-07-31
**Module:** cross-cutting (PWA / client)
**Tracker session:** ad-hoc — clear-cache banner on nearly every open

## Built

- [`src/lib/pwa/client-recovery.ts`](../../src/lib/pwa/client-recovery.ts):
  - Silent path: unregister **all** service workers, delete **all** caches, then `location.replace` with `_ppp_recover` (not same-tab `reload`) so the next document is a fresh navigation after unregister.
  - Strip `_ppp_recover` via `history.replaceState` on boot; after **2.5s** stable boot, clear attempt cooldown/count so a later deploy skew can silent-recover again.
  - Allow **2** silent clear+reloads inside the 20s window before showing the fallback card (idle only).
  - Keep mid-edit gate ([186](186-pwa-defer-reload-while-editing.md)): `isUserBusy()` → card, never silent reload.
  - Narrow `isChunkLoadFailure`: immutable-path hint only for opaque `Script error` / empty messages — not arbitrary runtime errors in `/_app/immutable/*`.
- Tests: [`client-recovery.test.ts`](../../src/lib/pwa/client-recovery.test.ts).

## Decided

- **Harden silent recover, don't switch to vite-pwa `autoUpdate`** — prompt + resume auto-apply ([082](082-pwa-update-auto-recover.md)/[111](111-pwa-resume-auto-apply-harden.md)) stays; this only fixes the chunk-skew nuclear path that was leaking to the banner.
- **Two silent attempts then card** — one clear+reload often left a dying controller; a second silent pass is cheaper than asking the owner every time. Card remains the loop brake and the mid-edit path.
- **Settle clears cooldown** — rejected "any second failure in 20s → card" as the default; that turned a successful silent recover + transient blip into a nag.

## Schema changes

- None.

## New components / patterns added

- None (behavior change on existing recovery).

## Open questions surfaced

- Owner smoke after next deploy: cold open laptop browser + home-screen PWA after a push — should refresh without the clear-cache card when idle; mid-form update should still show the banner.

## Surprises

- Same-tab `reload()` after `unregister()` can stay controlled by the dying SW on some engines; `location.replace` + recover query is the more reliable client release.
- Broad `source includes /_app/immutable/` matching treated normal runtime errors as cache skew.

## Carry-forward updates

- [x] components.mdc — no new Svelte components
- [x] AGENTS.md inventory — cold-start blurb + 187
- [x] new env vars — none
- [x] PLAN.md refreshed

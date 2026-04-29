# 005 — App-wide hotkey system

**Date:** 2026-04-28
**Module:** core
**Tracker session:** ad-hoc (no tracker session)

## Built

### Initial pass

- Hotkey primitives at [src/lib/hotkeys/](../../src/lib/hotkeys/):
  - [registry.ts](../../src/lib/hotkeys/registry.ts) — reserved-letter `HOTKEY` map + dev-only collision warner.
  - [shortcut.svelte.ts](../../src/lib/hotkeys/shortcut.svelte.ts) — Svelte action `use:shortcut` that attaches a `window` keydown listener, dispatches `node.click()` (or custom `handler`) on match. Bails on `disabled` / `aria-disabled` so disabled buttons swallow the chord without firing.
  - [platform.ts](../../src/lib/hotkeys/platform.ts) — `isMac()`, `formatChord()` (`⌘S` / `Ctrl+S`), `ariaKeyshortcuts()`.
- Underline mnemonic helper [src/lib/components/hotkey-label.svelte](../../src/lib/components/hotkey-label.svelte) — finds the first case-insensitive occurrence of `mnemonic` in `label` and wraps it in `<u>`.
- Extended [src/lib/components/ui/button/button.svelte](../../src/lib/components/ui/button/button.svelte) with two optional props: `hotkey?: string` (wires the chord, sets `title`, `aria-keyshortcuts`), `label?: string` (auto-rendered through `<HotkeyLabel>` when paired with `hotkey`). Plus a dev-only `console.warn` when a primary submit / default / destructive button mounts without `hotkey`.
- Migrated all primary-action buttons across the existing surface: book form (Save/Update + person dialog), book edit / new pages (Cancel), book detail (Edit, Delete), library list ("New book"), confirm-dialog (Cancel + Confirm/Delete), invoicing sheets (rate, time-entry, generate-invoice, default-cc), invoice detail (Send to client, Discard draft), profile (Save name), audit-log (Apply), scripture-reference-form.

### Post-launch tightening (same day, after first hands-on test)

- **Trimmed `HOTKEY` map** to `s u d e g` plus `b` (per-label mnemonic, currently used by "New **B**ook") plus `cancel: 'Escape'` (special key). Dropped `n c f a` after first-use revealed Cmd+N is non-reclaimable in Chrome and `c`/`a` collide with clipboard / select-all in inputs.
- **`Escape` special-key support** in [shortcut.svelte.ts](../../src/lib/hotkeys/shortcut.svelte.ts):
  - Bare Esc press, no modifier required.
  - Listens on the **bubble phase** (Mod+letter listens on capture).
  - Bails immediately if `event.defaultPrevented` — lets focused widgets that handle Esc themselves (e.g. an open `<PersonAutocomplete>` dropdown) win the keystroke.
  - Skips the registry's collision warning (multiple Cancel buttons co-existing is normal; precedence is resolved via `defaultPrevented`, not registration order).
- **Gap fix in `<HotkeyLabel>`**. The first attempt used `<span class="contents">` thinking it would make the label "transparent" to the parent Button's `inline-flex gap-1.5`. Wrong — `display: contents` removes the wrapping span and re-exposes the inner text/`<u>`/text nodes as direct flex children, which `gap-1.5` then slices apart ("S ave book"). Fixed by using a plain `<span>` (default `display: inline`); the span itself becomes one flex item containing inline text. Underline color also bumped from `decoration-foreground/40 decoration-1` to `decoration-current decoration-2 underline-offset-4` so it's actually visible (color-blind-safe — same hue as the surrounding text, just thicker).
- **Dev-warn anchor skip** in [button.svelte](../../src/lib/components/ui/button/button.svelte). Added an early `if (href) return;` so navigation-style anchor buttons (`<Button href="/library/books/new">`) don't trip the missing-hotkey warning. Anchors that *want* a hotkey (e.g. "New **B**ook" with `hotkey="b"`) still get one — the bail only suppresses the warn.
- **Cancel buttons rewired** to `hotkey="Escape"` across confirm-dialog, default-cc-dialog, book-form (person dialog), library/books/new, library/books/[id]/edit, scripture-reference-form, and invoicing/invoices/[id] (send dialog). Tooltip on each reads "Esc"; the underline is intentionally absent (no letter in "Cancel" matches "Escape").
- **"New book" button** on `/library` got `hotkey="b"` + `<HotkeyLabel mnemonic="b">`. The `b` slot in `HOTKEY` was renamed `bookOrLocal` to signal it's a per-label mnemonic, not a globally-reserved semantic.
- **Hook regex updated** in [.cursor/hooks/hotkey-missing.sh](../../.cursor/hooks/hotkey-missing.sh) — Cancel re-added as a trigger now that `hotkey="Escape"` is the recommended option; `New ` and `Add ` removed (those are nav links by default).

## Decided

- **Mod+letter (Cmd on Mac, Ctrl on Win) over Alt+letter.** Alt+letter on Mac inserts characters (Option+S = ß) inside text inputs, which is the very moment we want Save to fire. Cmd doesn't insert characters, so `Cmd+S` works whether focus is in an input or outside. The hint also reads naturally as `⌘S` (Mac muscle memory).
- **Always-visible underline, not Alt-held.** Mac users don't have a discoverable "hold Alt to reveal" UX, and the user's call was "lightly underlined" all the time.
- **Buttons-only scope, deferred field hotkeys.** Field-focus chords (Alt+T to focus Title) are noisy on a 25-field form like `<BookForm>`, would require an "is-typing" guard, and don't compose well with Mod+letter. Tab order handles inter-field navigation already.
- **`label` prop alongside `children`.** Plain-text buttons get auto-underline via `<Button hotkey="s" label="Save book" />`. Icon+text buttons keep `children` and wrap the text manually in `<HotkeyLabel>`. Tried Snippet introspection first — Svelte 5 snippets are opaque, so explicit `label` is the cleanest API.
- **Trimmed registry over modifier swap.** When Cmd+N hit Chrome's reserved chord, the choice was "switch modifier" (e.g. Ctrl+letter on Mac) or "drop the broken letters". Trimmed the registry: Cmd+S is the most-important chord and it works perfectly, so swapping modifier would have lost the natural mapping for everything just to fix one button. The trimmed set (`s u d e g`) is small but covers every primary action; `b` is reserved for per-label use. Avoid letters now also include the input-collision set (`c x v z y a`) plus the system-level set (`m h Space o`), not just the browser-tab set (`t w r q l p`).
- **Cancel uses bare Esc, not Cmd+Esc.** Esc is the universal "dismiss" key — every modal primitive in shadcn already binds it. Adding `hotkey="Escape"` is mostly for discoverability (the tooltip reads "Esc") and for non-modal Cancel buttons (page-hosted forms) where the primitive isn't there to handle it.
- **Bubble phase + `defaultPrevented` bail for Escape only.** Mod+letter chords use capture phase + preventDefault to wrest control from the browser. Escape can't do that — pressing Esc inside an open `<PersonAutocomplete>` dropdown should close the dropdown, not the parent form. Bubble phase lets the focused widget's keydown run first; if it preventDefaults (the autocomplete does), our Cancel binding bails. If nothing claims it, the Cancel click fires.

## Schema changes

None.

## New components / patterns added

- `src/lib/hotkeys/` — new module (registry + action + platform helpers). **Reusable as-is** for any future hotkey work. The `shortcut` action handles two distinct modes: Mod+letter (capture, preventDefault) and Escape (bubble, defaultPrevented bail).
- `src/lib/components/hotkey-label.svelte` — listed in [.cursor/rules/components.mdc](../../.cursor/rules/components.mdc).
- `Button.hotkey` + `Button.label` — documented in [.cursor/rules/components.mdc](../../.cursor/rules/components.mdc) and [.cursor/rules/hotkeys.mdc](../../.cursor/rules/hotkeys.mdc). Anchors (`href` set) are exempt from the dev-warn but can still take a `hotkey`.
- `.cursor/rules/hotkeys.mdc` — workspace rule, glob-scoped to `src/lib/components/**` + `src/routes/**/*.svelte`. Includes the trimmed reserved-letter table + the explicit avoid list + the Cancel=Escape convention.
- `.cursor/hooks/hotkey-missing.sh` — afterFileEdit hook (registered in `.cursor/hooks.json` alongside the existing `migration-type-drift.sh`). Emits `additional_context`, never blocks.

## Open questions surfaced

- Cmd+K command palette — not built. Would replace the per-button registration model with a fuzzy-search palette over all available actions on the current page. Reconsider once the app crosses ~30 distinct primary actions.
- Single-key shortcuts (Linear-style `c` to create when not focused on an input) — deferred; would need a separate "is-typing" guard and clashes with the underline-mnemonic UX.
- Toast button hotkeys (Undo, Dismiss on the soft-delete toast) — currently rendered as outline/ghost variants and skipped by the dev warn. Could revisit if undo becomes high-traffic.
- The page-hosted Cancel buttons on `/library/books/new` and `/library/books/[id]/edit` may unexpectedly fire when the user presses Esc to dismiss a focused widget that *doesn't* preventDefault (e.g. some future popover that's careless about it). The pattern works for `<PersonAutocomplete>` because it explicitly preventDefaults; new widgets need to follow suit or the page Cancel will trigger.

## Surprises (read these before the next session)

- **`display: contents` is NOT a "make this span transparent" trick for flex parents.** It removes the wrapping span from layout AND re-exposes its children as direct children of the flex container, which then gets the gap. Plain `<span>` (default `display: inline`) is the right wrapper for "single flex item containing inline content". This bit us in `<HotkeyLabel>` and cost half a session of "I underlined the letter, why is the button still ugly?".
- **`Cmd+N` is non-reclaimable in Chrome on Mac.** `preventDefault()` is silently ignored — the new-window opens regardless. Same goes for `Cmd+T`, `Cmd+W`, `Cmd+R`, `Cmd+Q`, `Cmd+L`, `Cmd+F`, `Cmd+P`. Don't pick mnemonics from these letters; the registry comment lists the full set.
- **`Cmd+C`, `Cmd+X`, `Cmd+V`, `Cmd+Z`, `Cmd+A` are technically reclaimable but you should NOT.** They're clipboard / undo / select-all inside text inputs — preventDefault breaks native input behavior in surprising ways. The Cancel = `c` mapping in the initial pass would have silently broken Cmd+C copy when text was selected; caught it before users hit it.
- The `<Button>` component now wraps an action (`use:shortcut`) and an effect (the dev warn). Both are no-ops when `hotkey` is unset, but if you see a stray `[hotkey] …` warn in the browser console for a button you don't think is primary, the heuristic at the top of `button.svelte` is the place to tune.
- The Cursor hook is matched on `.svelte` paths only and looks for diff-added lines containing `<Button` + a primary-action keyword (`Save|Update|Delete|Edit|Cancel|Generate`) without `hotkey=`. False-positives are possible if you happen to add an unrelated `<Button>` whose label coincides with one of those words; they're rare and easy to silence by adding the right `hotkey` prop.
- `Cmd+S` on a button that is `disabled` (e.g. Save while `!hasAnyField`) still calls `preventDefault()` so the browser's save-page dialog stays suppressed; the click just doesn't fire. This is intentional but slightly surprising — a disabled Save still "consumes" the chord.

## Carry-forward updates

- [x] components.mdc updated (`HotkeyLabel` row + `Button.hotkey` note with trimmed-set + Esc-via-primitive convention)
- [x] AGENTS.md inventory updated (rules list + Patterns bullet reflecting final state)
- [x] new env vars documented (none)
- [x] tracker Open Questions updated (n/a — no tracker session; library tracker has Sessions 1.5j + 1.5k log entries describing the registry tightening + post-launch Esc/B replacements)
- [x] scaffold-entity skill updated (Cancel example wires `hotkey="Escape"`; Save uses `s`/`u`; Delete uses `d`; reserved-letter list is trimmed)
- [x] hotkey-missing.sh hook updated (Cancel re-added as a trigger now that `Escape` is the recommended value; `New `/`Add ` removed)

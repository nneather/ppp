# 226 — Contacts couple last-name backfill

**Date:** 2026-09-10
**Module:** contacts / CRM
**Tracker session:** Ad-hoc after [225](225-contacts-az-jump-duplicate-keys.md)

## Built

- Sheet parser: strip leading Aunt/Uncle (and Mr/Mrs/Ms/Dr/Pastor); `"Patrick (Weiqiang) Yu"` keeps the parenthetical on first name and uses `Yu` as last.
- Hosted data: Ben **Kroese** + Claire **Kilgore** (one household, different surnames); Mindy + Ric **Schwab** (envelope still “Aunt Mindy and Uncle Ric Schwab”); Patrick **(Weiqiang) Yu** sorts under Y.
- Zero remaining live contacts with a blank last name.

## Decided

- **Do not copy last name from the other household member.** Ben/Claire are the counterexample (Kroese / Kilgore, still one envelope).
- Envelope names can keep honorifics; contact first/last should not (`Aunt` / `Uncle` were first names).

## Schema changes

- None.

## New components / patterns added

- None. Parser lives in `src/lib/contacts/sheet-import.ts`.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Only two people had a null last name. The `#` group was Patrick’s last name stored as `(Weiqiang) Yu`.
- “Aunt Mindy and Uncle Ric Schwab” parsed as first=`Aunt` last=`Mindy` — she never inherited Schwab because she already had a “last name.”

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md inventory — sheet-import honorifics
- [x] new env vars — none
- [x] tracker Open Questions — n/a

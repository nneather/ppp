# 193 — German edition ISBN / language corrections

**Date:** 2026-08-05
**Module:** library
**Tracker session:** ad-hoc follow-up to [192](192-library-language-coverage-integrity.md)

## Built
- Migration `20260805182249_library_german_edition_isbn_corrections.sql` (hosted push): four shelf-German books that [192] left `english` because Open Library mapped their stored ISBNs to English translations.

## Decided
- Owner: Sebald *Die Ausgewanderten*, Kästner *Emil und die Detektive*, Kant *Kritik…*, and *Die Bibel* are **German** copies; English ISBNs were wrong match keys.
- **Sebald** year `1992` → set Eichborn 1st German ISBN `9783821840932`, publisher Eichborn / Frankfurt am Main (clear Harvill).
- **Emil / Kant / Die Bibel** → `language=german`, **null ISBN** (do not invent reprint barcodes); clear Britannica / Book Club Associates / Abrams match keys. Emil keeps Atrium.
- Kant person `Emmanuel` → `Immanuel`; title normalized to *Kritik der reinen Vernunft*.
- *Die Bibel* publisher → Deutsche Bibelgesellschaft; cleared stale “OL match” review note. Exact Luther/Einheit ISBN still shelf-check when home.

## Schema changes
- `20260805182249_library_german_edition_isbn_corrections.sql` — DML only

## Open questions surfaced
- Emil / Kant / *Die Bibel*: fill ISBN from title page when next at the shelf (Atrium Emil often `9783855356034`; Kant Meiner `9783787313198` or Suhrkamp Weischedel — don’t guess).
- *Die Bibel* still credited to person “Deutsche Bibelgesellschaft” as author — odd; optional later cleanup (publisher-only / Luther translator).

## Surprises
- Stored *Die Bibel* ISBN `9780688037246` is Keller *The Bible as History* (English) — title was already German, language wrong for the same reason as the others.

## Carry-forward updates
- [x] Decision + PLAN.md
- [ ] components.mdc / AGENTS — n/a

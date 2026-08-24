# Contacts semester investment: Brainstorm / Discovery Notes
Date: 2026-08-24 · Goal: Lock product shape for calendar-period meet cadence, sheet import, lists/grades/kids before fall semester

## Prior art
- Contacts Sessions 0–3 shipped: households, contacts, touches (meet|card), lists (Christmas cards seeded), rolling cadence_days, dashboard due, MCP.
- Sheet: Google "Christmas Cards" — Sheet1 (CRM), People for Things (invite roster), People (names only).

## Summary / key decisions
- **Bar:** Full wishlist by Aug 31 (import + period due + groups + grades + kids + pace + vCard).
- **Cadence:** Replace rolling days with calendar-period frequency (C/Q/S/A/N). Missed periods stay missed (no carry).
- **Windows:** Q = calendar quarters; S = Jan–Jun / Jul–Dec; A = Jan 1–Dec 31 (not Jul 31). Import on-ramp: Q starts Q4 2026; S H2 2026; A starts 2027 due 12/31/27.
- **Due UX (Kolbe 7-2-8-4):** One due list mixing Q/S/A, sorted oldest last-meet first. Skip = not this period (not a hit). Periods judge hit/skip/miss underneath.
- **Groups = Lists** with `standing | ad_hoc`. Standing for Circles filter; ad hoc clone yearly. People for Things → "Potential Invite" (do not seed Christmas).
- **Couples:** "X and Y" → two contacts, one household; due list collapses to household row.
- **Grades:** Giving A–E + Relationship A–D on **household**; collapsed timeline of changes.
- **Children:** household records (name + birthday); empty at import; vCard for birthday/email/phone match.
- **Address:** `address_updated_on` stamped 2026-01-01; bump only on address edits.
- **Pace:** strip on due view; no separate analytics module.

## Q&A log
### Q1 — Success bar
- Asked: Thin correct due by Aug 31 vs full wishlist?
- Captured: **Full wishlist** by Aug 31.
- Flags: none

### Q2 — Cadence model
- Asked: Replace rolling vs keep both?
- Captured: **Replace** with calendar-period cadence (C/Q/S/A/N).
- Flags: none

### Q3 — Period windows
- Asked: Quarters + Jul-31 annual vs academic S vs FY-Jul everything?
- Captured: Q/S civil calendar; **Annual = true Jan 1 year**; defer annuals until **12/31/27** (skip 2026 annual).
- Flags: none

### Q4 — Due and miss
- Asked: Whole-period queue vs late-only vs miss-blocks?
- Captured: **Whole current period** is work queue; independent misses; import on-ramp as recommended.
- Flags: none

### Q5 — Groups vs Lists
- Asked: Reuse Lists vs new Groups?
- Captured: Reuse Lists, but distinguish **permanent vs ad hoc**.
- Flags: none

### Q6 — Standing vs ad hoc
- Asked: kind + yearly clone vs single Christmas list + card log?
- Captured: **`standing | ad_hoc` + yearly clone** for campaigns.
- Flags: none

### Q7 — "and" rows
- Asked: Two contacts collapse due vs separate vs household-primary?
- Captured: **Two contacts, one household; due collapses**.
- Flags: none

### Q8 — Grades
- Asked: Enums on contact vs household vs history?
- Captured: **Household-level grades + history** (C+D combo).
- Flags: none

### Q9 — Grade history UX
- Asked: Visible timeline vs audit-only?
- Captured: Visible timeline on household sheet, **collapsed by default**.
- Flags: none

### Q10 — Children
- Asked: Child rows vs contacts vs defer?
- Captured: **Household children** (not due); empty import; ask about Apple Contacts for birthdays.
- Flags: none

### Q11 — Apple Contacts
- Asked: vCard birthday+email/phone vs birthday-only vs manual?
- Captured: **vCard** match by name; birthday + empty email/phone; addresses stay sheet-owned; unmatched → review.
- Flags: Parker must export vCard when ready

### Q12 — Address as-of
- Asked: dedicated date vs updated_at vs full history?
- Captured: **`address_updated_on`**; import 2026-01-01.
- Flags: none

### Q13 — Pace viz
- Asked: Due-tab strip vs dedicated page vs dashboard-only?
- Captured: **Due-tab + history strip**.
- Flags: none

### Q14 — Leftover columns
- Asked: Retired / Subscription / People-count / Christmas seed?
- Captured: Map Retired?; **ignore Subscription and People-count**; **do not seed Christmas**; People for Things → **"Potential Invite"** ad hoc list.
- Flags: none

### Q15 / Q15b — Frequency enum + Kolbe
- Asked: Replace cadence_days; Kolbe shape?
- Captured: One frequency enum; **one due list**; Common/None both off due (store letter); periods close themselves. Amended: suggest by **oldest last touch**; **Skip** removes without counting as success.
- Flags: none

### Q16 — Suggest vs skip
- Asked: Skip = period skip vs snooze vs immediate miss?
- Captured: **Skip = not this period**; history hit/skipped/missed; Q3 ends Sep 30; on-ramp unchanged.
- Flags: none

### Q17 — Completeness
- Asked: Enough to plan?
- Captured: **Enough** — lists cover future ad-hoc needs; no EAV custom fields.
- Flags: none

## Open flags (pending input)
- Parker exports Mac Contacts vCard when Session 6 vCard path is ready
- Exact Sheet1 CSV export at import time (link-shared sheet; agent may need File→Download)

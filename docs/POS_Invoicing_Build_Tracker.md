# Personal Operations System — Invoicing Module Build Tracker

_Last updated: April 13, 2026 | Module: Invoicing (1st) | Target: August 2026_

_Session-by-session plan for building the invoicing module. Each session ends with something working end-to-end. Update Done and Notes as you go._

---

## Pre-Session Checklist

- [x] Supabase upgraded to Pro ($25/mo) — ⚠ Not yet — upgrade the week build starts. Free tier pauses after 7 days inactivity.
- [x] shadcn-svelte registry fixed — updated `components.json` to drop `next.` prefix from `$schema` and `registry` URLs. Ran `npx shadcn-svelte@latest init` (v1.2.7), selected Nova preset, Zinc base color, overrode existing components. All 8 components installed and verified.
- [x] Tailwind v4 + Svelte 5 confirmed — `tailwindcss@4.1.18`, `@tailwindcss/vite`, `svelte@5.54.0`. No mismatch.
- [x] `app.css` theme variables written — init left file empty due to broken `@import "shadcn-svelte/tailwind.css"` (package doesn't ship a CSS file). Replaced with full Zinc OKLCH theme variables + `@theme inline` block + dark mode variables inlined directly.
- [x] Resend account created — signed up via GitHub. API key generated, stored in Apple Passwords under `ppp Resend`. Add `RESEND_API_KEY=re_xxxx` to `.env.local` before Session 4. Sending from `onboarding@resend.dev` for August — no domain verification needed.
- [x] Seed data SQL drafted for `clients` and `client_rates` — draft before opening Cursor for Session 1.

---

## Session 1 — App Shell + Seed Data

_Goal: A navigable app with real layout. No invoicing logic yet — just the skeleton that everything else lives inside._

| Task                                                                                                            | Done | Notes                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------- | :--: | -------------------------------------------------------------------------------------------------------------------------- |
| shadcn components installed — `button`, `input`, `label`, `select`, `sheet`, `dialog`, `badge`, `separator`     |  ✓   | Nova preset, Zinc base, Tailwind v4. Done April 11.                                                                        |
| Build root layout — `src/routes/+layout.svelte` — sidebar on desktop, bottom tab bar on mobile                  |  ✓   | Collapsible sidebar (localStorage-persisted), mobile bottom tab bar, active states via `page.url.pathname`. Done April 11. |
| Dashboard route — `/dashboard` — placeholder tiles (Invoicing, Library, Projects). No live data yet.            |  ✓   | Project status strip top, module tiles below. All show "–". Done April 11.                                                 |
| Seed `clients` table — SQL insert for your real clients                                                         |  ✓   | This Week Health, Fountain of Life Church. Run via Supabase SQL Editor. Done April 11.                                     |
| Seed `client_rates` table — one active rate per client, `effective_from = project start`, `effective_to = null` |  ✓   | One rate per client seeded. Done April 11.                                                                                 |
| Verify RLS — confirm owner can SELECT seeded rows, anon cannot                                                  |  ✓   | Verified via curl: owner JWT returns rows, anon key returns `[]`. Done April 11.                                           |

**Session exit state:** App is navigable. Sidebar works on desktop, bottom tab bar on mobile. Dashboard renders. Seeded clients and rates are in the database and RLS-protected.

---

## Session 2 — Time Entry List + Entry Form

_Goal: You can log time against a client from mobile or desktop._

| Task                                                                                                                      | Done | Notes                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------- | :--: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/invoicing` route — time entry list page skeleton                                                                        |  ✓   | Default view = current week. Toggle: day / week / month. Done April 11.                                                                                                         |
| Load time entries from Supabase — filtered by selected period, ordered by date desc                                       |  ✓   | Join `clients` for display name. Filter `deleted_at IS NULL`. Done April 11.                                                                                                    |
| Group entries by date in the list                                                                                         |  ✓   | Visual grouping only — no schema change. Done April 11.                                                                                                                         |
| Sheet component — new time entry form                                                                                     |  ✓   | Fields: client (select), date, hours, description. Triggered from a `+` button on the list page. Done April 11.                                                                 |
| Client rate lookup at entry creation — query `client_rates` for active rate on entry date, stamp onto `time_entries.rate` |  ✓   | Rate lookup working. Fixed: update action now re-stamps rate when stored rate is $0. Seed rates corrected on remote. Done April 13.                                             |
| Edit/delete time entry — sheet reuse with pre-filled fields; delete = soft delete (`deleted_at = now()`)                  |  ✓   | Edit triggers same sheet as create, pre-populated. Done April 11.                                                                                                               |
| Unbilled badge — count of unbilled entries per client surfaced on entry list                                              |  ✓   | Drives the dashboard tile state later. Done April 11.                                                                                                                           |
| Mobile layout pass — entry form should be full-screen sheet on mobile, comfortable to fill in quickly                     |  ✓   | Done April 13.                                                                                                                                                                  |
| **Hotfix:** `write_audit_log()` crash on `time_entries` UPDATE                                                            |  ✓   | `NEW.status` referenced unconditionally — fails on tables without `status` column. Fixed with nested IF guard. Baseline migration created to prevent recurrence. Done April 13. |

**Session exit state:** Full time entry CRUD. You can open the app on your phone, log an hour, and see it appear in the list.

---

## Session 3 — Invoice Generation

_Goal: Given a client and date range, generate a draft invoice from unbilled entries._

| Task                                                                                                             | Done | Notes                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------- | :--: | --------------------------------------------------------------------------------------------------------------------------- |
| `/invoicing/invoices` — invoice list page                                                                        |  ☐   | Columns: invoice number, client, period, status (badge), total.                                                             |
| "Generate Invoice" flow — client selector + date range picker → pull matching unbilled entries                   |  ☐   | Query: `WHERE client_id = ? AND date BETWEEN ? AND ? AND invoice_id IS NULL AND deleted_at IS NULL`                         |
| Invoice generation — create `invoices` row, create `invoice_line_items` rows, stamp `invoice_id` on time entries |  ☐   | Line items: default = one collapsed row per client (description editable). Support splitting into multiple date-range rows. |
| One-off line item support — add arbitrary line at generation time (description + price, no time entry backing)   |  ☐   | `is_one_off = true` on `invoice_line_items`. No `quantity` or `unit_price` required — just `total` and `description`.       |
| Invoice preview — `/invoicing/invoices/[id]` — formatted view of all line items, subtotal, total                 |  ☐   | This is the pre-send review. Not the PDF — just the data rendered cleanly.                                                  |
| Invoice number auto-generation via `generate_invoice_number()` function                                          |  ☐   | Function already in schema. Call it at INSERT time.                                                                         |
| Subtotal + total calculation — stored at generation, not re-derived on read                                      |  ☐   | Sum line item totals. Store on `invoices.subtotal` and `invoices.total`.                                                    |

**Session exit state:** You can generate a draft invoice, see a clean preview with line items, and the unbilled entries are now linked to the invoice.

---

## Session 4 — PDF + Email

_Goal: Send a real invoice to a client._

| Task                                                                                                                | Done | Notes                                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | :--: | ------------------------------------------------------------------------------------------------ |
| Supabase Edge Function — `generate-invoice-pdf`                                                                     |  ☐   | Takes `invoice_id`. Queries invoice + line items + client. Returns PDF bytes via `pdf-lib`.      |
| PDF layout — invoice number, client info, period, line items table, subtotal, total, notes                          |  ☐   | Keep simple for August. Professional but not fancy.                                              |
| Resend integration — `send-invoice` Edge Function (or combined with PDF function)                                   |  ☐   | PDF attached. Subject: `Invoice [invoice_number] — [client_name]`. `sent_at` stamped on success. |
| Status transition — `draft → sent` on send. Confirm prompt before sending. `revertible = false` stamped by trigger. |  ☐   | UI: "Send Invoice" button on invoice detail. Confirm modal.                                      |
| "Mark as Paid" — manual status transition `sent → paid`. Stamps `paid_at`. `revertible = false`.                    |  ☐   | Simple button on invoice detail. No payment tracking beyond this for August.                     |
| Error handling — failed PDF generation or email send should not corrupt invoice state                               |  ☐   | If edge function fails, invoice stays `draft`. Surface error in UI.                              |

**Session exit state:** You can send a real PDF invoice to a client by email and mark it paid when payment arrives.

---

## Session 5 — Dashboard Wiring + Settings

_Goal: Invoicing state surfaces on the dashboard. Settings page is functional._

| Task                                                                                                   | Done | Notes                                                                                            |
| ------------------------------------------------------------------------------------------------------ | :--: | ------------------------------------------------------------------------------------------------ |
| Dashboard invoicing tile — live unbilled entry count                                                   |  ☐   | Query: `COUNT(*) WHERE invoice_id IS NULL AND deleted_at IS NULL`. Links to `/invoicing`.        |
| `/settings/invoicing` — read-only client list with rates                                               |  ☐   | No CRUD UI. Just a clean read view so you can verify seed data without going to Supabase Studio. |
| `/settings/profile` — basic profile view, password change                                              |  ☐   | Minimal. Auth handled by Supabase; just expose the UI.                                           |
| Navigation polish — active states, mobile tab bar labels, any layout rough edges from earlier sessions |  ☐   |                                                                                                  |
| Invoicing module smoke test — full flow: log entry → generate invoice → PDF → send → mark paid         |  ☐   | End-to-end on real data with real client before calling the module done.                         |

**Session exit state:** Invoicing module is complete and in use. Dashboard reflects live state. You are billing real clients through the app.

---

## Session 6 — Audit Log UI

_Goal: Settings → Audit Log is functional for invoicing (and ready for subsequent modules)._

| Task                                                                                           | Done | Notes                                                    |
| ---------------------------------------------------------------------------------------------- | :--: | -------------------------------------------------------- |
| `/settings/audit-log` — query `audit_log` table, newest first                                  |  ☐   | Owner only. Viewer gets 403.                             |
| Module filter — filter by `table_name` (map to module: invoicing tables → Invoicing filter)    |  ☐   | Filter chips or select. AND logic if multiple active.    |
| Search — by `record_id` and `changed_by`                                                       |  ☐   | Simple text input.                                       |
| Row display — operation badge (INSERT/UPDATE/DELETE), table, old → new diff (JSONB), who, when |  ☐   | Diff: show key-level changes only, not full JSON dump.   |
| Revert button — visible only when `revertible = true`. Confirm before executing.               |  ☐   | Revert = apply `old_data` back to the record via UPDATE. |
| Test revert on a time entry edit                                                               |  ☐   | Verify the trigger's `revertible` flag is set correctly. |

**Session exit state:** Audit log is live. You can see every invoicing action and revert eligible changes.

---

## Open Questions — Invoicing

_Track anything unresolved that would block a session. Resolve before that session starts._

| #   | Question                                                                                    | Status                                                                                      |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | PDF layout — any specific branding/formatting requirements beyond "professional"?           | ✓ Resolved — clean typography only, no logo for August                                      |
| 2   | Resend: send from which address? Domain verified?                                           | ✓ Resolved — sending from `onboarding@resend.dev`, no domain verification needed for August |
| 3   | One-off line items — is `total` sufficient, or do you need `quantity × unit_price` tracked? | ☐ Open — schema supports both; decide at Session 3                                          |

---

## Sender onboarding (Resend — before billing real clients)

_Use this when moving off the Resend sandbox (`onboarding@resend.dev`). Sandbox email may only reach your Resend account email until a domain is verified._

1. **Add a domain** in [Resend](https://resend.com) → Domains → Add domain (e.g. `yourdomain.com`).
2. **Add DNS records** (SPF/DKIM) at your DNS host as shown in Resend.
3. **Wait for verification** (minutes to hours for DNS propagation).
4. **Update the Edge Function** [`supabase/functions/send-invoice/index.ts`](../supabase/functions/send-invoice/index.ts): change `from` from `onboarding@resend.dev` to an address at your verified domain (e.g. `invoicing@yourdomain.com`). Redeploy: `supabase functions deploy send-invoice`.
5. **Optional:** set `reply_to` in the Resend payload to your personal inbox so client replies reach you.
6. **Align letterhead:** set `SENDER_EMAIL` (and other `SENDER_*` secrets) to match your professional sender identity on the PDF.
7. **Smoke test:** use **Download PDF** and **Send test to myself** on a draft invoice, then send to a real client address.

**Not required for August MVP:** custom SMTP, open tracking, marketing-style unsubscribe links (transactional invoices).

---

## Notes

- Session order is intentionally sequential — each session unblocks the next. Don't start Session 3 (invoice generation) before Session 2 (time entries) because generation depends on real unbilled entries to test against.
- Seed data should use real clients and real rates from the start. Testing with fake data that doesn't match your actual billing structure wastes sessions.
- The app shell in Session 1 is 30–45 minutes of work. Don't skip it — retrofitting nav into a module-first structure is messier than building it once upfront.
- Edge Functions (Session 4): `generate-invoice-pdf` and Resend send can be one function or two. Two is cleaner for error isolation — PDF generation failure should be distinguishable from email send failure.
- `invoice_line_items` has no `updated_at` per schema — line items are replaced, not edited in place. If you need to modify a line item after generation, delete and re-insert.
- shadcn-svelte setup notes (April 11): registry was broken on `@next` branch. Fix = update `components.json` `$schema` and `registry` to drop `next.` prefix, then run `npx shadcn-svelte@latest init`. Nova preset selected (tighter spacing, suits productivity app). Zinc base color. `app.css` must have theme variables inlined directly — the package does not ship a `tailwind.css` file despite the init generating an import for it.
- Resend free tier: 3,000 emails/month. API key in Apple Passwords under `ppp Resend`. Add `RESEND_API_KEY` to `.env.local` before Session 4.

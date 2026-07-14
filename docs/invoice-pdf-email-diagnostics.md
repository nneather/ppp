# Invoice PDF email diagnostics

**Purpose:** When one recipient can open the outgoing invoice PDF and another on the **same org / email platform** cannot, collect evidence before changing Edge MIME again. Complements the MIME harden in [078](decisions/078-invoice-email-pdf-mime.md) (`content_type: application/pdf` + plain-text body in `send-invoice`).

**Status:** Owner-run checklist. Bring the minimum useful set (bottom) into the next invoicing chat if the failure persists.

---

## 1. Lock the symptom (both people, same email)

Ask both recipients the same questions about **the same message** (same Resend send / same Message-ID):

| Question | Why it matters |
|---|---|
| Attachment visible at all? (paperclip / file chip) | Missing vs present-but-broken |
| If visible: size shown? (~few KB vs expected tens of KB) | Truncation / strip |
| Opens in Gmail preview? Downloads? Opens in Preview/Acrobat? | Viewer vs bytes |
| Exact error text / screenshot | “Blocked”, “empty”, “corrupt”, Safe Browsing |
| Client: Gmail web / iOS Gmail / Android Gmail / Outlook / Apple Mail | Client-specific MIME bugs |
| To vs CC vs BCC | Gateways sometimes treat differently |

Also note: **mobile vs desktop** for the failing person (common Workspace split).

---

## 2. Confirm it is one delivery, not two drafts

From the sender:

- Invoice number + approximate send time (Chicago)
- Whether this was **Send** or **Send test to myself**, and exact To/CC/BCC addresses used
- Whether the failing person was on **To** or **CC**
- Whether this send was **after** the 078 Edge deploy (2026-07-09). If unsure, do one fresh **Send test** + one real resend now so the payload includes `content_type` + `text`

---

## 3. Resend dashboard (highest-value server evidence)

For that email id in [Resend → Emails](https://resend.com/emails):

- Delivery status (delivered / delayed / bounced / complained) for **each** address
- Attachment list: **filename**, **content type**, **size (bytes)**
- Any event timeline (delivered to Google, deferred, etc.)
- Copy of the **email id** (e.g. `re_…`)

If Resend shows a healthy `application/pdf` attachment of plausible size for both recipients, the bug is almost certainly **inbound Google/org filtering or client rendering**, not our PDF generator.

---

## 4. Gmail “Show original” from both people (best client evidence)

Have **both** the working and failing recipients:

1. Open the message → ⋮ → **Show original** (or “Download message”)
2. Save/share the `.eml` **or** paste:
   - Full `Message-ID` / `Date` / `From` / `To` / `Cc`
   - The `Content-Type` of the top-level message (`multipart/mixed`?)
   - Whether there is a part with `Content-Type: application/pdf` (and `Content-Disposition: attachment; filename=…`)
   - Rough size of the base64 PDF part (or “no PDF part present”)

Compare side-by-side. If the failing mailbox’s original has **no PDF part** but the working one does, org security stripped it after delivery. If both have the same PDF part and only one client fails to open it, it’s client/viewer/policy on open.

---

## 5. Org / mailbox differences (same company ≠ same policy)

Even on one Google Workspace domain, collect:

- Are they in the **same OU** / same admin-managed policies?
- Any **Safe Attachments / advanced phishing / DLP** that quarantines PDFs for some users?
- Does the failing user have a **different primary client** (Outlook + Gmail sync, Focused Inbox, third-party scanner)?
- Does the PDF appear under **Spam / Quarantine / “Blocked attachments”** for the failing user only?
- Can the failing user open a **manual** PDF you email outside Resend (Gmail attach from desktop) of the same invoice downloaded from `/invoicing/invoices/[id]`?

That last A/B separates “our MIME via Resend” from “this mailbox blocks PDFs in general.”

---

## 6. Optional quick A/B (~5 minutes)

1. Download PDF from the invoice page (app path).
2. Email it yourself from Gmail to both people.
3. Resend the same invoice via the app to both.

| App Resend | Manual Gmail attach | Conclusion |
|---|---|---|
| Fail one / both OK | Both OK | Still Resend MIME or gateway treatment of Resend-origin mail |
| Fail one / both OK | Fail same one | Mailbox/policy on that user |
| Both fail | Both OK | Resend path still broken for that domain |

---

## What *not* to chase first

- Re-encoding the PDF in `generate-invoice-pdf` — 078 already ruled out corrupt bytes when the sender could open the same attachment.
- Assuming “same org” means identical filtering — Workspace policies are often per-user/OU.

---

## Minimum useful set to bring back

1. Resend email id + attachment size/type screenshot
2. Failing user’s symptom + client (one sentence + screenshot)
3. “Show original” snippet from **failing** mailbox (PDF part present or not)
4. Result of manual Gmail attach A/B

With those four, the next step is either another Edge MIME tweak, a Resend-supported attachment mode change, or an org-admin / recipient-side fix — not a blind code change.

**Related code:** [`supabase/functions/send-invoice/index.ts`](../supabase/functions/send-invoice/index.ts), [`supabase/functions/generate-invoice-pdf/index.ts`](../supabase/functions/generate-invoice-pdf/index.ts).

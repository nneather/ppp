# Contacts — Christmas Mailing Plan (2026)

> **Status:** plan, not started · **Created:** 2026-11-04 · **Module:** Contacts ([tracker](POS_Contacts_Build_Tracker.md))
>
> Two jobs off the **Christmas cards** list (`contact_lists.kind = 'ad_hoc'`, membership = households):
> 1. **Address outreach** — text everyone to confirm their address, or ask for it if we don't have one.
> 2. **Postcards via Lob** — print and mail a photo Christmas postcard to every confirmed address.
>
> **Build shape:** local scripts first (`scripts/christmas-*.ts`, run from the repo root with `npx tsx`), no UI.
> A ppp screen is a year-2 option once the flow has proven itself.

## Timeline (target)

| When | What | Who |
|------|------|-----|
| Nov 4–8 | Lob account + keys; approve outreach copy; pick photo direction | **Parker** |
| Nov 9–13 | Phase 0 audit · Phase 1 outreach script · test text to self · batch send | Agent → **Parker go** |
| Nov 13–25 | Replies come in; paste to agent; addresses updated | **Parker** + agent |
| Nov 26–Dec 4 | Phase 3 postcard script · Lob test-mode PDF proofs · one live card to self | Agent → **Parker review** |
| **By Dec 8** | **Live batch send** (in homes ~Dec 15–17) | **Parker go** |

*Avoid Nov 6 (OT340 midterm), Nov 15 and Nov 22 (sermons) for anything that needs Parker's attention.*

---

## Phase 0 — List audit (agent)

- Pull the Christmas cards list and report, per household:
  - **full address** (line 1 + city + state + zip) · **partial** · **none**
  - `address_updated_on`: when the address was last checked, if ever
  - **a contact who can be messaged:** a phone (preferred) or email on some household member
- Output: counts plus three lists: **confirm** (has an address) · **ask** (no address) · **manual** (no phone or email,
  so Parker reaches them some other way).
- Note list members that are **contacts rather than households** (the schema allows either). Resolve each to its
  household, or flag it if it has none.
- **Known snag (2026-11-04):** the direct DB host in `LIBRARY_DST_DATABASE_URL` didn't resolve from the agent's
  shell. Try the Supabase pooler connection string next; otherwise Parker runs the audit script himself.

## Phase 1 — Address outreach by iMessage

**Recommended channel:** iMessage from Parker's Mac (his own number, one message per person, replies come back as normal texts).
**Rejected:** a texting service like Twilio. US carriers require business registration first (weeks plus fees), and the texts come
from an unfamiliar number.

### Build — `scripts/christmas-outreach.ts`

- **Recipient per household:** one contact with a phone. Default = the first household member with a phone; Parker can
  override per household with a short override file (`household → contact`).
- **Two message templates**, `{first_name}` and `{address}` merged in:
  - *Confirm:* "Hi {first_name}! We're sending Christmas cards this year — is this still the best address for you?
    {address}"
  - *Ask:* "Hi {first_name}! We're sending Christmas cards this year and would love to include you — what's the best
    mailing address for you?"
  - (Drafts; Parker edits and approves the final wording.)
- **Modes**
  - `--preview` (default): writes every message to a markdown file and sends nothing. **This file is also the copy/paste
    fallback** if Parker would rather send by hand from his phone.
  - `--self`: sends one confirm and one ask message to Parker's own number.
  - `--send`: live batch through the Messages app (AppleScript via `osascript`).
- **Safety:** sends are spaced 10–20s apart so they don't look like spam · stops on the first error · keeps a
  **sent ledger** so a re-run skips anyone already messaged · email-only contacts go to a separate Gmail-draft step
  (or the manual list), never through the texting path.

### Parker's steps

1. **Approve the two messages** (wording, and whether to sign "— Parker" or "— Parker & family").
2. **Decide the disclosure line.** Standing rule: anything sent on your behalf opens with *Sent with Claude*. These are
   your words from your number, sent by a script. Include it, or make a personal-mail exception? *(Default until you say
   otherwise: include it.)*
3. Make sure **Messages on the Mac is signed in** with your number. Settings → Messages → "Text Message Forwarding" on
   your iPhone lets green-bubble SMS send from the Mac too.
4. On the first run macOS asks to **let Terminal/VS Code control Messages**. Click Allow.
5. Review the preview file → run `--self` → check the two texts on your phone → say **go** for `--send`.

## Phase 2 — Reply intake

- Parker pastes replies (or screenshots) into a session. The agent turns each into a clean address (reusing the HeLOS
  `parseAddress.ts` logic) and shows a **before/after table for approval**.
- On approval, a guarded repo-root script updates `households.address_*` and sets `address_updated_on = today`.
  It only updates households on the list, matched by id and never by name.
- "Yes, that's right" replies: just set `address_updated_on` (this is what marks a household **confirmed** for Phase 3).
- **Open:** log each outreach as a `contact_touch`? A mass text isn't really a relationship touch, and it would reset
  cadences. *Default: no.*

## Phase 3 — Postcards via Lob

### Parker's steps (do early; nothing here blocks Phases 0–2)

1. **Create a personal Lob account** at lob.com (Developer plan, free; pay per piece). Use a personal email, **not
   the 229 account**.
2. Add a **payment method** in the Lob dashboard.
3. Copy the **test** and **live API keys** (Dashboard → Settings → API Keys) into `ppp/.env.local`:
   ```
   LOB_TEST_API_KEY=test_...
   LOB_LIVE_API_KEY=live_...
   ```
   Never commit them. `.env.local` is gitignored and covered by the encrypted Time Machine backup.
4. **Check the per-piece price** in the dashboard for the size you pick. As of July 2026 the Developer plan is
   reported at about **$0.905 per postcard** including postage; larger sizes cost more.
5. **Pick the photo.** For 6x9 the front, including the trim edge, is 9.25 × 6.25 in, so **2775 × 1875 px** at 300 dpi.
   Use the highest-resolution original you have.
6. **Write the back message.** Keep it short: the address block takes up about half the back.
7. **Return address:** home address, or none?

### Build — `scripts/christmas-postcards.ts`

- **Recipients:** list households with a full address **and** `address_updated_on` in 2026. Anyone confirmed but
  incomplete gets reported, not sent.
- **Ported from HeLOS** (`~/dev/TWH/helos_app/src/app/events/postcards/`): the back-HTML builder from `lobArtwork.ts`
  (message → print-safe HTML, blank lines become spacing) and `parseAddress.ts`. The React screens don't come over.
  - HeLOS lesson: **5x7 works on Lob** even though the API docs only list 4x6/6x9/6x11. Default here is **6x9**
    (most card-like); 5x7 stays an option.
- **Modes**
  - `--test` (default): uses the test key. Lob renders **PDF proofs** for every card and mails nothing.
  - `--self`: live key, **one card to Parker's own address**. Check paper, colour and layout in hand.
  - `--send`: live batch. Prints the count and estimated cost and asks for confirmation first.
- **Safety:** a **sent ledger** of Lob postcard IDs per household, so a re-run never mails twice · stops on the first
  error · an idempotency key per household (a Lob feature that makes repeat requests safe).
- Lob's address verification is billed separately on some plans. Check before turning it on; the Phase 2 confirmation
  is the main quality check.

## Decisions log (fill in as made)

| Decision | Default | Final |
|----------|---------|-------|
| Who gets messaged per household | first member with a phone | |
| *Sent with Claude* line on texts | include (standing rule) | |
| Log outreach as a contact touch | no | |
| Postcard size | 6x9 | |
| Send only addresses confirmed in 2026 | yes | |

## Year 2 (not now)

- A ppp screen for the whole flow (list → outreach → proofs → send).
- A **self-serve address link**: each text carries a personal link to a small ppp form that writes straight into the
  household, so no replies need retyping.
- Clone the list yearly (the list's own notes already say so).

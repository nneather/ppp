# Contacts — Christmas Mailing Plan (2026)

> **Status:** plan, not started · **Created:** 2026-11-04 · **Module:** Contacts ([tracker](POS_Contacts_Build_Tracker.md))
>
> Two jobs off the **Christmas cards** list (`contact_lists.kind = 'ad_hoc'`, membership = households):
> 1. **Address outreach** — text everyone to confirm their address, or ask for it if we don't have one.
> 2. **Postcards via Lob** — print and mail a photo Christmas postcard to every confirmed address.
>
> **Build shape:** the text outreach is a local script (`scripts/christmas-outreach.ts`, run from the repo root
> with `npx tsx`). **Postcards get a real ppp screen** (decided 2026-11-04: this will run most years), mocked up
> below and approved before it's built.

## Timeline (target)

| When | What | Who |
|------|------|-----|
| Nov 4–8 | Lob account + keys · ~~approve outreach copy~~ (done 11/04) · approve screen mockup | **Parker** |
| Nov 9–13 | Phase 0 audit · Phase 1 outreach script · test text to self · batch send | Agent → **Parker go** |
| Nov 13–25 | Replies come in; paste to agent; addresses updated | **Parker** + agent |
| Nov 16–25 | Phase 3 postcard screen built (Session 0 → build) | Agent |
| Nov 23–29 | Front collage in Canva; back message written | **Parker** |
| Nov 30–Dec 4 | Lob test-mode PDF proofs on the screen · one live card to self | **Parker review** |
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
- **Two message templates**, `{first_name}` and `{address}` merged in (**approved by Parker 2026-11-04, use verbatim**):
  - *Confirm:* "Hey, {first_name}! I'm sending Christmas cards this year! Is this still the best address for you? {address}"
  - *Ask:* "Hey {first_name}! I'm sending Christmas cards this year and would love to include you. What's the best
    mailing address for you?"
  - `{address}` = one line, e.g. "123 Main St, Apt 4, Columbia, SC 29201".
- **Modes**
  - `--preview` (default): writes every message to a markdown file and sends nothing. **This file is also the copy/paste
    fallback** if Parker would rather send by hand from his phone.
  - `--self`: sends one confirm and one ask message to Parker's own number.
  - `--send`: live batch through the Messages app (AppleScript via `osascript`).
- **Safety:** sends are spaced 10–20s apart so they don't look like spam · stops on the first error · keeps a
  **sent ledger** so a re-run skips anyone already messaged · email-only contacts go to a separate Gmail-draft step
  (or the manual list), never through the texting path.

### Parker's steps

1. ~~**Approve the two messages**~~ — done 2026-11-04.
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
- **Outreach texts are not logged as touches** (decided 2026-11-04).

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
5. **Make the front collage in Canva** (free; closest thing to Shutterfly's collage editor). See *Making the artwork*
   below.
6. **Write the back message.** Keep it short: the address block takes up about half the back.
7. **Return address:** home address, or none?

### Making the artwork

**Front: Canva collage**
- Canva → *Create a design* → *Custom size* → **9.25 × 6.25 in** (6x9 plus 0.125 in trim edge on every side).
- Start from a Christmas photo-collage template (search "Christmas photo card" or "photo collage postcard") and
  resize it, or use Canva's **Grids** elements to drop photos into frames.
- **Turn on View → Show margins / Show print bleed.** Keep faces and any text **inside the margins** (0.25 in from
  the trim). Anything in the outer edge may get cut off.
- Use full-resolution photos. Canva warns you if one is too small for print.
- Export: **Share → Download → PDF Print** (free). This is the file you upload to the screen.

**Back: two options. Default is A this year.**
- **A. Text message rendered by ppp.** You type the message on the screen and it lays it out in the safe area,
  ported from HeLOS, which was checked against a real Lob print. The preview updates as you type, so there's no guessing
  whether it fits.
- **B. Designed back in Canva** (e.g. a small photo plus a script font). Same 9.25 × 6.25 in size, but the **right
  half must stay blank** for the address and postage. Lay Lob's downloadable 6x9 back template over the design as a
  guide, then delete the template layer before exporting.

**Final check either way:** Lob's test mode returns a PDF proof of exactly what will print. That proof (and the
one card mailed to yourself) is the real verification, not the Canva preview.

### Build — Postcards screen

Lives under Contacts and is launched from a list ("Send postcards" on the Christmas cards list). Reused every year
by cloning the list.

```
┌ Contacts › Christmas cards 2026 › Postcards ────────────────────────────────────────────┐
│ ① Artwork                         │ ② Recipients  42 ready · 6 unconfirmed · 3 no addr   │
│ Size [6x9 ▾]                      │ ☑ Smith household   123 Main St, Columbia SC   11/14 │
│ Front [ Upload PDF/PNG ] ✓ front.pdf│ ☑ Jones household   45 Oak Ave, Irmo SC        11/12 │
│ Back  (•) Message  ( ) Upload     │ ☐ Brown household   ⚠ not confirmed this year         │
│ ┌ message ─────────────────────┐  │ ☐ Lee household     ⚠ no address                      │
│ │ Merry Christmas from ...     │  │ …                                                    │
│ └──────────────────────────────┘  │                                                      │
│ Return addr [home ▾]              │ ③ Proof & send                                       │
│ ┌ live preview front | back ───┐  │ [ Test proofs (free) ]  → 3 sample PDFs              │
│ │                              │  │ [ Mail one to me ]       ~$1                          │
│ └──────────────────────────────┘  │ [ Send 42 · est. $38 ]   confirm dialog              │
│                                   │ History: 2025 · 38 sent · $33                        │
└───────────────────────────────────┴──────────────────────────────────────────────────────┘
```

- **Recipients:** list households with a full address **and** `address_updated_on` in the current year are checked
  by default. Unconfirmed or incomplete ones show but stay unchecked.
- **Proof & send:** test proofs use the test key. Lob renders **PDF proofs** and mails nothing. "Mail one to me"
  uses the live key and Parker's own address. The batch send shows the count and estimated cost and needs a
  confirmation.
- **On a live send:** logs a **`card` touch** for each mailed household's members, the existing kind that does
  *not* affect due dates. It reuses `householdEligibleForCardList` and the `logListCards` path in
  `src/lib/contacts/server/actions.ts`. No new touch kind needed.
- **Storage:** a `postcard_sends` table (list, household, Lob id, size, cost, status, sent_on) gives the history
  line and the never-mail-twice guard. Artwork goes in Supabase storage. Lob keys are read server-side only.
- **Ported from HeLOS** (`~/dev/TWH/helos_app/src/app/events/postcards/`): the back-HTML builder from `lobArtwork.ts`
  (message → print-safe HTML, blank lines become spacing) and `parseAddress.ts`. The React screens get rebuilt in
  Svelte, not copied.

- HeLOS lesson: **5x7 works on Lob** even though the API docs only list 4x6/6x9/6x11. Default here is **6x9**
  (most card-like); 5x7 stays in the size menu.
- **Safety:** never mails a household twice in one list (checked against `postcard_sends`) · stops on the first
  error · an idempotency key per household (a Lob feature that makes repeat requests safe).
- **Session 0 first:** lock the `postcard_sends` schema and route placement, and get the mockup approved before code.
- Lob's address verification is billed separately on some plans. Check before turning it on; the Phase 2 confirmation
  is the main quality check.

## Decisions log (fill in as made)

| Decision | Default | Final |
|----------|---------|-------|
| Who gets messaged per household | first member with a phone | |
| *Sent with Claude* line on texts | include (standing rule) | |
| Outreach copy | — | **approved verbatim 2026-11-04** |
| Log outreach texts as touches | no | **no (2026-11-04)** |
| Log mailed postcards as touches | `card` kind (no due-date effect) | |
| Postcards: script or screen | script | **screen (2026-11-04)** |
| Postcard size | 6x9 | |
| Back of card | ppp-rendered message (A) | |
| Send only addresses confirmed this year | yes | |

## Year 2 (not now)

- Fold the text outreach into the screen as well (list → outreach → proofs → send).
- A **self-serve address link**: each text carries a personal link to a small ppp form that writes straight into the
  household, so no replies need retyping.
- Clone the list yearly (the list's own notes already say so).

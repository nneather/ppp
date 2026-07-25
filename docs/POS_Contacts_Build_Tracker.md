# Personal Operations System — Contacts / CRM Module Build Tracker

_Last updated: 2026-07-25 | Module: Contacts / CRM (6th) | Sessions 1–3 shipped ([182](decisions/182-contacts-session-3-lists-cadence-touch-kinds.md)); MCP smoke still open_

**Read before any session:** `docs/MODULE_KICKOFF_PLAYBOOK.md` (footgun registry + Phase 0), [000](decisions/000-invoicing-retro.md), [041](decisions/041-library-module-retro.md), [138](decisions/138-fall-semester-priorities.md), [139](decisions/139-lightweight-crm-fall-priority.md), [175](decisions/175-contacts-session-0.md).

**Hard constraints (do not revisit):**
- Library table `people` = authors — **never** reuse for CRM contacts.
- Invoicing `clients` = billing — keep separate unless owner explicitly wants a link FK later.
- Table / route / permission slug = **`contacts`** everywhere.

---

## Critical path

Core value — **who is due for a meet, and who gets a Christmas card**: cadence-driven reminders, household mailing addresses, seasonal list membership, and MCP-readable due list. Thin v1 useful by **~Thanksgiving** (Christmas cards), not only Aug 31.

- **End of Session 1** = schema + `/contacts` CRUD (list + Sheets) + one-tap Log Contact + detailed touch log + households + settings lists — usable for data entry.
- **End of Session 2** = dashboard "due to meet" strip + real MCP tools (`list_contacts_due`, `search_contacts`).
- **End of Session 3** = Lists third tab + cadence months/years + touch `kind` (meet vs card) + Christmas-card bulk log — [182](decisions/182-contacts-session-3-lists-cadence-touch-kinds.md) (locks [181](decisions/181-contacts-smoke-product-locks.md)).

**v1 out of scope:** mailing-list send / Resend campaigns / unsubscribe compliance (email + address fields designed for later; no send pipeline). Card **logging** at send time is in scope for Session 3 (not email send).

---

## Phase 0 — Structure Lock (signed off 2026-07-24)

| Gate | Resolution |
|---|---|
| **Taxonomy singular** | Two core tables: `contacts` (1:1 outreach) + `households` (cards / invites / mailing address). Marriages merge contacts into a household; splits reverse that. **≠** library `people`, **≠** invoicing `clients`. |
| **Cadence** | Interval on the **person** (not lists). Override → profile default → app constant. Never on households. UI units = **months or years** ([181](decisions/181-contacts-smoke-product-locks.md)); storage may stay day-equivalent. Household meet-touch fans out to live members. Due = never touched **with a meet-kind touch**, or last **meet** touch older than effective cadence. |
| **Touch history** | `contact_touches` (`touched_on` + nullable `note` + **`kind`** meet\|card per [181](decisions/181-contacts-smoke-product-locks.md)). UI: one-tap + detailed (note; backdate detailed-only). Last **meet** touch drives due; card bulk log does not. |
| **Reminders vs lifecycle** | Two axes: `no_reminders` bool (close family seen weekly — still active, still on card lists) + `status` `active`/`retired` (moved away). Default list filter = Active. |
| **Seasonal / lists** | `contact_lists` + `contact_list_members` day one; Christmas cards = first list. Membership = **contact XOR household** (`validateXor` / library polymorphic pattern) — card list holds households; future email lists hold people. |
| **Names** | Contacts: `first_name` NOT NULL + nullable `last_name`. Envelope / card display name on `households.name`. |
| **Address / email** | Structured address on **households only** (line1/2, city, state, postal, country). Contacts carry single `email` + `phone`. Singles who get mail = household of one (create flow must be clean — H1). |
| **Form delivery** | Both contact + household ≪15 fields → Sheets. List at `/contacts` with tabs **Contacts \| Households \| Lists** ([181](decisions/181-contacts-smoke-product-locks.md); settings lists may remain for CRUD). Dashboard "due to meet" (desktop card + mobile glance tile). **Desktop sidebar nav only** — mobile tab bar stays at 5. |
| **RLS + viewer** | SELECT via `app_is_owner() OR app_has_module_read('contacts')`; INSERT/UPDATE/DELETE owner-only. **Solo waiver:** viewer write untested/unsupported v1. |
| **MCP read surface (day one)** | `list_contacts_due` (replaces stub, **same tool name** per [144](decisions/144-ppp-mcp-readonly-v1.md)) + `search_contacts`. `christmas_card_list` rejected. Contracts locked below; implementation Session 2. |
| **Edge Function ↔ `deleted_at`** | N/A — no Edge Functions planned for v1. |

**Checklist:**
- [x] Taxonomy singular (contacts ≠ households ≠ people ≠ clients; one list-membership mechanism)
- [x] Nullable matrix signed
- [x] Sheet vs page decided (+ dashboard + nav slot)
- [x] RLS plan + viewer solo waiver written
- [x] MCP day-one surface locked
- [x] Open Questions ≤2 per entity

---

## Schema sketch (Session 1 ships `ppp_contacts_v1` — do not apply in Session 0)

Standard conventions apply: `deleted_at` soft delete, `created_at`/`updated_at` + `set_updated_at` trigger, `created_by`, audit trigger, explicit GRANTs (footgun #8), RLS helpers ([000](decisions/000-invoicing-retro.md)).

### `households`

```sql
households
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  name            TEXT NOT NULL                 -- display + envelope ('The Jones Family', 'Tom & Sarah Jones')
  address_line_1  TEXT
  address_line_2  TEXT
  city            TEXT
  state           TEXT                          -- postal abbr when US
  postal_code     TEXT
  country         TEXT                          -- nullable; default display 'US' in UI only if helpful
  notes           TEXT
  deleted_at      TIMESTAMPTZ
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by      UUID REFERENCES profiles(id)
```

**Indexes:** partial on `(name)` `WHERE deleted_at IS NULL` if search needs it; otherwise name ILIKE in app is fine for v1 scale.
**App rules:** Singles who receive postal mail get a household of one (H1). Soft-deleting a household must not cascade-delete contacts — null `contacts.household_id` or block delete while members live (Session 1 choose; prefer block like venues).

### `contacts`

```sql
contacts
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  first_name      TEXT NOT NULL
  last_name       TEXT
  household_id    UUID REFERENCES households(id)  -- nullable; unmarried / no mail yet OK
  email           TEXT
  phone           TEXT
  cadence_days    INT                             -- nullable; NULL → profiles.contact_cadence_days_default → app constant
  no_reminders    BOOLEAN NOT NULL DEFAULT false  -- exclude from due list; still active / list-eligible
  status          TEXT NOT NULL CHECK (status IN ('active','retired')) DEFAULT 'active'
  birthday        DATE                            -- STRUCK Session 1 (C1) — not in live schema
  notes           TEXT
  deleted_at      TIMESTAMPTZ
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by      UUID REFERENCES profiles(id)
```

**Indexes:** `(status)`, `(household_id)`, `(no_reminders)` — partial `WHERE deleted_at IS NULL`.
**App rules:** Default list filter = `status = 'active'`. Due-to-meet excludes `no_reminders` and `retired`. Effective cadence = `COALESCE(cadence_days, profile.default, APP_DEFAULT)`.

### `contact_touches`

```sql
contact_touches
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  contact_id      UUID NOT NULL REFERENCES contacts(id)
  touched_on      DATE NOT NULL                   -- Chicago civil (ymdInChicago)
  note            TEXT                            -- nullable
  deleted_at      TIMESTAMPTZ
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by      UUID REFERENCES profiles(id)
```

**Indexes:** `(contact_id, touched_on DESC)` partial `WHERE deleted_at IS NULL`.
**App rules:** One-tap Log Contact inserts today + null note. Detailed path allows note + optional backdate (T1). Household-level "log touch" inserts one row per live household member with the same `touched_on` (and shared note if provided).

### `contact_lists`

```sql
contact_lists
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  name            TEXT NOT NULL                   -- e.g. 'Christmas cards'
  notes           TEXT
  sort_order      INT NOT NULL DEFAULT 0
  deleted_at      TIMESTAMPTZ
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by      UUID REFERENCES profiles(id)
```

**Seed (Session 1):** one row `Christmas cards` (or create on first use — Session 1 pick; prefer seed so the settings page isn't empty).

### `contact_list_members`

```sql
contact_list_members
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  list_id         UUID NOT NULL REFERENCES contact_lists(id)
  contact_id      UUID REFERENCES contacts(id)    -- XOR with household_id
  household_id    UUID REFERENCES households(id)  -- XOR with contact_id
  deleted_at      TIMESTAMPTZ
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by      UUID REFERENCES profiles(id)
  -- CHECK: exactly one of contact_id / household_id is non-null (validateXor in app + DB CHECK)
```

**Indexes / uniqueness:** partial unique `(list_id, contact_id)` and `(list_id, household_id)` `WHERE deleted_at IS NULL`. Footgun NEW-D: do **not** PostgREST `onConflict` on partial uniques — pre-load ids (incl. soft-deleted), revive with `deleted_at: null`.
**App rules:** Christmas card list membership = households. Future email lists = contacts.

### `profiles` column

```sql
profiles.contact_cadence_days_default  INT   -- nullable; app constant if NULL (e.g. 90)
```

Per-user defaults on `profiles` until a separate table is justified ([000](decisions/000-invoicing-retro.md)).

### Nullable / required matrix

| Table | Required | Nullable |
|---|---|---|
| `households` | `name` | address fields, `notes`, `created_by` |
| `contacts` | `first_name`, `no_reminders` (default), `status` (default) | `last_name`, `household_id`, `email`, `phone`, `cadence_days`, `notes`, `created_by` |
| `contact_touches` | `contact_id`, `touched_on` | `note`, `created_by` |
| `contact_lists` | `name`, `sort_order` (default) | `notes`, `created_by` |
| `contact_list_members` | `list_id` + exactly one of `contact_id` / `household_id` | the other FK, `created_by` |

### RLS / triggers / registry

- **RLS all module tables:** SELECT `app_is_owner() OR app_has_module_read('contacts')`; INSERT/UPDATE/DELETE `app_is_owner()`.
- **Triggers:** `set_updated_at`, audit (`write_audit_log`) on every table. Soft-delete revertible for contacts/households/touches/lists/members in audit UI (Session 1).
- **`module_registry`:** slug `contacts`, label `Contacts`.
- **`user_permissions.module`** is free TEXT — add `contacts` to the permissions UI slug list ([090](decisions/090-sermons-session-0.md) surprise).
- **Audit-log UI:** add `_CONTACTS_TABLES` whitelist + module `<select>` option in `/settings/audit-log` (Session 1).
- **Backup dumps:** add contacts tables to weekly R2 dump inventory when Session 1 ships (ops note — not blocking).

---

## MCP read surface (fields locked; implementation in Session 2)

| Tool | Contract |
|---|---|
| `list_contacts_due` | Replaces stub in `scripts/ppp-mcp/` — **same name**. Returns active contacts with `no_reminders = false` whose last touch is null or older than effective cadence. Fields: display name, cadence_days (effective), last_touched_on, days_overdue, household name (if any). Optional param `limit` (default ~25). |
| `search_contacts` | Fuzzy name search (`first_name` / `last_name` / household name). Returns card: name, email, phone, household + address summary, cadence, last touch, status. |

`christmas_card_list` rejected for day one — card list is a UI / settings concern; chat can use `search_contacts` until a dedicated tool is justified.

---

## Open questions

| # | Entity | Q | Resolve by |
|---|---|---|---|
| H1 | household | Singles household-of-one UX — auto-create household named from contact on first address save, vs explicit "Create household" in Sheet? | ✅ Session 1 — address section on contact Sheet auto-creates; also explicit Household Sheet |
| H2 | household | Soft-delete household while members live — block (venues pattern) or null out `contacts.household_id`? | ✅ Session 1 — block while members live |
| C1 | contact | Keep nullable `birthday DATE` or strike before migration? | ✅ Session 1 — struck (not in schema) |
| C2 | contact | Do retired contacts' households stay on Christmas card list, or should list queries exclude households whose only members are retired? | ✅ Session 2 — exclude from effective roster; membership rows kept |
| T1 | touch | Backdating `touched_on` — detailed log only (recommended), or also one-tap? | ✅ Session 1 — detailed only |
| L1 | list | Seed `Christmas cards` in migration vs create-on-first-use? | ✅ Session 1 — seeded |
| T2 | touch | Do Christmas-card logs reset due-to-meet? | ✅ [181](decisions/181-contacts-smoke-product-locks.md) — **No**; touch `kind` meet vs card |
| C3 | cadence | Days vs months/years; list-driven vs person? | ✅ [181](decisions/181-contacts-smoke-product-locks.md) — months/years UI; **person**-owned |
| L2 | list | Settings-only lists vs third tab on `/contacts`? | ✅ [181](decisions/181-contacts-smoke-product-locks.md) — Lists third tab + card bulk log |

---

## Session arc

| Session | Status | Goal |
|---|---|---|
| 0 | ✅ 2026-07-24 | Phase 0 lock + this tracker + [175](decisions/175-contacts-session-0.md) |
| 1 | ✅ 2026-07-24 | Migration `ppp_contacts_v1` + `/contacts` CRUD + Log Contact + lists + nav/permissions/audit — [178](decisions/178-contacts-session-1.md) |
| 2 | ✅ 2026-07-24 | Dashboard "due to meet" + MCP `list_contacts_due` / `search_contacts`; C2 — [180](decisions/180-contacts-session-2.md) |
| 3 | ✅ 2026-07-25 | Lists tab + cadence months/years + touch kinds + Christmas-card bulk log — [182](decisions/182-contacts-session-3-lists-cadence-touch-kinds.md) |
| — | note | Decision number **174** was taken by a parallel library session ([174-everlasting-man-original-1925](decisions/174-everlasting-man-original-1925.md)) — Session 0 record is **[175](decisions/175-contacts-session-0.md)**, not 174. |
| — | backlog | Mailing-list send pipeline (Resend campaigns + unsubscribe) — designed-for, not built ([139](decisions/139-lightweight-crm-fall-priority.md)). |
| — | backlog | Optional FK contact → library person or invoicing client — only if owner asks. |
| — | backlog | Merge UI for marrying contacts into one household (beyond assigning `household_id`). |

**Timeline:** Sessions 1–3 before Thanksgiving so Christmas card list + due meets + card bulk log are live; mailing **email** send stays deferred.

---

## Owner smoke — Sessions 1–2 (do when you have time)

Parked from [178](decisions/178-contacts-session-1.md) + [180](decisions/180-contacts-session-2.md). Agent gates (`npm run check` / `test` / `mcp:smoke`) already green; this is **owner UI + MCP client** verification. Tick in place; when done, note the date here and in PLAN.md › Repo gate / Recent decisions as needed.

**Prereqs:** logged in as owner on prod (or preview); phone or ~390px viewport for mobile items; reload Cursor/`ppp` MCP after [180] so `search_contacts` appears.

### Session 1 — CRUD + Log Contact + lists ([178](decisions/178-contacts-session-1.md))

- [x] **Desktop nav** — Contacts in sidebar; opens `/contacts`
- [x] **Create contact** — Sheet save; appears under Active filter; search by name works
- [x] **Household** — create household (or contact Sheet mailing → household-of-one); assign contact; soft-delete blocked while members live
- [x] **One-tap Log Contact** — stamps Chicago today, null note; list shows last touch
- [x] **Detailed Log Contact** — note + optional backdate; household **Log all** fans out to live members
- [x] **`/settings/contacts/lists`** — Christmas cards list present; add a household member; remove member _(UI path OK; primary surface moves to Lists tab in Session 3 — [181](decisions/181-contacts-smoke-product-locks.md))_
- [x] **Audit log** — after a write, `/settings/audit-log?module=contacts` shows a row (trigger-driven)
- [x] **Mobile width (~390px)** — `/contacts` list + Sheets usable; no tab-bar collision on sticky actions

### Session 2 — dashboard due + MCP ([180](decisions/180-contacts-session-2.md))

- [x] **Seed at least one due contact** — active, `no_reminders` off, never touched (or last touch older than cadence) so dashboard/MCP aren’t empty
- [x] **Desktop `/dashboard`** — **Due to meet** card under Now (below Due soon); links to `/contacts`; overdue / “Never logged” labels sensible
- [x] **Mobile `/dashboard`** — Contacts glance tile (count + never-logged hint); opens `/contacts`
- [x] **After Log Contact** — due strip refreshes (`depends('app:contacts:list')`); contact drops off when still inside cadence
- [ ] **C2 (optional)** — put a household with only retired members on Christmas cards; settings roster hides it and shows “N retired-only … hidden”; un-retire restores without re-add
- [ ] **MCP client reload** — restart/`Reload` `ppp` MCP; tools include `list_contacts_due` + `search_contacts` (not stub)
- [ ] **MCP smoke (manual)** — `list_contacts_due` returns the seeded due row; `search_contacts` with a known name returns card fields (email/phone/household/address when set)

**Out of scope for this smoke:** mailing-list send; viewer write path (solo-waivered).

_Last smoked: 2026-07-25 (owner) — UI cleared; MCP still open_

# Personal Operations System — Finalized Schema v1

_Generated: April 2026 | Feeds schema session in Cursor (Week 5–6 environment setup)_

---

## Conventions

- All tables have `deleted_at TIMESTAMPTZ` (soft delete) unless noted
- All tables have `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- All tables have `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` maintained by trigger
- All tables have `created_by UUID REFERENCES profiles(id)` unless noted as system-managed
- `deleted_at IS NULL` filter applied by default in all RLS policies and application queries
- Audit log is trigger-driven on every table — invisible at the app layer
- `updated_at` trigger fires on every UPDATE; also recalculates derived fields where noted

---

## Core

### `profiles`

Mirrors `auth.users`. One row per user.

```sql
profiles
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
  email               TEXT NOT NULL
  full_name           TEXT
  role                TEXT NOT NULL CHECK (role IN ('owner', 'viewer')) DEFAULT 'owner'
  default_cc_emails   TEXT[] NOT NULL DEFAULT '{}'  -- pre-fill CC on invoice send
  deleted_at          TIMESTAMPTZ
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

**RLS:**

- Owner: full access
- Viewer: SELECT own row only (`WHERE id = auth.uid()`)
- No `created_by` — identity table, not user-created content

**Notes:** `default_cc_emails` is owner-managed (Supabase for August); surfaced read-only under Settings → Invoicing.

---

### `user_permissions`

Granular per-module access for viewer role. Owner bypasses this table entirely via RLS.

```sql
user_permissions
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  user_id         UUID NOT NULL REFERENCES profiles(id)
  module          TEXT NOT NULL   -- 'library' | 'invoicing' | 'projects' | 'calendar'
  access_level    TEXT NOT NULL CHECK (access_level IN ('none', 'read', 'write'))
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()

  UNIQUE (user_id, module)
```

**RLS:**

- Owner: full access
- Viewer: SELECT own rows only (`WHERE user_id = auth.uid()`)
- No INSERT/UPDATE from app layer for viewer — owner-managed only
- No `deleted_at` — system config, not user content
- No `created_by` — system-managed

**Notes:**

- August seed: one row per module per viewer with appropriate access_level
- Future multi-tenant: add `instance_id` column to scope permissions per tenant without refactoring

---

### `audit_log`

Trigger-driven. No app-layer writes.

```sql
audit_log
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  table_name      TEXT NOT NULL
  record_id       UUID NOT NULL
  operation       TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE'))
  old_data        JSONB
  new_data        JSONB
  changed_by      UUID REFERENCES profiles(id)
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  revertible      BOOLEAN NOT NULL DEFAULT false
```

**Indexes:** `(table_name)`, `(record_id)`, `(changed_by)`, `(changed_at DESC)`

**RLS:** Owner only. No viewer access. No `deleted_at`, `created_at`, `updated_at`, or `created_by` — append-only system table.

**Revertible = false for:**

- Cross-module FK operations
- Status transitions (e.g. invoice marked `sent`)
- Ancient text canonical merges

---

### `module_registry`

One row per module. Drives sidebar nav and dashboard tiles.

```sql
module_registry
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  slug            TEXT NOT NULL UNIQUE   -- 'invoicing' | 'library' | 'projects'
  label           TEXT NOT NULL          -- 'Invoicing' | 'Library' | 'Projects'
  icon            TEXT
  sort_order      INT NOT NULL DEFAULT 0
  is_active       BOOLEAN NOT NULL DEFAULT true
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

**RLS:** All authenticated users SELECT. No INSERT/UPDATE from app layer.
**Notes:** No `deleted_at` (use `is_active = false`), no `updated_at`, no `created_by` — app config, not user content.

---

## Invoicing

### `clients`

Seed data only for August — no CRUD UI.

```sql
clients
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
  name                TEXT NOT NULL
  email               TEXT[] NOT NULL DEFAULT '{}'  -- invoice To + extra recipients (PDF / send)
  billing_contact     TEXT
  address_line_1      TEXT
  address_line_2      TEXT
  deleted_at          TIMESTAMPTZ
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by          UUID REFERENCES profiles(id)
```

**RLS:** Owner only. Viewer: no access.
**Notes:** `default_rate` removed — superseded by `client_rates`. First element of `email` is the primary invoice recipient; additional elements are merged into CC when sending (unless the UI overrides To).

---

### `client_rates`

Effective-dated rates per client and optional service type.

```sql
client_rates
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  client_id       UUID NOT NULL REFERENCES clients(id)
  service_type    TEXT                   -- nullable; null = default rate for all work
  rate            NUMERIC(10,2) NOT NULL
  effective_from  DATE NOT NULL
  effective_to    DATE                   -- nullable = currently active
  deleted_at      TIMESTAMPTZ
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by      UUID REFERENCES profiles(id)
```

**RLS:** Owner only. Viewer: no access.
**Notes:**

- August seed: one row per client, `effective_from = project start date`, `effective_to = null`
- At time entry creation: app looks up active rate for client + service_type on that date and stamps onto `time_entries.rate`
- `service_type` free text for August; normalize to lookup table post-August if needed

---

### `time_entries`

```sql
time_entries
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  client_id       UUID NOT NULL REFERENCES clients(id)
  date            DATE NOT NULL
  hours           NUMERIC(5,2) NOT NULL
  rate            NUMERIC(10,2) NOT NULL   -- locked at entry time from client_rates
  description     TEXT
  billable        BOOLEAN NOT NULL DEFAULT true
  invoice_id      UUID REFERENCES invoices(id)   -- null = unbilled
  deleted_at      TIMESTAMPTZ
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by      UUID REFERENCES profiles(id)
```

**Indexes:** `(client_id, invoice_id)` — backs "unbilled entries by client" query

**RLS:** Owner only. Viewer: no access.

---

### `invoices`

```sql
invoices
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
  client_id           UUID NOT NULL REFERENCES clients(id)
  invoice_number      TEXT NOT NULL UNIQUE   -- INV-YYYY-NNNN via sequence function
  period_start        DATE NOT NULL
  period_end          DATE NOT NULL
  status              TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'paid')) DEFAULT 'draft'
  subtotal            NUMERIC(10,2)   -- stored at generation; not re-derived
  total               NUMERIC(10,2)   -- stored at generation; not re-derived
  notes               TEXT
  sent_at             TIMESTAMPTZ
  paid_at             TIMESTAMPTZ
  deleted_at          TIMESTAMPTZ
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by          UUID REFERENCES profiles(id)
```

**RLS:** Owner only. Viewer: no access.

**Invoice number generation:**

```sql
CREATE SEQUENCE invoice_number_seq;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
  SELECT 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::TEXT, 4, '0');
$$ LANGUAGE sql;
```

**Notes:**

- `subtotal`/`total` stored at generation time — keeps PDFs stable if rates change
- Status transitions (`sent`, `paid`) set `revertible = false` in audit log trigger

---

### `invoice_line_items`

```sql
invoice_line_items
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE
  description     TEXT NOT NULL
  quantity        NUMERIC(5,2)
  unit_price      NUMERIC(10,2)
  total           NUMERIC(10,2) NOT NULL   -- stored, not computed on read
  is_one_off      BOOLEAN NOT NULL DEFAULT false
  sort_order      INT NOT NULL DEFAULT 0
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by      UUID REFERENCES profiles(id)
```

**RLS:** Owner only. Viewer: no access.
**Notes:** No `deleted_at` — lifecycle tied to invoice. No `updated_at` — line items are replaced, not edited in place.

---

## Library

### `bible_books`

Seed data. Reference table for fixed Bible book list.

```sql
bible_books
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  name            TEXT NOT NULL UNIQUE   -- 'Romans', 'Philippians'
  testament       TEXT NOT NULL CHECK (testament IN ('OT', 'NT'))
  sort_order      INT NOT NULL
```

**RLS:** All authenticated users SELECT. No app-layer writes.
**Notes:** No `deleted_at`, `created_at`, `updated_at`, `created_by` — static reference data.

---

### `ancient_texts`

Canonical reference table for ancient non-biblical sources.

```sql
ancient_texts
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  canonical_name  TEXT NOT NULL UNIQUE   -- 'Josephus, Antiquities'
  abbreviations   TEXT[]                  -- '{Ant., J.W.}'
  category        TEXT                    -- 'Josephus' | 'Apostolic Fathers' | 'Apocrypha' | etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by      UUID REFERENCES profiles(id)
```

**RLS:** All authenticated users SELECT. Owner INSERT/UPDATE.
**Notes:**

- UI does fuzzy match against `canonical_name` and `abbreviations` on entry — prompts "Did you mean X?" before creating a new record
- Merging two canonical entries sets `revertible = false` in audit log — UI warns before proceeding
- Seed data covers common sources: Josephus (_Antiquities_, _Jewish War_), Philo, main Apostolic Fathers, Apocrypha books

---

### `people`

Authors, editors, translators.

```sql
people
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  first_name      TEXT
  last_name       TEXT NOT NULL
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by      UUID REFERENCES profiles(id)
```

**RLS:** All authenticated users SELECT. Owner/viewer(write) INSERT/UPDATE.

---

### `series`

```sql
series
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  name            TEXT NOT NULL
  abbreviation    TEXT   -- 'WBC', 'NICNT', 'OTL'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by      UUID REFERENCES profiles(id)
```

**RLS:** All authenticated users SELECT. Owner/viewer(write) INSERT/UPDATE. Managed in `/settings/library`.

---

### `categories`

Physical shelving categories. Seed data only.

```sql
categories
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  name            TEXT NOT NULL UNIQUE
  slug            TEXT NOT NULL UNIQUE
  sort_order      INT NOT NULL DEFAULT 0
```

**RLS:** All authenticated users SELECT. No app-layer writes.
**Notes:** Static seed data — 7 canonical shelving categories.

---

### `books`

```sql
books
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid()
  title                   TEXT NOT NULL
  subtitle                TEXT
  publisher               TEXT
  publisher_location      TEXT
  year                    INT
  edition                 TEXT             -- nullable; omit if first
  total_volumes           INT              -- nullable; for multi-volume sets
  original_year           INT              -- nullable; for reprints
  reprint_publisher       TEXT
  reprint_location        TEXT
  reprint_year            INT
  primary_category_id     UUID NOT NULL REFERENCES categories(id)
  series_id               UUID REFERENCES series(id)
  volume_number           TEXT             -- nullable; free text to handle 'IV', '2b', etc.
  genre                   TEXT NOT NULL    -- enum value from Genre List
  language                TEXT NOT NULL CHECK (language IN (
                            'english','greek','hebrew','latin','german','chinese','other'
                          )) DEFAULT 'english'
  isbn                    TEXT
  barcode                 TEXT
  shelving_location       TEXT
  reading_status          TEXT NOT NULL CHECK (reading_status IN (
                            'unread','in_progress','read','reference','n_a'
                          )) DEFAULT 'unread'
  borrowed_to             TEXT             -- nullable; populated = on loan
  personal_notes          TEXT
  rating                  INT CHECK (rating BETWEEN 1 AND 5)   -- nullable
  needs_review            BOOLEAN NOT NULL DEFAULT false
  deleted_at              TIMESTAMPTZ
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by              UUID REFERENCES profiles(id)
```

**RLS:** Owner: full access. Viewer: SELECT + INSERT + UPDATE (library write access). Viewer: no DELETE.

---

### `book_authors`

Junction: books ↔ people.

```sql
book_authors
  book_id         UUID NOT NULL REFERENCES books(id)
  person_id       UUID NOT NULL REFERENCES people(id)
  role            TEXT NOT NULL CHECK (role IN ('author', 'editor', 'translator'))
  sort_order      INT NOT NULL DEFAULT 0

  PRIMARY KEY (book_id, person_id, role)
```

---

### `book_categories`

Junction: books ↔ categories (many-to-many beyond primary).

```sql
book_categories
  book_id         UUID NOT NULL REFERENCES books(id)
  category_id     UUID NOT NULL REFERENCES categories(id)

  PRIMARY KEY (book_id, category_id)
```

---

### `book_bible_coverage`

Which Bible books a given book or essay primarily covers. Drives commentary/survey surfacing in scripture search.

```sql
book_bible_coverage
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  book_id         UUID REFERENCES books(id)
  essay_id        UUID REFERENCES essays(id)
  bible_book      TEXT NOT NULL REFERENCES bible_books(name)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by      UUID REFERENCES profiles(id)

  UNIQUE (book_id, bible_book)
  UNIQUE (essay_id, bible_book)
  CHECK (
    (book_id IS NOT NULL AND essay_id IS NULL) OR
    (book_id IS NULL AND essay_id IS NOT NULL)
  )
```

**RLS:** Owner/viewer(write): full access. Others: SELECT.

---

### `book_ancient_coverage`

Which ancient non-biblical texts a given book or essay engages.

```sql
book_ancient_coverage
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
  book_id             UUID REFERENCES books(id)
  essay_id            UUID REFERENCES essays(id)
  ancient_text_id     UUID NOT NULL REFERENCES ancient_texts(id)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by          UUID REFERENCES profiles(id)

  CHECK (
    (book_id IS NOT NULL AND essay_id IS NULL) OR
    (book_id IS NULL AND essay_id IS NOT NULL)
  )
```

**RLS:** Owner/viewer(write): full access. Others: SELECT.

---

### `essays`

Chapters or signed entries in edited volumes.

```sql
essays
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
  essay_title         TEXT NOT NULL
  parent_book_id      UUID NOT NULL REFERENCES books(id)
  page_start          INT
  page_end            INT
  deleted_at          TIMESTAMPTZ
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by          UUID REFERENCES profiles(id)
```

**Notes:** Schema Day 1; no entry UI for August.

---

### `essay_authors`

Junction: essays ↔ people.

```sql
essay_authors
  essay_id        UUID NOT NULL REFERENCES essays(id)
  person_id       UUID NOT NULL REFERENCES people(id)
  role            TEXT NOT NULL CHECK (role IN ('author'))
  sort_order      INT NOT NULL DEFAULT 0

  PRIMARY KEY (essay_id, person_id)
```

---

### `scripture_references`

Verse-level and range-level references with page locations. Core research index.

```sql
scripture_references
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
  book_id             UUID REFERENCES books(id)
  essay_id            UUID REFERENCES essays(id)
  bible_book          TEXT NOT NULL REFERENCES bible_books(name)
  chapter_start       INT              -- nullable = whole-book reference
  verse_start         INT              -- nullable = chapter-level reference
  chapter_end         INT
  verse_end           INT
  verse_start_abs     INT              -- computed: (chapter_start * 1000) + verse_start; 0 if null
  verse_end_abs       INT              -- computed: (chapter_end * 1000) + verse_end; 999999 if null
  page_start          TEXT NOT NULL    -- stored as text: '317', 'IV.317', 'xiv'
  page_end            TEXT             -- nullable
  confidence_score    NUMERIC(3,2)     -- 0.00–1.00; null if manually entered
  needs_review        BOOLEAN NOT NULL DEFAULT false
  review_note         TEXT             -- system or user note explaining flag
  source_image_url    TEXT             -- storage bucket path; retained for reference
  deleted_at          TIMESTAMPTZ
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by          UUID REFERENCES profiles(id)

  CHECK (
    (book_id IS NOT NULL AND essay_id IS NULL) OR
    (book_id IS NULL AND essay_id IS NOT NULL)
  )
```

**Indexes:** `(bible_book, verse_start_abs, verse_end_abs)` — backs overlap search

**Trigger — abs value computation:** Fires on INSERT and UPDATE of any chapter/verse field. Recomputes `verse_start_abs` and `verse_end_abs`. When `needs_review` is set to false (reviewed), trigger also stamps `updated_at` and records the change in audit log.

**Overlap query pattern:**

```sql
-- Overlapping search (default): Philippians 2:1–11
WHERE bible_book = 'Philippians'
  AND verse_start_abs <= 2011
  AND verse_end_abs >= 2001

-- Exact match mode (opt-in):
WHERE bible_book = 'Philippians'
  AND verse_start_abs = 2001
  AND verse_end_abs = 2011
```

**RLS:** Owner: full access. Viewer: SELECT + INSERT + UPDATE (library write).

---

### `book_topics`

Topical index with page locations.

```sql
book_topics
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
  book_id             UUID REFERENCES books(id)
  essay_id            UUID REFERENCES essays(id)
  topic               TEXT NOT NULL CHECK (topic = lower(trim(topic)))
  page_start          TEXT NOT NULL
  page_end            TEXT
  confidence_score    NUMERIC(3,2)
  needs_review        BOOLEAN NOT NULL DEFAULT false
  review_note         TEXT
  source_image_url    TEXT
  deleted_at          TIMESTAMPTZ
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by          UUID REFERENCES profiles(id)

  CHECK (
    (book_id IS NOT NULL AND essay_id IS NULL) OR
    (book_id IS NULL AND essay_id IS NOT NULL)
  )
```

**RLS:** Owner: full access. Viewer: SELECT + INSERT + UPDATE (library write).

**Notes:**

- Topic autocomplete in UI suggests existing topics as user types — prevents fragmentation before synonym layer
- `topic_synonyms` table deferred post-August (see Post-August section)

---

## Post-August Items (Tracked Here for Schema Continuity)

| Item                                | Notes                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `topic_synonyms` table              | `canonical_topic TEXT`, `synonym TEXT` — expand topic search at query time without changing `book_topics` |
| `service_type` normalization        | Normalize `client_rates.service_type` to a lookup table when needed                                       |
| Multi-tenant `instance_id`          | Add to `user_permissions` to scope per-tenant without refactoring                                         |
| Essay pagination                    | Revisit if reprinted essays ever need independent page sequences                                          |
| `user_permissions` complexity       | Expand access model when second friend is added (fall 2026)                                               |
| Ancient text `abbreviations` search | UI fuzzy match; no schema change needed                                                                   |
| AI topic synonym suggestions        | Expand `topic_synonyms` via AI; data accumulates in `book_topics` in the meantime                         |

---

## RLS Summary

| Table                   | Owner  | Viewer                   |
| ----------------------- | ------ | ------------------------ |
| `profiles`              | Full   | SELECT own row           |
| `user_permissions`      | Full   | SELECT own rows          |
| `audit_log`             | Full   | No access                |
| `module_registry`       | SELECT | SELECT                   |
| `clients`               | Full   | No access                |
| `client_rates`          | Full   | No access                |
| `time_entries`          | Full   | No access                |
| `invoices`              | Full   | No access                |
| `invoice_line_items`    | Full   | No access                |
| `bible_books`           | SELECT | SELECT                   |
| `ancient_texts`         | Full   | SELECT                   |
| `people`                | Full   | Full                     |
| `series`                | Full   | Full                     |
| `categories`            | SELECT | SELECT                   |
| `books`                 | Full   | SELECT + INSERT + UPDATE |
| `book_authors`          | Full   | Full                     |
| `book_categories`       | Full   | Full                     |
| `book_bible_coverage`   | Full   | Full                     |
| `book_ancient_coverage` | Full   | Full                     |
| `essays`                | Full   | SELECT                   |
| `essay_authors`         | Full   | SELECT                   |
| `scripture_references`  | Full   | SELECT + INSERT + UPDATE |
| `book_topics`           | Full   | SELECT + INSERT + UPDATE |

---

## Trigger Summary

| Trigger                | Tables                       | Purpose                                                                                     |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| `set_updated_at`       | All tables with `updated_at` | Maintain updated_at on every UPDATE                                                         |
| `compute_verse_abs`    | `scripture_references`       | Recompute `verse_start_abs`/`verse_end_abs` on INSERT or UPDATE of any chapter/verse field  |
| `audit_log_trigger`    | All tables                   | Write to `audit_log` on INSERT/UPDATE/DELETE; set `revertible` based on operation and table |
| `set_revertible_false` | `invoices`                   | Set `revertible = false` when status transitions to `sent` or `paid`                        |

**Deploy note:** `set_revertible_false` must **not** be attached to tables without a `status` column (e.g. `time_entries`), or Postgres will error with `record "new" has no field "status"`. The baseline migration ([`supabase/migrations/00000000000000_baseline.sql`](../supabase/migrations/00000000000000_baseline.sql)) is the canonical DDL source and already contains the correct trigger scoping. Diagnostic queries: [`sql/inspect_status_triggers.sql`](../sql/inspect_status_triggers.sql). See [`supabase/README.md`](../supabase/README.md).

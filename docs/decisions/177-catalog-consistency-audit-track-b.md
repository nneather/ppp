# 177 — Catalog consistency audit (post Track B remints)

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc — census + owner-approved DML

## Built
- Hosted SQL census over **1427** owned live books against Track B / remint rules ([142][160][163][166][171][172][174]).
- Prioritized fix queues P0–P4; Footnote/Bib drafts for each P0/P1 via local Turabian formatters.
- Owner MC **Q1A Q2A Q3A Q4A Q5A Q6A Q7I Q8A** → migration `20260725040000_library_catalog_consistency_177.sql` applied hosted.
- Spot-check (MCP `get_book_citation` after push): Alter vol 1 + ABD vol 1 cite correctly; TWOT vol 1 imprint + `1:100` OK (registry name **Moody Publishers**).

## Decided
- Applied as approved — see Open questions (answers recorded).
- Commentary-without-series (16 rows) left alone — true standalones.
- Q7I: all nine `original_year`-only rows stay inventory (no `reprint_*` promotion).
- USA / `United States` publisher locations: **0** owned rows ([115] clean).
- Vermes given name corrected **Gaza → Geza** while adding author credit (kept translator).

## Schema changes
- DML-only: `20260725040000_library_catalog_consistency_177.sql` — no type regen.

## Census snapshot (owned, `deleted_at IS NULL`)

| Bucket | Count | Notes |
|---|---|---|
| Owned live | 1427 | |
| `volume_number` set, no series, `total_volumes`≤1/null | 3 | All Norton Alter Hebrew Bible |
| Self-named title=series still `include_in_citation=true` | ABD 6 + TWOT 2 (+ related) | TDNT/HALAT/LSJ already false |
| `original_year` only (no `reprint_*`) | 9 | 1 full reprint (Everlasting Man [174]) |
| Commentary, no `series_id` | 16 | Standalones — not queued |
| Genre Bibles + volume | 3 | Alter — wrong dispatch |
| Publisher location contains USA | 0 | |

## Queues

### P0 — wrong citation if opened today

| title | id (prefix) | series | vol | total_vol | work_type | imprint / orig | why_suspect | suggested_fix |
|---|---|---|---|---|---|---|---|---|
| *The Hebrew Bible* (Alter) ×3 | `e61c137d…` / `43914f5b…` / `36840b3e…` | — | 1–3 | null | monograph | Norton 2019; loc null; **genre=Bibles** | `resolveCitationSourceType` → `bible` → FN `42 (English Standard Version).` | genre → **Old Testament** (or Gospels/OT family — ask); `total_volumes=3`; `publisher_location='New York'` |
| *The Anchor Bible Dictionary* ×6 | `96027142…` … `7ead2a71…` | ABD | 1–6 | null | reference_work | **all null** year/pub/loc | `include_in_citation=true` doubles series (`ABD 1` + vol); missing imprint; inconsistent with TDNT [160] | series `include_in_citation=false`; `total_volumes=6`; imprint **Doubleday / New York / 1992** (confirm) |
| TWOT ×2 | `1aa2e6f8…` / `a027e4e5…` | TWOT | 1–2 | null | reference_work | **all null** | same self-name double as ABD | series `include_in_citation=false`; `total_volumes=2`; imprint **Moody Press / Chicago / 1980** (confirm) |

### P0/P1 cite drafts (local formatters — current vs corrected)

**Alter vol 1**
- Current FN: `42 (English Standard Version).` · Bib: *(empty)*
- Corrected FN: `Robert Alter, The Hebrew Bible: A Translation with Commentary (New York: W. W. Norton, 2019), 1:42.`
- Corrected Bib: `Alter, Robert. The Hebrew Bible: A Translation with Commentary. Vol. 1. New York: W. W. Norton, 2019.`
- Cite set: `Alter, Robert. The Hebrew Bible. 3 vols. New York: W. W. Norton, 2019.`

**ABD vol 1 @ p.835**
- Current FN: `David Noel Freedman, ed., The Anchor Bible Dictionary, ABD 1, 835.` · Bib: `… Anchor Bible Dictionary 1.` (no imprint)
- Corrected FN: `David Noel Freedman, ed., The Anchor Bible Dictionary (New York: Doubleday, 1992), 1:835.`
- Corrected Bib: `Freedman, David Noel, ed. The Anchor Bible Dictionary. Vol. 1. New York: Doubleday, 1992.`
- Cite set: `… 6 vols. New York: Doubleday, 1992.`
- Essay path unchanged: still uses `series_abbreviation=ABD` for `in ABD, 1:835.`

**TWOT vol 1 @ p.100**
- Current FN: `… Theological Wordbook of the Old Testament, TWOT 1, 100.` · Bib doubles series name
- Corrected FN: `R. Laird Harris, Gleason L. Archer, and Bruce K. Waltke, eds., Theological Wordbook of the Old Testament (Chicago: Moody Press, 1980), 1:100.`
- Corrected Bib / set: Vol. 1 / `2 vols.` with Moody imprint

**TDNT control (already good after [160])**
- FN: `Gerhard Kittel, ed., Theological Dictionary of the New Testament (Grand Rapids, MI: Eerdmans, 1964), 1:100.`

### P1 — reference / lexicon abbr for s.v. or abbreviated article cites

| title | id | series | why_suspect | suggested_fix |
|---|---|---|---|---|
| BDAG | `1e7a3065…` | BDAG, `include_in_citation=true` | Local formatters already short-circuit to `BDAG, s.v. "[lemma],"` ([163]); flag still inconsistent with LSJ/HALAT | Prefer `include_in_citation=false` (hygiene; no cite change if s.v. path live) |
| BDB (*Brown Driver-Briggs…*) | `6d98701d…` | **none** | No `series_abbreviation` → long-form author cite, not `BDB, s.v.` | Create series **BDB** (`include_in_citation=false`) + attach; or set book `citation_abbreviation='BDB'` + carrier series |
| IVP Black Dictionaries (DJG/DPL/DOTHB/DOTWPW) | (4 ids) | IVP Bible Dictionary Series, **abbr null**, include true | Notes use per-book `citation_abbreviation` ([125]) ✅; volume bib still emits full series name | Ask: set series `include_in_citation=false` so volume cites omit branding (essays keep DJG/… via effective abbr)? |
| Abridged Liddell & Scott | `637a57cb…` | none | Not in UNSIGNED set; OK as long-form unless Parker wants abbr | Leave unless writing needs `LS` / similar |

**BDB cite draft**
- Current FN: long-form author + title (no s.v.)
- Corrected FN: `BDB, s.v. "[lemma]," 100.` · Bib: *(empty)*

**BDAG cite draft (repo formatters)**
- Current & after include=false: `BDAG, s.v. "[lemma]," 100.` · Bib empty  
- Note: Cursor `user-ppp` MCP `get_book_citation` still returned Bauer long-form — **MCP process likely stale**; reload MCP after pull. Repo unit path matches [163].

### P2 — commentary without series

16 owned rows; none with an obvious missing WBC/NICNT/etc. assignment (Luther Galatians, Hodge 1 Cor, Barth Römerbrief, Pink, Boice, Bruce John, Spurgeon Treasury duplicates, etc.). **No auto-fix queue.** Optional later: dedupe three *Treasury of David* rows.

### P3 — `original_year` only (inventory vs full reprint)

| title | id | original_year | shelf year/pub | ask |
|---|---|---|---|---|
| Acts (TNTC) | `ffa62af1…` | 1980 | 2008 IVP Academic | Keep inventory ([168]-style) vs promote reprint_*? |
| Nachfolge | `f06ea498…` | 1937 | 2016 Brunnen | Already intentional inventory ([167]) |
| Synopsis of a Purer Theology ×3 | `a06e57d1…` / `3d5bbdaa…` / `62ecc732…` | 1625 | Brill 2014/16/20 | Inventory OK (modern crit. ed.)? |
| Cost of Discipleship | `1a886166…` | 1937 | 1995 Scribner | Inventory ([168]); contrast Everlasting Man full reprint ([174]) |
| Lightfoot Galatians | `f8202551…` | 1865 | 1974 Zondervan | Inventory vs reprint_*? |
| Murray Romans (NICNT) | `5ab0d860…` | 1959 | 1968 Eerdmans | Inventory vs reprint_*? |
| Bultmann Johannine Epistles (Hermeneia) | `848e075b…` | 1967 | 1973 Fortress / Philadelphia | Inventory vs reprint_*? |

Only **Everlasting Man** is full `reprint_*` today ([174]).

### P4 — authorless / credit outliers (non-encyclopedia)

| title | id | credits | note |
|---|---|---|---|
| *The complete Dead Sea scrolls in English* | `bdab4316…` | translator:Vermes only | Consider author/editor Vermes for monograph cites |
| *ESV Exhaustive Concordance* | `f2e9ae65…` | none | Often unsigned; OK or add Crossway ed. |
| *Football Book of Wisdom* | `78c866ad…` | none | Non-scholarly; low priority |
| Bibles without credits | NASB thinline, Urbana 18 | none | Expected for `genre=Bibles` |

### Deferred smells (not blocking fall writing)

- Brockhaus Enzyklopädie (27) / Wörterbuch (3): series BH `include_in_citation=true`, no `total_volumes` — encyclopedia set hygiene later.
- COQG / OTP / TWC: `volume_number` + series → series enumeration after [172] (OK for distinct titles); optional `include_in_citation=false` if series segment feels noisy.
- City-only locations (Chicago, Oxford, Leiden, New York, …) — valid Turabian; no USA leftover.
- Hermeneia abbr = `Hermeneia` ✅ ([171]).

## Open questions surfaced (answered 2026-07-24)

| Q | Choice | Applied |
|---|---|---|
| Q1 Alter | **A** | genre Old Testament, tv=3, New York |
| Q2 ABD | **A** | include=false, tv=6, Doubleday/NY/1992 |
| Q3 TWOT | **A** | include=false, tv=2, Chicago/1980 (linked Moody Publishers registry → cite shows that name) |
| Q4 BDAG | **A** | include=false |
| Q5 BDB | **A** | series BDB created + attached (`f34ab226-…`) |
| Q6 IVP dict series | **A** | include=false |
| Q7 original_year | **I** (all) | no reprint_* writes |
| Q8 Vermes | **A** | author + translator; first_name Gaza→Geza |

## Surprises
- Alter’s `genre=Bibles` was catastrophic for Copy Footnote (scripture template, not book) — fixed.
- TWOT free-text `Moody Press` loses to registry canonical **Moody Publishers** in loaders — fine for cites.
- Cursor `user-ppp` MCP may still omit BDAG/BDB `s.v.` until process reload ([163] is in repo; data/series abbr now present).

## New components / patterns added
- None

## Carry-forward updates
- [x] Decision doc filed + DML applied
- [x] PLAN.md refreshed (apply prompt removed)
- [x] Migration pushed hosted
- [ ] components.mdc / AGENTS — N/A (DML only)
- [ ] Reload ppp MCP when convenient (BDAG/BDB s.v. smoke)

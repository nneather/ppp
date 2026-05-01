# Library Migration Notes
_Generated: April 2026 | Covers: CMT (154), BBL (26), REF (13), ABD (6), TDNT (10), TWOT (2), LGK (12), LHB (11), Brockhaus (31) — 265 books total_

---

## Global Rules (Apply on Import)

- **Status case:** Normalize all "In progress" → "In Progress"
- **Edition field:** Any "Second Edition", "Revised Edition", "2nd ed.", "3rd ed.", "4. Auflage", etc. in title → extract to `edition` field, remove from title
- **Notes with "deRoos, Rob":** These are received-from notes, not loans. `borrowed_to` = null; personal_notes = "Received from Rob deRoos."
- **Volumes in title:** Where title contains "Vol. I", "Volume 1", etc. → extract to `volume_number` field, remove from title
- **Publisher-as-author (Bibles):** Retain publisher in author field for BBL entries — Turabian cites by translation abbreviation anyway; enrichment pass handles publisher/year/edition properly
- **Multi-contributor volumes:** Apply ESVEC pattern — editors in `book_authors` (role=editor), contributors in `personal_notes`, `needs_review = false`

---

## New Series Records Needed

| Abbreviation | Full Name | Notes |
|---|---|---|
| ICC | International Critical Commentary | For Burton's Galatians (#16) |
| NTC | New Testament Commentary | For Hendriksen's Galatians and Ephesians (#69) |
| OTL | Old Testament Library | For Von Rad's Genesis (#139) |
| EKK | Evangelisch-katholischer Kommentar zum Neuen Testament | For Schrage's Korinther (#124) |
| TWOT | Theological Wordbook of the Old Testament | 2-vol set, Harris/Archer/Waltke |
| AB | Anchor Bible | For Boling's Judges (#11), Myers's Ezra Nehemiah (#114) |
| MH | Matthew Henry's Commentary | Already in xlsx — confirm series record exists |

---

## CMT — Commentaries (154 books)

### Author Corrections
| # | Original | Corrected |
|---|---|---|
| 7 | Wray Beal, Lissa M. | Last name: "Wray Beal" (compound), first: "Lissa M." |
| 48 | Edwards James R. | Edwards, James R. (missing comma) |
| 52 | F. F. Bruce | Bruce, F. F. (format correction) |
| 67 | Hawthorne, Gerald F Hawthorne | Hawthorne, Gerald F. (duplicated last name) |
| 69 | Hendricksen, William | Hendriksen, William (spelling — no 'c') |
| 86 | Keener, Craig | Author replaced: Walton, John H. and Victor H. Matthews and Mark W. Chavalas (OT volume is Walton/Matthews/Chavalas; Keener is NT) |
| 113 | Murchpy, Roland | Murphy, Roland E. |
| 121 | Sards, Marion L. | Soards, Marion L. |
| 147 | Williams David J. | Williams, David J. (missing comma) |
| 152 | Wright, Cristopher J. H. | Wright, Christopher J. H. (typo) |

### Title Corrections
| # | Original | Corrected |
|---|---|---|
| 20 | Commentary on harmony of Matthey, Mark, Luke; John 1-11 | Commentary on a Harmony of Matthew, Mark, Luke; John 1-11 |
| 21 | Commentaties on the Harmony of Exodus, Leviticus, Numbers and Deuteronomy | Harmony of Exodus, Leviticus, Numbers and Deuteronomy (typo + duplicate — see below) |
| 42 | Genesis 1-4: A linguistic, Literary, and Theological Commentary | Genesis 1-4: A Linguistic, Literary, and Theological Commentary |
| 54 | The Frist Epistle to the Corinthians | The First Epistle to the Corinthians |
| 104 | Commentary on the Epistle to the Galations | Commentary on the Epistle to the Galatians |
| 115 | Ephesians, Collosians, Philemon | Ephesians, Colossians, Philemon |
| 139 | Genesis: Revised Edition | Genesis (edition → "Revised") |

### Status Corrections
| # | Title | Change |
|---|---|---|
| 2 | The Prophecies of Isaiah (Alexander) | Unread → Reference |
| 116 | Gleanings from Elisha (Pink) | Unread → Reference |
| 117 | Gleanings in Genesis (Pink) | Unread → Reference |

### Edition Moves (title → edition field)
| # | Edition Text |
|---|---|
| 3 | "Second Edition" |
| 4 | "Second Edition" |
| 52 | "Revised Edition" |
| 54 | "Revised Edition" |
| 57 | "2nd ed" |
| 82 | "Second Edition" |
| 110 | "2nd ed" |
| 139 | "Revised Edition" |

### Multi-Author Splits
| # | Author Field | Split Into |
|---|---|---|
| 10 | Boda, Mark J. and Mary L. Conway | Boda, Mark J. + Conway, Mary L. (both author) |
| 87–96 | Keil and Delitzsch | Keil, Carl Friedrich + Delitzsch, Franz (both author, all 10 COT vols) |
| 113 | Murphy, Roland and Elizabeth Huwiler | Murphy, Roland E. + Huwiler, Elizabeth (both author) |

### New Series Assignments
| # | Book | Series |
|---|---|---|
| 16 | Burton — Galatians | ICC |
| 69 | Hendriksen — Galatians and Ephesians | NTC |
| 124 | Schrage — Der erste Brief an die Korinther | EKK, vol 3 |
| 139 | Von Rad — Genesis | OTL |

### Volume Numbers to Assign

**Keil & Delitzsch — Commentary on the Old Testament (COT), 10 vols:**
| Vol | Book | Title |
|---|---|---|
| 1 | #94 | Pentateuch |
| 2 | #92 | Joshua, Judges, Ruth, 1 & 2 Samuel |
| 3 | #87 | 1 & 2 Kings, 1 & 2 Chronicles |
| 4 | #89 | Ezra, Nehemiah, Esther, Job |
| 5 | #96 | Psalms |
| 6 | #95 | Proverbs, Ecclesiastes, Song of Songs |
| 7 | #90 | Isaiah |
| 8 | #91 | Jeremiah, Lamentations |
| 9 | #88 | Ezekiel, Daniel |
| 10 | #93 | Minor Prophets |

**Matthew Henry Commentary (MH), 6 vols:**
| Vol | Book | Title |
|---|---|---|
| 1 | #71 | Genesis to Deuteronomy |
| 2 | #74 | Joshua to Esther |
| 3 | #73 | Job to Song of Solomon |
| 4 | #72 | Isaiah to Malachi |
| 5 | #75 | Matthew to John |
| 6 | #70 | Acts to Revelation |

**Calvin's Commentaries — Baker/CC 1993, 22-vol set (CC series):**
- See deferred shelf-check for vols 2 & 3 (Exodus/Leviticus/Numbers/Deuteronomy)

### Standalone Commentaries (No Series)
| # | Author | Title | Notes |
|---|---|---|---|
| 2 | Alexander, J. A. | The Prophecies of Isaiah | No series — correct |
| 5 | Barth, Karl | Der Römerbrief 1922 | German; reprint: Theologischer Verlag Zürich, 2008 |
| 42 | Collins, C. John | Genesis 1-4 | Standalone, P&R 2006 |
| 60 | Guelich, Robert A. | The Sermon on the Mount | Standalone |
| 78 | Hodge, Charles | Commentary on the First Epistle to the Corinthians | See deferred shelf-check |
| 104 | Luther, Martin | Commentary on the Epistle to the Galatians | Standalone |
| 116 | Pink, Arthur W. | Gleanings from Elisha | Standalone |
| 117 | Pink, Arthur W. | Gleanings in Genesis | Standalone |

### Multi-Contributor Volumes (ESVEC Pattern)
| # | Title | Series | Editors |
|---|---|---|---|
| 47 | Genesis - Numbers | ESVEC, vol 1 | Duguid, Iain M. (ed); Hamilton, James M. Jr. (ed); Sklar, Jay (ed); personal_notes: "Contributors: Duguid (Genesis), Sklar (Leviticus), T. Desmond Alexander (Exodus), L. Michael Morales (Numbers)" |
| 85 | The New Interpreter's Bible, Volume X | NIB, vol 10 | Keck, Leander E. (ed); personal_notes: "Contributors: M. Eugene Boring (Acts), Robert Wall (Epistolary Literature intro), N. T. Wright (Romans), J. Paul Sampley (1 Corinthians)" |

### Duplicates to Delete
| Delete | Keep | Reason |
|---|---|---|
| #16 Bruce, F. F. — The Book of Acts (original NICNT) | #52 Bruce, F. F. — The Book of Acts (Revised Edition) | Merged to single Revised Edition entry |

### Subject Reclassifications
- All CMT books remain CMT (no change needed)

---

## BBL — Bibles (26 books)

### Multi-Author Splits
| # | Original | Split Into |
|---|---|---|
| 6 | Berlin, Adele, and Mark Zvi Brettler | Berlin, Adele (ed) + Brettler, Mark Zvi (ed) |
| 11 | Elliger, K., and Rudolph W. | Elliger, K. (ed) + Rudolph, W. (ed) — note name format corrected |
| 12 | Goodrich, Richard J., Albert L. Lukaszewski, A. Philip Brown II, and Bryan W. Smith | All four as editors |
| 23 | Weber & Gryson | Weber, Robert (ed) + Gryson, Roger (ed) |
| 24 | Westcott & Hort | Westcott, Brooke Foss (ed) + Hort, Fenton John Anthony (ed) |

### Title & Edition Corrections
| # | Original | Corrected | Edition Field |
|---|---|---|---|
| 1 | Synopsis Quatuor Evangeliorum: 4. Auflage | Synopsis Quatuor Evangeliorum | "4th" |
| 2 | Synopsis of the Four Gospels: Seventh Edition | Synopsis of the Four Gospels | "Seventh" |
| 8 | Die Heilige Shrift | Die Heilige Schrift | — |
| 18 | Urbana 18 Bible (x 13) | Urbana 18 Bible | personal_notes: "13 copies" |

### Multi-Volume (No Series)
| # | Work | volume_number |
|---|---|---|
| 3 | Alter — Hebrew Bible, The Vol I | 1 |
| 4 | Alter — Hebrew Bible, The Vol II | 2 |
| 5 | Alter — Hebrew Bible, The Vol III | 3 |

Title standardized to: *The Hebrew Bible: A Translation with Commentary*

### Language Assignments
| # | Book | Language |
|---|---|---|
| 5 | Barth — Der Römerbrief 1922 | german |
| 6 | Bayer — Das Evangelium des Markus | german |
| Various | Brockhaus Bibles, German editions | german |

---

## REF — Single-Volume Theological Reference (13 books)

### Subject Reclassification
All 13 books move from no subject or BRF → **BRF** on import.

### Multi-Author Splits
| # | Original | Split Into |
|---|---|---|
| 1 | Davidson, Francis, Alan M. Stibbs, and Ernest F. Kevan | All three as editors |
| 4 | Arnold, Bill T., and H. G. M. Williamson | Both as editors |
| 6 | Cross, F. L. and E. A. Livingstone | Both as editors |
| 7 | Davie et al. (5 editors) | All five as editors — "Homes" → "Holmes" (Stephen R.) |
| 9 | Green, Joel B., Scot McKnight, I. Howard Marshall | All three as editors — "Masrshall" → "Marshall" |
| 11 | Longman, Tremper III and Peter Enns | Both as editors |
| 12 | McKnight, Scot, Lynn H. Cohick, Nijay K. Gupta | All three as editors — "Cohik" → "Cohick" |

### Title Corrections
| # | Original | Corrected | Edition Field |
|---|---|---|---|
| 3 | Dictionary of Latin and Greek Theological Terms: Drawn Principally from Protestant Scholastic Theology | Title: *Dictionary of Latin and Greek Theological Terms*; Subtitle: *Drawn Principally from Protestant Scholastic Theology* | — |
| 6 | The Oxford Dictionary of the Christian Church: Third Edition | The Oxford Dictionary of the Christian Church | "Third" |
| 10 | Pocket Dictionary of Theological Terms (The IVP Pocket Reference Series) | Pocket Dictionary of Theological Terms | — |
| 12 | Dictionary of Paul and His Letters: Second Edition | Dictionary of Paul and His Letters | "Second" |

### Author Additions
| # | Book | Add |
|---|---|---|
| 10 | Grenz — Pocket Dictionary of Theological Terms | Add: Guretzki, David (author) + Nordling, Cherith Fee (author) |
| 13 | Treier — Evangelical Dictionary of Theology | Treier, Daniel J. (editor); edition = "3rd" (2017 edition) |

### Roles
- #3 Muller — *Dictionary of Latin and Greek Theological Terms*: role = author (not editor — single-author work)
- #5 Brauer — *Westminster Dictionary of Church History*: role = editor (multi-contributor)
- All other REF entries: role = editor

### Potential Duplicate (Deferred to Shelf Check)
- #2 Douglas — *The New Bible Dictionary, Second Edition* vs. #8 Douglas et al. — *The New Bible Dictionary*
- You own both 1st and 2nd editions. #2 = 2nd ed (confirmed). #8 = see shelf-check to confirm which edition.

---

## ABD — Anchor Bible Dictionary (6 volumes)

### Standardization
- **Title (all vols):** *The Anchor Bible Dictionary*
- **Series:** ABD (already assigned)
- **Editor (all vols):** Freedman, David Noel (role=editor)
- **Volume numbers:** 1 (A-C), 2 (D-G), 3 (H-J), 4 (K-N), 5 (O-Sh), 6 (Si-Z)
- **personal_notes (all vols):** "Multi-contributor reference work. Contains approximately 6,000 signed articles by ~800 biblical scholars and archaeologists."
- **Subject (all vols):** BRF (currently no subject — reclassify on import)
- **Language:** english
- **needs_review:** false

---

## TDNT — Theological Dictionary of the New Testament (10 volumes)

### Standardization
- **Title (all vols):** *Theological Dictionary of the New Testament*
- **Series:** TDNT (already assigned)
- **Volume numbers:**

| Vol | Editor | Letter Range |
|---|---|---|
| 1 | Kittel, Gerhard (ed) | Α-Γ |
| 2 | Kittel, Gerhard (ed) | Δ-Η |
| 3 | Kittel, Gerhard (ed) | Θ-Κ |
| 4 | Kittel, Gerhard (ed) | Λ-Ν |
| 5 | Friedrich, Gerhard (ed) | Ξ-Πα |
| 6 | Friedrich, Gerhard (ed) | Πε-Ρ |
| 7 | Friedrich, Gerhard (ed) | Σ |
| 8 | Friedrich, Gerhard (ed) | Τ-Υ |
| 9 | Friedrich, Gerhard (ed) | Φ-Ω |
| 10 | Friedrich, Gerhard (ed) | Register |

- **personal_notes (all vols):** "Multi-contributor theological dictionary. Translated from German by Geoffrey W. Bromiley. Contains ~400 Greek word studies by ~100 contributors." [Note: Translator field needed — see Post-Build Optimization doc]
- **Subject (all vols):** BRF (currently no subject — reclassify on import)
- **Language:** english (translation)
- **needs_review:** false

---

## TWOT — Theological Wordbook of the Old Testament (2 volumes)

### Standardization
- **Title (both vols):** *Theological Wordbook of the Old Testament*
- **Series:** TWOT (new series — create on import)
- **Volume numbers:** 1, 2
- **Multi-author split:** Harris, R. Laird (ed) + Archer, Gleason L., Jr. (ed) + Waltke, Bruce K. (ed) — all three on both volumes
- **personal_notes (both vols):** "Multi-contributor Hebrew wordbook. Contains ~1,400 Old Testament Hebrew word studies."
- **Subject (both vols):** BRF (currently LHB — reclassify on import)
- **needs_review:** false

---

## LGK — Greek Language Tools (12 books)

### Multi-Author Split
| # | Original | Split Into |
|---|---|---|
| 4 | Köstenberger, Merkle, Plummer | All three as authors |

### Title Corrections
| # | Original | Corrected | Edition Field |
|---|---|---|---|
| 3 | Pocket Dictionary for the Study of NT Greek (The IVP Pocket Reference Seriew) | Pocket Dictionary for the Study of New Testament Greek | — |
| 4 | Going Deeper with NT Greek, Revised Edition: An Intermediate Study... | Going Deeper with New Testament Greek: An Intermediate Study of the Grammar and Syntax of the New Testament | "Revised" |
| 6 | Beginning greek: A Functional Approach | Beginning Greek: A Functional Approach | — |
| 9 | Complete Vocabulary Guide to the Greek New Tetsament | Complete Vocabulary Guide to the Greek New Testament | — |

### Status Corrections
| # | Change |
|---|---|
| 5 | "In progress" → "In Progress" |

### Language Assignments
| # | Book | Language |
|---|---|---|
| 7 | Rienecker — Sprachlicher Schlüssel zum Griechischen Neuen Testament | german |

---

## LHB — Hebrew Language Tools (11 books, excluding TWOT)

### Multi-Author Splits
| # | Original | Split Into |
|---|---|---|
| 1 | Arnold, Bill T., and John H. Choi | Arnold, Bill T. (author) + Choi, John H. (author) |
| 2 | Brown, Driver, Briggs | Brown, Francis (author) + Driver, S. R. (author) + Briggs, Charles A. (author) |
| 7 | Joüon, Paul and T. Muraoka | Joüon, Paul (author) + Muraoka, T. (author) — both listed as author; translator field pending |
| 9 | Waltke, Bruce K. and M. O'Connor | Waltke, Bruce K. (author) + O'Connor, Michael Patrick (author) |

### Author Corrections
| # | Original | Corrected |
|---|---|---|
| 5 | Futado, Mark D. | Futato, Mark D. |
| 6 | Futado, Mark D. | Futato, Mark D. |

---

## Brockhaus — German Reference Encyclopedia (31 volumes, BH series)

### Group A — Brockhaus Enzyklopädie, 19th Edition (24 volumes)
- **Title (all vols):** *Brockhaus Enzyklopädie*
- **Author:** blank (publisher, not a person)
- **Language:** german
- **Subject:** REF (keep)
- **needs_review:** false
- **personal_notes:** Letter range per volume (e.g., "A–APT") for shelf reference

| Vol | Letter Range |
|---|---|
| 1 | A-APT |
| 2 | APU-BEC |
| 3 | BED-BRN |
| 4 | BRO-COS |
| 5 | COT-DR |
| 6 | DS-EW |
| 7 | EX-FRT |
| 8 | FRU-GOS |
| 9 | GOT-HERP |
| 10 | HERR-IS |
| 11 | IT-KIP |
| 12 | KIR-LAG |
| 13 | LAH-MAF |
| 14 | MAG-MOD |
| 15 | MOE-NOR |
| 16 | NOS-PER |
| 17 | PES-RAG |
| 18 | RAD-RUS |
| 19 | RUT-SCH |
| 20 | SCI-SQ |
| 21 | SR-TEO |
| 22 | TEP-UR |
| 23 | US-WEJ |
| 24 | WEK-ZZ |

### Group B — Brockhaus Deutsches Wörterbuch (3 volumes)
- **Title (all vols):** *Brockhaus Deutsches Wörterbuch*
- **Volume numbers:** 1 (A-GLUB), 2 (GLUC-REG), 3 (REH-ZZ)
- **Author:** blank
- **Language:** german
- **Subject:** REF (keep)
- **personal_notes:** Letter range per volume

### Group C — Supplementary Volumes (3 volumes, treated as encyclopedia vols 25-27)
| Vol | Title in xlsx | personal_notes |
|---|---|---|
| 25 | ERGÄNZUNGEN A-Z | Supplements/Addenda A-Z |
| 26 | PERSONEN REGISTER | Person name index |
| 27 | WÖRTERBUCH ENGLISH | English dictionary |

### Jahrbuch (1 volume, standalone)
- **Title:** *Brockhaus Jahrbuch 1996*
- **Year:** 1996
- **Author:** blank
- **Language:** german
- **Subject:** REF
- **volume_number:** null (standalone annual)

---

## Data Additions Needed on Import
_Books to ADD that are missing from the xlsx_

| Book | Details |
|---|---|
| Bauer, Walter (BDAG) | *A Greek-English Lexicon of the New Testament and Other Early Christian Literature*, 3rd ed., ed. Frederick W. Danker. Chicago: University of Chicago Press, 2000. Subject: LGK. Status: Reference. |

---

## Deferred Shelf-Check List
_Resolve when home before finalizing import CSV_

| # | Item | Question |
|---|---|---|
| #21 / #27 | Calvin CC — Exodus/Leviticus/Numbers/Deuteronomy | 1993 Baker 22-vol set vols 2 & 3. Are both physical volumes present? Confirm both titles and assign volume numbers |
| #16 Bruce — Acts (now deleted) / #52 Bruce — Acts Revised | Merged to single Revised Edition entry. Confirm you have only the 1988 revised NICNT volume |
| #78 | Hodge — Commentary on the First Epistle to the Corinthians | Which reprint edition? Banner of Truth (GSC series) or Eerdmans (standalone)? |
| #8 | New Bible Dictionary (Douglas et al.) | Which edition? 1st (1962), 2nd (1982), or 3rd (1996)? |

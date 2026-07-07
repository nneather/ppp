# Library Turabian — 20-row QA fixture set (Wave 2)

**Locked:** 2026-07-06 (Phase 0)  
**Reference:** Covenant Seminary Turabian guide §17.1; executable mirror in `src/lib/library/turabian/__tests__/fixtures.ts`  
**Gap rows:** encoded as `it.fails` in `format.test.ts` until Session 1+ formatters ship.

| # | Slug | Source type | Shelf example | Footnote | Bib | Status |
|---|------|-------------|---------------|----------|-----|--------|
| 1 | `single-author` | single-author-book | Long, *Art of Biblical History* | pass | pass | **pass** |
| 2 | `two-author` | single-author-book | Branson / Martínez | pass | pass | **pass** |
| 3 | `three-author-jr` | single-author-book | Klein / Hubbard Jr. / Blomberg | pass | pass | **pass** |
| 4 | `four-plus-authors` | single-author-book | Schultze et al. | pass | pass | **pass** |
| 5 | `edited-volume` | edited-volume | Barker / Long, *Sermons that Shaped America* | pass | pass | **pass** |
| 6 | `author-editor` | book-with-editor | Lewis / Hooper | pass | pass | **pass** |
| 7 | `author-translator` | book-with-translator | Maier / Yarbrough | pass | pass | **pass** |
| 8 | `author-editor-translator` | commentary-in-series | Lange Acts (Lechler / Gerok / Lange / Gloag) | pass | pass | **pass** |
| 9 | `revised-edition` | single-author-book | Chapell, 2nd ed. | pass | pass | **pass** |
| 10 | `reprint` | single-author-book | Payson reprint | pass | pass | **pass** |
| 11 | `multi-volume-page` | multi-volume | Hodge *Systematic Theology* vol. 2 | pass | pass | **pass** |
| 12 | `multi-volume-set` | multi-volume | Barth *Church Dogmatics* (14 vols.) | pass | pass | **pass** |
| 13 | `commentary-in-series` | commentary-in-series | Smalley, WBC | pass | pass | **pass** |
| 14 | `german-reprint` | standalone-commentary | Barth *Der Römerbrief* | pass | pass | **pass** |
| 15 | `bible` | bible | ESV | pass | empty | **pass** |
| 16 | `unsigned-sv-lexicon` | reference-work (unsigned s.v.) | BDAG lemma | **fail** | n/a | **fail** |
| 17 | `signed-dictionary-article` | article-in-reference-work | ABD — Sanders, "Canon" | **fail** | **fail** | **fail** |
| 18 | `tdnt-signed-article` | article-in-reference-work | TDNT — Kittel, "λέγω" | **fail** | n/a | **fail** |
| 19 | `chapter-edited-volume` | chapter-in-edited-volume | Piper in Peterson/Wells | **fail** | **fail** | **fail** |
| 20 | `short-footnote` | short-form (§16.4.1) | Long, shortened title | **fail** | n/a | **fail** |

**Summary:** 15 pass · 5 fail (rows 16–20)

---

## Row details

### 1 — Single-author monograph

- **Footnote:** `V. Philips Long, The Art of Biblical History (Grand Rapids, MI: Zondervan, 1994), 123.`
- **Bibliography:** `Long, V. Philips. The Art of Biblical History. Grand Rapids, MI: Zondervan, 1994.`

### 2 — Two-author monograph

- **Footnote:** `Mark Lau Branson and Juan F. Martínez, Churches, Cutures & Leadership: A Practical Theology of Congregations and Ethnicities (Downers Grove, IL: IVP Academic, 2011), 160.`
- **Bibliography:** `Branson, Mark Lau, and Juan F. Martínez. Churches, Cutures & Leadership: A Practical Theology of Congregations and Ethnicities. Downers Grove, IL: IVP Academic, 2011.`

### 3 — Three-author with Jr. suffix

- **Footnote:** `William W. Klein, Robert L. Hubbard Jr., and Craig L. Blomberg, Introduction to Biblical Interpretation (Dallas: Word Books, 1993), 88.`
- **Bibliography:** `Klein, William W., Robert L. Hubbard Jr., and Craig L. Blomberg. Introduction to Biblical Interpretation. Dallas: Word Books, 1993.`

### 4 — Four+ authors (et al. in note; all names in bib)

- **Footnote:** `Quentin J. Schultze et al., Dancing in the Dark (Grand Rapids, MI: William B. Eerdmans, 1991), 189.`
- **Bibliography:** `Schultze, Quentin J., Roy M. Anker, James D. Bratt, and William D. Romanowski. Dancing in the Dark. Grand Rapids, MI: William B. Eerdmans, 1991.`

### 5 — Edited volume

- **Footnote:** `William S. Barker and Samuel T. Long, eds., Sermons that Shaped America (Phillipsburg, NJ: P&R Publishing, 2004), 79.`
- **Bibliography:** `Barker, William S., and Samuel T. Long, eds. Sermons that Shaped America. Phillipsburg, NJ: P&R Publishing, 2004.`

### 6 — Author + editor

- **Footnote:** `C. S. Lewis, Christian Reflections, ed. Walter Hooper (Grand Rapids, MI: William B. Eerdmans, 1967), 83.`
- **Bibliography:** `Lewis, C. S. Christian Reflections. Edited by Walter Hooper. Grand Rapids, MI: William B. Eerdmans, 1967.`

### 7 — Author + translator

- **Footnote:** `Gerhard Maier, Biblical Hermeneutics, trans. Robert W. Yarbrough (Wheaton, IL: Crossway Books, 1994), 17.`
- **Bibliography:** `Maier, Gerhard. Biblical Hermeneutics. Translated by Robert W. Yarbrough. Wheaton, IL: Crossway Books, 1994.`

### 8 — Author + editor + translator (commentary)

- **Footnote:** `G. V. Lechler and K. Gerok, Theological and Homiletical Commentary on the Acts of the Apostles: Specially Designed and Adapted for the Use of Ministers and Students, ed. J. P. Lange, trans. Paton J. Gloag, 2nd ed., Clark's Foreign Theological Library (Edinburgh: T. & T. Clark, 1869), 44.`
- **Bibliography:** `Lechler, G. V., and K. Gerok. Theological and Homiletical Commentary on the Acts of the Apostles: Specially Designed and Adapted for the Use of Ministers and Students. Edited by J. P. Lange. Translated by Paton J. Gloag. 2nd ed. 2 vols. Clark's Foreign Theological Library. Edinburgh: T. & T. Clark, 1869.`

### 9 — Revised edition

- **Footnote:** `Bryan Chapell, Christ-Centered Preaching: Redeeming the Expository Sermon, 2nd ed. (Grand Rapids, MI: Baker Academic, 2005), 22.`
- **Bibliography:** `Chapell, Bryan. Christ-Centered Preaching: Redeeming the Expository Sermon. 2nd ed. Grand Rapids, MI: Baker Academic, 2005.`

### 10 — Reprint (footnote + bibliography)

- **Footnote:** `Edward Payson, Sermons for Christian Families (1832; repr., Birmingham, AL: Solid Ground Christian Books, 2009), 55.`
- **Bibliography:** `Payson, Edward. Sermons for Christian Families. 1832. Reprint, Birmingham, AL: Solid Ground Christian Books, 2009.`

### 11 — Multi-volume vol:page

- **Footnote:** `Charles Hodge, Systematic Theology (Grand Rapids, MI: Eerdmans, 1946), 2:257.`
- **Bibliography:** `Hodge, Charles. Systematic Theology. Vol. 2. Grand Rapids, MI: Eerdmans, 1946.`

### 12 — Multi-volume set

- **Footnote:** `Karl Barth, Church Dogmatics (Edinburgh: T. & T. Clark, 1936), 12.`
- **Bibliography:** `Barth, Karl. Church Dogmatics. 14 vols. Edinburgh: T. & T. Clark, 1936.`

### 13 — Commentary in series (abbreviated series in note)

- **Footnote:** `Stephen S. Smalley, 1, 2, 3 John, WBC (Waco, TX: Word Books, 1984), 82.`
- **Bibliography:** `Smalley, Stephen S. 1, 2, 3 John. Word Biblical Commentary. Waco, TX: Word Books, 1984.`

### 14 — German commentary + reprint

- **Footnote:** `Karl Barth, Der Römerbrief (1922; repr., Zürich: Theologischer Verlag Zürich, 2008), 12.`
- **Bibliography:** `Barth, Karl. Der Römerbrief. 1922. Reprint, Zürich: Theologischer Verlag Zürich, 2008.`

### 15 — Bible (footnote only)

- **Footnote:** `Gen. 1:1 (English Standard Version).`
- **Bibliography:** _(empty — standard Turabian treatment)_

### 16 — Unsigned lexicon s.v. **FAIL**

- **Target footnote:** `BDAG, s.v. "ἀγάπη," 12.`
- **Gap:** `formatEssayFootnote` prefixes article title as pseudo-author; no BDAG abbreviation path.

### 17 — Signed dictionary article **FAIL**

- **Target footnote:** `James A. Sanders, "Canon," in David Noel Freedman, ed., Anchor Bible Dictionary (New York: Doubleday, 1992), s.v. "Canon," 835.`
- **Target bibliography:** `Sanders, James A. "Canon." In Anchor Bible Dictionary, edited by David Noel Freedman. New York: Doubleday, 1992.`
- **Gap:** `EssayCitationInput` authors not consumed by formatter; unsigned `s.v.` path only.

### 18 — TDNT signed article **FAIL**

- **Target footnote:** `Gerhard Kittel, "λέγω," TDNT 4:100.`
- **Gap:** no abbreviated multi-volume article form; may defer to Session 2 if Session 1 runs long.

### 19 — Chapter in edited volume **FAIL**

- **Target footnote:** `John Piper, "The Perseverance of the Saints," in David G. Peterson and David F. Wells, eds., The Glory of the Atonement (Grand Rapids, MI: Baker Academic, 2004), 123.`
- **Target bibliography:** `Piper, John. "The Perseverance of the Saints." In The Glory of the Atonement, edited by David G. Peterson and David F. Wells, 123. Grand Rapids, MI: Baker Academic, 2004.`
- **Gap:** no `formatChapterFootnote` / essay bibliography formatter.

### 20 — Short footnote **FAIL**

- **Current:** `long, The Art of Biblical History, 42.`
- **Target:** `Long, Art of Biblical History, 42.`
- **Gap:** lowercased last name; no leading-article strip on short title.

---

## Session sequence (locked Phase 0)

| Session | Ships |
|---------|--------|
| **1** | Article-level formatters; short-footnote fixes; flip rows 16–20 `it.fails` → `it`; seed ~5 essay rows via SQL |
| **2** | Essays CRUD UI on book detail; per-essay copy buttons; loaders |
| **3** | Megacomponent split (`scripture-reference-form`, `book-form`) |
| **4** | `.docx` export (hanging indent + italics) |
| **August** | Physical shelf verification of all 20 rows |

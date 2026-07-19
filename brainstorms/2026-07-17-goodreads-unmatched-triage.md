# Goodreads unmatched triage
Date: 2026-07-17 · Goal: Decide per unmatched rated Goodreads row — fix match, rate existing, add book, or skip

## Summary / key decisions
- Action vocabulary locked (Q1): Fix person, Rate existing, Add owned, Queue not-owned, Skip, Merge dupes, **Apply to both** (two distinct bindings each get the rating).
- Batch same root cause; walk A (author miss) → B (ambiguous) → C (no title hit).
- **Lanes A + B + C triage complete** (2026-07-18). **Execution applied 2026-07-18** (hosted DB + matcher polish). Not-owned queue: `brainstorms/2026-07-17-goodreads-not-owned-queue.md`. Remaining: `owned` flag + HC full essay breakout session.
- **YA cut (Q24, partial):** Skip unowned YA/kids (Riordan, Collins, HP, Chicka, Seuss, Wackiest Pets, Giver, Peanuts, Grimm Urfassung). **Add owned + rate:** Wingfeather ×4, Phantom Tollbooth ★4, Everything Sad Is Untrue ★5. Adventure Bible was wrongly skipped — corrected in Q30.
- **Andersen (Q25):** Essay breakout on Folk-Lore and Fable volume + personal note for ★4 (essays can’t store rating).
- **Lewis (Q26):** Bump Space Trilogy omnibus → ★5; **Add owned** Surprised by Joy ★4; **Queue not-owned (read):** Letters to Malcolm, Narnia box set. Skip separate Space novels (omnibus covers).
- **Sherlock (Q27):** Rate Adventures ★4; essay breakouts + notes on **Complete Novels** for Hound ★5, Study/Sign/Valley ★4.
- **Calvin Acts (Q28):** Essay + note on the two combined Calvin volumes for Acts 1–13 ★5 / Acts 14–28 ★4 (not whole-volume rating).
- **Calvin Little Book (Q28b):** Queue not-owned (read) ★5.
- **Goethe (Q29):** Rate existing Werther ★5, Faust I ★5, Faust II ★4.
- **Bibles (Q30):** Rate existing NIV Study Bible ★5 + Adventure Bible ★5; **Add owned** NASB thinline/reference ★5.
- **Kafka (Q31):** Fix Der Verwandlund → Die Verwandlung; Rate existing both ★4.
- **González (Q32):** Fix Gonzales → González; Rate existing Story of Christianity Vol 1 ★4, Vol 2 ★3.
- **Steinbeck (Q33):** Essay + note on Short Novels for Of Mice and Men ★5 + The Moon Is Down ★4.
- **Latin (Q34):** Rate existing Cambridge Unit 3 ★5, Oxford Part I ★5 (GR Part 1), Oxford Part II ★5 (GR bare “Oxford Latin Course”).
- **★5 near-misses (Q35):** Rate Biblical History of Israel, Boundaries, Confessions I, Musician’s Guide, Total Workday Control; fix Douglass title+person + rate ★5.
- **Thurman + Meditations (Q36):** Fix Disinheirited → Disinherited + rate ★5; essay + note on Harvard Plato/Epictetus/Aurelius volume for Meditations ★5.
- **Seminary ★5 (Q37):** **Add owned + rate:** Chester, Allen, Eswine. **Queue not-owned:** Reeves Delighting, Hester Inheritance, Redeemer CPM, Clark Incarnation.
- **★5 classics (Q38):** Fix+rate Iliad & Durant Renaissance; Antigone essay on Three Theban Plays; rate NFL100; **Add owned:** Franklin Autobiography, Animal Farm, Fahrenheit 451, Ideal Team Player, German Requiem, Mahler scores; **Queue:** Letters to Children; **Essay+note:** Burke Reflections on HC Burke volume. Flag: full Harvard Classics essay breakout as future exercise.
- **Adler (Q39):** Queue not-owned How to Read a Book ★5. **★5 lane done** (aside from earlier YA/owned adds).
- **★4 near-misses (Q40):** Fix+rate Allberry Singleness; rate Baugh Greek Primer, Hengel Petrus, Heine Wintermärchen, Claiborne Irresistible Revolution, Wordsworth Poems; essays: Prodigal God on Keller combo, Candide on HC French Philosophers, Underground on Three Short Novels, Romeo on Annotated Shakespeare **vol III**. **Skip** re-rating Westminster Shorter Catechism.
- **★4 near-misses (Q41):** Rate Images of His World, Peer Gynt; fix Blake Innocense→Innocence + rate; rate Theories of Vision.
- **★4 remainder (Q42):** Rate Iwo Jima; Wright Knowing Jesus → essay on *Knowing God through the OT* 3-in-1; rename *Hole in the Gospel* → *Hole in Our Gospel* + rate; rate all four Churchill English-Speaking Peoples vols ★4; **Add owned:** Roberts Hitler and Churchill, Silvia How to Write a Lot, Jay Defining Decade; Roper → essay on HC Machiavelli More Luther; **Queue not-owned:** Anxious, Bruchko, Creation and Fall, Godly Jealousy, Show Them No Mercy, To Seek and to Save, Rise and Walk, Singletary, Jesus Freaks, hiking×2. **★4 closed.**
- **★3–1 (Q43):** Rate Eat That Frog + Tanks; **Add owned:** D-Day Encyclopedia, Drive, Geschichte der deutschen Literatur, Piotrowski Return from Exile, WW2 DK, Genealogy of Morals; Ruskin Sesame and Lilies → essay on HC **Essays English and American** (vol 28); **Queue not-owned:** Black Jesus, Essentials of Economics, Financial Accounting, Applied Mathematics. **Lane C triage complete.**
- **Tolkien cluster (Q2):** Fix person Tolkein → Tolkien; **Apply to both** on all duplicate Hobbit/LOTR library rows; then apply GR ★5 ratings.
- **Dostoevsky cluster (Q3):** Canonicalize person to **Dostoevsky** (rename Dostozevsky + merge Dostoyevsky); **Rate existing** Crime and Punishment + Brothers Karamazov ★5.
- **Austen (Q4):** Fix person Austin → Austen; Rate existing Pride and Prejudice ★5.
- **Litfin (Q5):** Fix person Liften → Litfin; Rate existing Getting to Know the Church Fathers ★5.
- **Hansen (Q6):** Fix person Collin Hanson → Hansen (not Morten); Rate existing Gospel After Christendom + Timothy Keller formation ★4.
- **Typo batch (Q7):** Fix Bossidy/Charan, Alighieri, Holmes; Rate existing Execution, Inferno, WWII Photographs ★4.
- **German pair (Q8):** No rename (live names already correct; prior mojibake was analysis artifact). Rate existing Emil ★4 + Ben liebt Anna ★3. Note: prefer people-join for match keys later.
- **Van Opstal (Q9):** Rate existing The Next Worship ★4; matcher polish for van/von particles (no people rename).
- **Plantinga (Q10):** Rate existing Not the Way… ★5; matcher strip Jr./Sr./II/III/(ed).
- **Zodhiates (Q11):** Rate existing Key Word Study Bible ★5; clean author_display “(ed)”; matcher strip covered by Q10 polish.
- **City of God (Q12):** Matcher polish Augustine of Hippo → augustine; Rate existing ★5 on shorter `The City of God` only (not De Civitate Dei).
- **Westminster (Q13):** Rate existing ★5 on longer Catechisms title only; leave Presbyterian C. America as-is.
- **Genett (Q14):** Rate existing ★4; ignore GR author `aa`.
- **Rubáiyát (Q15):** Rate existing ★4 on Fitzgerald row (translator attribution); no people change.
- **Romans / Polich (Q16):** Rate existing ★3 on `Studies on the Go - Romans` (Laurie Polich-Short). Not the Romans commentaries. Matcher: hyphenated surname + title-order near-miss.
- **Orthodoxy (Q17):** Apply to both ★4 (two ISBN bindings).
- **Silver Chair (Q18):** Two owned copies — consolidate to one row with `copy_count = 2` + ★4 (not merge-delete both; not leave twin rows).
- **Leviticus / Sklar (Q19):** Rate existing ★5 on Tyndale Sklar only (`9780830895861`); not Zondervan Sklar; not Levine.
- **Confronting Christianity (Q20):** Drop one duplicate row; rate the keeper ★4.
- **Doriani Work (Q21):** Rate existing ★4 on *Its Purpose…* only; leave *That Makes a Difference* alone.
- **Grimm (Q22):** Drop 1 + rate keeper ★4 (single copy).
- **Orient Express (Q22):** Two owned copies → `copy_count = 2` + ★4; drop twin.
- **Brave New World (Q22):** Drop 1 + rate keeper ★5 (single copy).
- **Lane B done.**

## Decision vocabulary (locked Q1)
- **Fix person** — correct `people` spelling / display; re-match applies rating to existing book
- **Rate existing** — apply Goodreads rating to the matched library book (possibly after matcher polish)
- **Add owned** — create a new owned library row + rating
- **Queue not-owned** — want it for citation later; defer create until `owned` ships
- **Skip** — leave unmatched (not worth cataloguing / wrong work)
- **Merge duplicates** — soft-delete or merge duplicate library rows so match becomes unique
- **Apply to both** — two distinct bindings/copies both receive the Goodreads rating (not a merge)

## Q&A log

### Q1 — Action vocabulary + batching
- Asked: Confirm action codes and batch A→B→C by root cause
- Captured: Approved as recommended. Added **Apply to both** for two distinct bindings that each need the rating recorded (distinct from Merge dupes).
- Flags: none

### Q11 — Zodhiates Key Word Study Bible (#7)
- Asked: (ed) in author_display broke match?
- Captured: **Rate existing** ★5; clean author_display; Jr./(ed) strip already on polish list.
- Flags: none new

### Q12 — City of God (#11)
- Asked: Augustine of Hippo → key `hippo`; two library City of God rows.
- Captured: Matcher polish for `Augustine of Hippo` / `of Hippo` → `augustine`. **Rate existing** ★5 on shorter title only (`The City of God`), not the De Civitate Dei row. Not Apply to both; not merge.
- Flags: place-name / “of X” author alias on matcher polish list

### Q13 — Westminster Confession (#6)
- Asked: GR Westminster Assembly vs lib Presbyterian C. America; two Westminster rows.
- Captured: **Rate existing** ★5 on longer Catechisms title only. Leave person as-is; no corporate-body matcher alias.
- Flags: none

### Q14 — Genett / aa (#14)
- Asked: GR author `aa` vs lib Donna M. Genett on same title.
- Captured: **Rate existing** ★4; ignore garbage GR author. No people fix.
- Flags: none

### Q15 — Rubáiyát (#15)
- Asked: GR Omar Khayyám vs lib Edward Fitzgerald on same title.
- Captured: **Rate existing** ★4 on Fitzgerald row. No people change; no general translator matcher for now.
- Flags: none

### Q16 — Romans / Polich (#16, author-miss #23)
- Asked: GR Romans (Studies on the Go) / Laurie Polich vs library Romans commentaries.
- Captured: Same work as library **Studies on the Go - Romans** (Laurie Polich-Short). **Rate existing** ★3 on that row — not any Romans commentary. Title-order + hyphenated surname caused the miss (and false “Romans” commentary hits).
- Flags: matcher polish — hyphenated last names (Polich ↔ Polich-Short); series/title reorder near-miss

### Q17 — Orthodoxy (ambiguous #1)
- Asked: Two Orthodoxy / Chesterton rows (different ISBNs).
- Captured: **Apply to both** ★4.
- Flags: none

### Q18 — Silver Chair (ambiguous #2)
- Asked: Two Silver Chair rows, same ISBN; one already ★4.
- Captured (revised): **Not** merge-away ownership. Two owned copies → keep one row, set `copy_count = 2`, ★4; soft-delete the twin row. (Initial “Merge dupes” underspecified ownership.)
- Flags: when identical-ISBN twins are real multi-copy, use `copy_count` not silent merge

### Q19 — Leviticus / Sklar (ambiguous #3)
- Asked: GR Tyndale Sklar vs three Leviticus rows (2× Sklar + Levine).
- Captured: **Rate existing** ★5 on Tyndale Sklar only (`9780830895861`). Not Zondervan Sklar; not Levine.
- Flags: none

### Q20 — Confronting Christianity (ambiguous #4)
- Asked: Two identical title/author rows; one already ★4.
- Captured: **Drop 1** (soft-delete twin) + **rate keeper** ★4. Not Apply to both; not `copy_count` (single copy).
- Flags: none

### Q21 — Doriani Work (ambiguous #5)
- Asked: GR Its Purpose… vs also Work: That Makes a Difference.
- Captured: **Rate existing** ★4 on *Its Purpose, Dignity, and Transformation* only. Do not touch *That Makes a Difference*.
- Flags: none

### Q22 — Grimm / Orient Express / Brave New World (ambiguous #6–8)
- Asked: Identical-ISBN twins — copy_count vs drop?
- Captured:
  - **Grimm’s Fairy Tales:** single copy → drop twin + rate keeper ★4
  - **Murder on the Orient Express:** two owned copies → `copy_count = 2` + ★4; drop twin
  - **Brave New World:** single copy → drop twin + rate keeper ★5
- Flags: none
- **Lane B complete.**

### Q23 — Lane C approach
- Asked: ★5-first vs by-cluster vs Skip-YA default vs other.
- Captured: **C by way of B** — walk by cluster; default Skip YA/kids; triage nonfiction/classics/seminary.
- Flags: none

### Q24 — YA/kids cut + owned exceptions
- Asked: Skip YA block; edge cases Wingfeather / Giver+Tollbooth / Andersen+Grimm Urfassung / Peanuts / Everything Sad.
- Captured:
  - **Add owned + rate:** Wingfeather saga ×4 (★★★★/★★★★★ per GR), Phantom Tollbooth ★4, Everything Sad Is Untrue ★5
  - **Skip (unowned):** Riordan, Collins, HP box, Chicka Chicka, Fox in Socks, Wackiest White House Pets, The Giver, Peanuts Treasury, Kinder und Hausmärchen Urfassung
  - **Adventure Bible:** initially listed as Skip; corrected in Q30 — already in library → rate existing
  - **Andersen ★4:** in Harvard Classics set — decide note vs essay (Q25). Library already has **Folk-Lore and Fable Aesop Grimm Andersen** (Neilson) — almost certainly that volume.
- Flags: essays have no `rating` column — essay-only can’t hold the star

### Q25 — Andersen / Harvard Classics
- Asked: note vs essay vs rate whole volume.
- Captured: **B** — essay breakout “Andersen’s Fairy Tales” on Folk-Lore and Fable + personal_notes line for ★4. Do not set `books.rating` on the whole volume.
- Flags: none

### Q26 — C.S. Lewis cluster
- Asked: Space Trilogy / Malcolm / Surprised by Joy / Narnia box vs existing omnibus + Narnia volumes.
- Captured:
  - Keep **The Space Trilogy** omnibus; **bump rating → ★5**. Do not add Silent Planet / Perelandra / Hideous Strength as separate owned rows.
  - **Add owned + rate:** Surprised by Joy ★4
  - **Queue not-owned (read):** Letters to Malcolm ★4, Chronicles of Narnia box set ★4
- Flags: “not owned but read” package = future `owned=false` (or equivalent) backlog

### Q27 — Sherlock / Doyle
- Asked: Rate completes vs queue separate novels; then which parent for essays.
- Captured: **Rate existing** The Adventures of Sherlock Holmes ★4. Essay breakouts on **The Complete Novels of Sherlock Holmes** for Hound of the Baskervilles ★5, A Study in Scarlet ★4, Sign of the Four ★4, Valley of Fear ★4 + parent personal_notes for stars. Do not queue separate novel stubs.
- Flags: none

### Q28 — Calvin cluster
- Asked: Rate whole Calvin volumes vs essay+note; Little Book owned?
- Captured: Acts 1–13 ★5 and Acts 14–28 ★4 → **essay + note** on **John 12–21; Acts 1–13** and **Acts 14–28; Romans 1–16**. **Queue not-owned (read):** A Little Book on the Christian Life ★5.
- Flags: none

### Q29 — Goethe cluster
- Asked: Rate existing Faust I/II + Werther vs add/queue.
- Captured: **Rate existing** Leiden des jungen Werthers ★5, Faust I ★5, Faust II ★4.
- Flags: none

### Q30 — Bibles
- Asked: NIV / Adventure / NASB.
- Captured: **Rate existing** NIV Study Bible ★5 + Adventure Bible for Young Readers ★5. **Add owned** NASB Reference/Thinline ★5.
- Flags: none

### Q31 — Kafka pair
- Asked: Fix Verwandlund typo + rate Meistererzählungen?
- Captured: Fix title **Der Verwandlund → Die Verwandlung**; **Rate existing** both ★4.
- Flags: none

### Q32 — González / Story of Christianity
- Asked: Fix Gonzales spelling + rate both volumes?
- Captured: Fix person **Gonzales → González**; **Rate existing** Vol 1 ★4, Vol 2 ★3.
- Flags: none

### Q33 — Steinbeck pair
- Asked: Essay on Short Novels vs add separate vs queue.
- Captured: **A** — essay + note on **Short Novels** for Of Mice and Men ★5 and The Moon Is Down ★4.
- Flags: none

### Q34 — Latin courses
- Asked: Rate Cambridge + Oxford Part I; bare Oxford = Part I?
- Captured: **Rate existing** Cambridge Unit 3 ★5; Oxford Part I ★5 (GR Part 1); Oxford Part II ★5 (GR bare “Oxford Latin Course” = Part 2).
- Flags: none

### Q35 — ★5 near-misses in library
- Asked: Rate Biblical History / Boundaries / Confessions I / Douglass / Musician’s Guide / Total Workday?
- Captured: **Rate existing** all as recommended; fix Douglass `Narative`→`Narrative` and `Douglas`→`Douglass`; Confessions → rate **Confessions I** (not Loeb stub).
- Flags: none

### Q36 — Thurman + Meditations
- Asked: Fix Disinheirited + Meditations as Harvard essay?
- Captured: Fix **Disinheirited → Disinherited** + rate ★5; **essay + note** on Plato/Epictetus/Marcus Aurelius volume for Meditations ★5.
- Flags: none

### Q37 — Seminary ★5 not in library
- Asked: Add / queue / skip for seven theology ★5s.
- Captured:
  - **Add owned + rate ★5:** Chester *Paul through the Eyes of the Reformers*; Allen *Reformed Catholicity*; Eswine *Preaching to a Post-Everything World*
  - **Queue not-owned (read):** Reeves *Delighting in the Trinity*; Hester *Paul’s Concept of Inheritance*; Thompson/Keller *Redeemer Church Planting Manual*; Clark *The Incarnation of God*
- Flags: none

### Q38 — ★5 classics / misc
- Asked: Iliad, Durant, Antigone, NFL, Franklin, remaining ★5 owned status.
- Captured:
  - Fix **Illiad → Iliad** + rate ★5; fix **Renaisance → Renaissance** + rate ★5
  - Antigone → essay + note on **Three Theban Plays** ★5
  - Rate existing **NFL100** ★5
  - **Add owned + rate ★5:** Franklin Autobiography (separate from HC), Animal Farm, Fahrenheit 451, Ideal Team Player, German Requiem, Mahler Symphonies 1–2 scores
  - **Queue not-owned:** Letters to Children (Dorsett)
  - Burke *Reflections on the Revolution in France* → essay + note on HC **On the Sublime French Revolution Etc. Burke**
  - Future exercise: break remaining Harvard Classics volumes into essays
- Flags: How to Read a Book (Adler ★5) still undecided; HC essay breakout backlog

### Q39 — How to Read a Book
- Asked: Adler ★5 owned?
- Captured: **Queue not-owned (read)** ★5. **Remaining ★5 closed.**
- Flags: none new

### Q40 — ★4 near-misses
- Asked: Rate/fix/essay package for ★4 near-hits.
- Captured: Confirm all except **do not** re-rate / essay Westminster Shorter Catechism. Romeo and Juliet → essay + note on **Annotated Shakespeare, The vol III**. Rest as recommended (Allberry fix+rate; Baugh/Hengel/Heine/Claiborne/Wordsworth rate; Prodigal God / Candide / Underground essays).
- Flags: none

### Q41 — ★4 near-misses round 2
- Asked: Images of His World / Peer Gynt / Blake / Theories of Vision.
- Captured: **Rate existing** Images of His World, Peer Gynt; fix **Innocense → Innocence** + rate Blake; rate Theories of Vision.
- Flags: none

### Q42 — Remaining ★4
- Asked: Iwo Jima + owned status for leftover ★4s.
- Captured:
  - Rate **Iwo Jima** (Leckie) ★4
  - Knowing Jesus Through the OT → essay + note on **Knowing God through the Old Testament: Three Volumes in One**
  - Rename **The Hole in the Gospel → The Hole in Our Gospel** + rate ★4
  - Churchill omnibus GR → **rate all four** owned vols ★4: Birth of Britain, New World, Age of Revolution, Great Democracies
  - **Add owned + rate ★4:** Roberts *Hitler and Churchill*, Silvia *How to Write a Lot*, Jay *The Defining Decade*
  - Roper *Life of St. Thomas More* → essay + note on HC **Machiavelli More Luther**
  - **Queue not-owned:** Anxious, Bruchko, Creation and Fall/Temptation, Godly Jealousy, Show Them No Mercy, To Seek and to Save, Rise and Walk, Singletary on Singletary, Jesus Freaks, Hiking Trails Collegiate Peaks, Hiking and Backpacking
- Flags: none
- **★4 lane closed.**

### Q43 — ★3 and below
- Asked: Near-hits + owned status for remaining low ratings.
- Captured:
  - **Rate existing:** Eat That Frog ★3; Tanks and Armored Fighting Vehicles ★3
  - **Add owned + rate:** D-Day Encyclopedia ★3, Drive ★3, Geschichte der deutschen Literatur ★3, Piotrowski Return from Exile ★3, World War II (DK) ★3, Genealogy of Morals ★1
  - Ruskin Sesame and Lilies → essay + note on HC **Essays English and American** (HC vol 28)
  - **Queue not-owned:** Bonhoeffer's Black Jesus, Essentials of Economics, Financial Accounting, Applied Mathematics
  - Already covered: YA skips; González Vol 2 ★3 (Q32)
- Flags: none
- **Lane C triage complete.** Ready for execution pass when Parker asks.

## Open flags (pending input)
- Not-owned flag not shipped yet — “queue not-owned” means note for later, don’t create yet
- “Not owned but read” package accumulates until `owned` ships
- **Future exercise:** Harvard Classics full essay breakout (valuable; do after triage / as own session)
- Matcher polish backlog (van/von, Jr./(ed), Hippo, hyphenated surnames, people-join keys)
- Identical-ISBN twins: ask owned-copies (`copy_count`) vs drop-duplicate before acting
- Not-owned flag not shipped yet — “queue not-owned” means note for later, don’t create yet
- “Not owned but read” package accumulates until `owned` ships
- **Future exercise:** Harvard Classics full essay breakout (valuable; do after triage / as own session)
- Matcher polish: prefer `book_authors→people` last names over `author_display` for Goodreads match keys
- Matcher polish: van/von/de particles (Opstal ↔ Van Opstal)
- Matcher polish: strip Jr./Sr./II/III/(ed) before last-name key
- Matcher polish: Augustine of Hippo / of Hippo → augustine
- Matcher polish: hyphenated surnames + Studies-on-the-Go style title reorder
- Identical-ISBN / twin rows: ask owned-copies (`copy_count`) vs drop-duplicate before acting

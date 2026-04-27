-- =============================================================================
-- Library seed data
-- Filed: 2026-04-25 (Session 0)
--
-- This file is the canonical seed for static library reference data:
--   - bible_books (66 — Protestant canon, OT + NT)
--   - ancient_texts (Josephus, Philo, Apostolic Fathers, Apocrypha)
--   - series (ICC, NTC, OTL, EKK, TWOT, AB, MH, COT)
--   - categories (placeholder — pending Round 2 confirmation)
--   - user_permissions (viewer row — pending Round 2 UUID)
--
-- HOW TO APPLY (manual):
--   - The supabase config disables the local Docker [db.seed] path. This file
--     is NOT picked up by `supabase db push` or `supabase db reset`.
--   - Apply against prod via the Studio SQL editor, or:
--       psql "$(supabase status --output env | grep DB_URL | cut -d= -f2)" \
--         -f supabase/seed/library_seed.sql
--   - Idempotent — every INSERT uses ON CONFLICT DO NOTHING against the natural
--     key. Re-running is safe.
--
-- DEPENDENCIES:
--   - 00000000000000_baseline.sql must be applied first (it creates the tables,
--     CHECKs, and RLS).
--   - Categories block requires Round 2 confirmation of the 7 shelving names.
--   - user_permissions block requires Round 2 viewer UUID.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. bible_books — Protestant canon, sort_order = canonical reading order
-- ---------------------------------------------------------------------------
INSERT INTO public.bible_books (name, testament, sort_order) VALUES
	('Genesis',         'OT',  1),
	('Exodus',          'OT',  2),
	('Leviticus',       'OT',  3),
	('Numbers',         'OT',  4),
	('Deuteronomy',     'OT',  5),
	('Joshua',          'OT',  6),
	('Judges',          'OT',  7),
	('Ruth',            'OT',  8),
	('1 Samuel',        'OT',  9),
	('2 Samuel',        'OT', 10),
	('1 Kings',         'OT', 11),
	('2 Kings',         'OT', 12),
	('1 Chronicles',    'OT', 13),
	('2 Chronicles',    'OT', 14),
	('Ezra',            'OT', 15),
	('Nehemiah',        'OT', 16),
	('Esther',          'OT', 17),
	('Job',             'OT', 18),
	('Psalms',          'OT', 19),
	('Proverbs',        'OT', 20),
	('Ecclesiastes',    'OT', 21),
	('Song of Songs',   'OT', 22),
	('Isaiah',          'OT', 23),
	('Jeremiah',        'OT', 24),
	('Lamentations',    'OT', 25),
	('Ezekiel',         'OT', 26),
	('Daniel',          'OT', 27),
	('Hosea',           'OT', 28),
	('Joel',            'OT', 29),
	('Amos',            'OT', 30),
	('Obadiah',         'OT', 31),
	('Jonah',           'OT', 32),
	('Micah',           'OT', 33),
	('Nahum',           'OT', 34),
	('Habakkuk',        'OT', 35),
	('Zephaniah',       'OT', 36),
	('Haggai',          'OT', 37),
	('Zechariah',       'OT', 38),
	('Malachi',         'OT', 39),
	('Matthew',         'NT', 40),
	('Mark',            'NT', 41),
	('Luke',            'NT', 42),
	('John',            'NT', 43),
	('Acts',            'NT', 44),
	('Romans',          'NT', 45),
	('1 Corinthians',   'NT', 46),
	('2 Corinthians',   'NT', 47),
	('Galatians',       'NT', 48),
	('Ephesians',       'NT', 49),
	('Philippians',     'NT', 50),
	('Colossians',      'NT', 51),
	('1 Thessalonians', 'NT', 52),
	('2 Thessalonians', 'NT', 53),
	('1 Timothy',       'NT', 54),
	('2 Timothy',       'NT', 55),
	('Titus',           'NT', 56),
	('Philemon',        'NT', 57),
	('Hebrews',         'NT', 58),
	('James',           'NT', 59),
	('1 Peter',         'NT', 60),
	('2 Peter',         'NT', 61),
	('1 John',          'NT', 62),
	('2 John',          'NT', 63),
	('3 John',          'NT', 64),
	('Jude',            'NT', 65),
	('Revelation',      'NT', 66)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. ancient_texts — Josephus, Philo, Apostolic Fathers, Apocrypha
--   `category` left free text per A8; can normalize to enum if > 10 distinct values emerge.
-- ---------------------------------------------------------------------------
INSERT INTO public.ancient_texts (canonical_name, abbreviations, category) VALUES
	-- Josephus
	('Josephus, Antiquities of the Jews', ARRAY['Ant.', 'A.J.', 'Antiquities'],                'Josephus'),
	('Josephus, Jewish War',              ARRAY['J.W.', 'B.J.', 'War'],                        'Josephus'),
	('Josephus, Against Apion',           ARRAY['Ag. Ap.', 'C. Ap.'],                          'Josephus'),
	('Josephus, Life',                    ARRAY['Vita', 'Life'],                               'Josephus'),

	-- Philo (selected major works)
	('Philo, On the Creation',                            ARRAY['Opif.', 'De opificio mundi'],  'Philo'),
	('Philo, Allegorical Interpretation',                 ARRAY['Leg.', 'Legum allegoriae'],    'Philo'),
	('Philo, On the Cherubim',                            ARRAY['Cher.'],                       'Philo'),
	('Philo, On the Sacrifices of Cain and Abel',         ARRAY['Sacr.'],                       'Philo'),
	('Philo, On the Worse Attacking the Better',          ARRAY['Det.'],                        'Philo'),
	('Philo, On the Posterity of Cain',                   ARRAY['Post.'],                       'Philo'),
	('Philo, On the Giants',                              ARRAY['Gig.'],                        'Philo'),
	('Philo, On the Unchangeableness of God',             ARRAY['Deus'],                        'Philo'),
	('Philo, On Husbandry',                               ARRAY['Agr.'],                        'Philo'),
	('Philo, On Noah''s Work as a Planter',                ARRAY['Plant.'],                      'Philo'),
	('Philo, On Drunkenness',                             ARRAY['Ebr.'],                        'Philo'),
	('Philo, On Sobriety',                                ARRAY['Sobr.'],                       'Philo'),
	('Philo, On the Confusion of Tongues',                ARRAY['Conf.'],                       'Philo'),
	('Philo, On the Migration of Abraham',                ARRAY['Migr.'],                       'Philo'),
	('Philo, Who Is the Heir of Divine Things',           ARRAY['Her.'],                        'Philo'),
	('Philo, On Mating with the Preliminary Studies',     ARRAY['Congr.'],                      'Philo'),
	('Philo, On Flight and Finding',                      ARRAY['Fug.'],                        'Philo'),
	('Philo, On the Change of Names',                     ARRAY['Mut.'],                        'Philo'),
	('Philo, On Dreams',                                  ARRAY['Somn.'],                       'Philo'),
	('Philo, On Abraham',                                 ARRAY['Abr.'],                        'Philo'),
	('Philo, On Joseph',                                  ARRAY['Ios.'],                        'Philo'),
	('Philo, Life of Moses',                              ARRAY['Mos.', 'Vit. Mos.'],           'Philo'),
	('Philo, On the Decalogue',                           ARRAY['Decal.'],                      'Philo'),
	('Philo, On the Special Laws',                        ARRAY['Spec.'],                       'Philo'),
	('Philo, On the Virtues',                             ARRAY['Virt.'],                       'Philo'),
	('Philo, On Rewards and Punishments',                 ARRAY['Praem.'],                      'Philo'),
	('Philo, Every Good Person Is Free',                  ARRAY['Prob.'],                       'Philo'),
	('Philo, On the Contemplative Life',                  ARRAY['Contempl.'],                   'Philo'),
	('Philo, On the Eternity of the World',               ARRAY['Aet.'],                        'Philo'),
	('Philo, Against Flaccus',                            ARRAY['Flacc.'],                      'Philo'),
	('Philo, Hypothetica',                                ARRAY['Hypoth.'],                     'Philo'),
	('Philo, On Providence',                              ARRAY['Prov.'],                       'Philo'),
	('Philo, Embassy to Gaius',                           ARRAY['Legat.', 'Leg. Gai.'],         'Philo'),

	-- Apostolic Fathers
	('1 Clement',                                         ARRAY['1 Clem.'],                     'Apostolic Fathers'),
	('2 Clement',                                         ARRAY['2 Clem.'],                     'Apostolic Fathers'),
	('Ignatius, To the Ephesians',                        ARRAY['Ign. Eph.'],                   'Apostolic Fathers'),
	('Ignatius, To the Magnesians',                       ARRAY['Ign. Magn.'],                  'Apostolic Fathers'),
	('Ignatius, To the Trallians',                        ARRAY['Ign. Trall.'],                 'Apostolic Fathers'),
	('Ignatius, To the Romans',                           ARRAY['Ign. Rom.'],                   'Apostolic Fathers'),
	('Ignatius, To the Philadelphians',                   ARRAY['Ign. Phld.'],                  'Apostolic Fathers'),
	('Ignatius, To the Smyrnaeans',                       ARRAY['Ign. Smyrn.'],                 'Apostolic Fathers'),
	('Ignatius, To Polycarp',                             ARRAY['Ign. Pol.'],                   'Apostolic Fathers'),
	('Polycarp, To the Philippians',                      ARRAY['Pol. Phil.'],                  'Apostolic Fathers'),
	('Martyrdom of Polycarp',                             ARRAY['Mart. Pol.'],                  'Apostolic Fathers'),
	('Didache',                                           ARRAY['Did.'],                        'Apostolic Fathers'),
	('Epistle of Barnabas',                               ARRAY['Barn.'],                       'Apostolic Fathers'),
	('Shepherd of Hermas',                                ARRAY['Herm.', 'Shep.'],              'Apostolic Fathers'),
	('Epistle to Diognetus',                              ARRAY['Diogn.'],                      'Apostolic Fathers'),
	('Fragments of Papias',                               ARRAY['Papias'],                      'Apostolic Fathers'),

	-- Apocrypha (deuterocanonical)
	('Tobit',                                             ARRAY['Tob.'],                        'Apocrypha'),
	('Judith',                                            ARRAY['Jdt.'],                        'Apocrypha'),
	('Additions to Esther',                               ARRAY['Add. Esth.'],                  'Apocrypha'),
	('Wisdom of Solomon',                                 ARRAY['Wis.', 'Wisd. Sol.'],          'Apocrypha'),
	('Sirach',                                            ARRAY['Sir.', 'Ecclus.'],             'Apocrypha'),
	('Baruch',                                            ARRAY['Bar.'],                        'Apocrypha'),
	('Letter of Jeremiah',                                ARRAY['Ep. Jer.', 'Let. Jer.'],       'Apocrypha'),
	('Prayer of Azariah and Song of the Three Young Men', ARRAY['Pr. Azar.', 'Sg. Three'],      'Apocrypha'),
	('Susanna',                                           ARRAY['Sus.'],                        'Apocrypha'),
	('Bel and the Dragon',                                ARRAY['Bel'],                         'Apocrypha'),
	('1 Maccabees',                                       ARRAY['1 Macc.'],                     'Apocrypha'),
	('2 Maccabees',                                       ARRAY['2 Macc.'],                     'Apocrypha'),
	('1 Esdras',                                          ARRAY['1 Esd.'],                      'Apocrypha'),
	('2 Esdras',                                          ARRAY['2 Esd.', '4 Ezra'],            'Apocrypha'),
	('Prayer of Manasseh',                                ARRAY['Pr. Man.'],                    'Apocrypha'),
	('3 Maccabees',                                       ARRAY['3 Macc.'],                     'Apocrypha'),
	('4 Maccabees',                                       ARRAY['4 Macc.'],                     'Apocrypha')
ON CONFLICT (canonical_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. series — academic commentary + reference series
--   Names per Tracker_1 Session 1 task line.
--   `series.name` is not UNIQUE in the baseline; dedup via WHERE NOT EXISTS.
-- ---------------------------------------------------------------------------
INSERT INTO public.series (name, abbreviation)
SELECT v.name, v.abbreviation
FROM (VALUES
	('International Critical Commentary',                'ICC'),
	('New Testament Commentary',                         'NTC'),
	('Old Testament Library',                            'OTL'),
	('Evangelisch-Katholischer Kommentar zum Neuen Testament', 'EKK'),
	('Theological Wordbook of the Old Testament',        'TWOT'),
	('Anchor Bible',                                     'AB'),
	('Moffatt New Testament Commentary',                 'MH'),
	('Continental Commentary',                           'COT')
) AS v(name, abbreviation)
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.name = v.name OR s.abbreviation = v.abbreviation
);

-- ---------------------------------------------------------------------------
-- 4. categories — 7 canonical shelving categories (Round 2: proposed list)
-- ---------------------------------------------------------------------------
INSERT INTO public.categories (name, slug, sort_order) VALUES
	('Theology',              'theology',              1),
	('Biblical Studies',      'biblical-studies',      2),
	('Church History',        'church-history',        3),
	('Pastoral & Practical',  'pastoral-practical',    4),
	('Languages & Reference', 'languages-reference',   5),
	('General / Trade',       'general-trade',         6),
	('Personal',              'personal',              7)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. user_permissions — viewer module access
--   STATUS: PENDING ROUND 2 VIEWER UUID.
--   Uncomment and replace `<viewer_uuid>` with the real auth.users.id once
--   the viewer is created in Supabase Dashboard.
--
--   Per Tracker_1 / Session 0 viewer-seeding plan: library = write, calendar
--   = read, invoicing = none, projects = none. (Calendar / projects modules
--   not built yet, so their rows are commented for future use.)
-- ---------------------------------------------------------------------------
-- INSERT INTO public.user_permissions (user_id, module, access_level) VALUES
-- 	('<viewer_uuid>'::uuid, 'library',   'write'),
-- 	('<viewer_uuid>'::uuid, 'invoicing', 'none')
-- 	-- ('<viewer_uuid>'::uuid, 'calendar',  'read'),
-- 	-- ('<viewer_uuid>'::uuid, 'projects',  'none')
-- ON CONFLICT (user_id, module) DO NOTHING;

-- =============================================================================
-- End of seed
-- =============================================================================

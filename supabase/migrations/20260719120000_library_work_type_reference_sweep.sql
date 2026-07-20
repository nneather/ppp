-- Idempotent work_type backfill for obvious reference works still on monograph
-- (065 Q8). Commentaries / handbooks / concordances intentionally left alone.
-- Verified candidates: dictionaries, lexica, TWOT, IVP Background Commentaries,
-- HALOT vols. Excludes IVPNTC/NICNT commentary series rows that matched title filters.

UPDATE public.books b
SET work_type = 'reference_work', updated_at = now()
WHERE b.deleted_at IS NULL
  AND b.work_type = 'monograph'
  AND (
    b.title IN (
      'Dictionary of Latin and Greek Theological Terms',
      'Evangelical Dictionary of Theology',
      'Pocket Dictionary of Theological Terms',
      'The New Bible Dictionary',
      'The New Bible Dictionary,',
      'The Westminster Dictionary of Church History',
      'Theological Wordbook of the Old Testament',
      'The IVP Bible Background Commentary New Testament',
      'The IVP Bible Background Commentary Old Testament',
      'Cassell''s Latin Dictionary',
      'Latin and English Dictionary',
      'Analytical Greek Lexicon of the New Testament',
      'Greek English Lexicon of the New Testament',
      'The Analytical Hebrew and Chaldee Lexicon',
      'The Brown Driver-Briggs Hebrew and English Lexicon',
      'Pocket Dictionary for the Study of New Testament Greek'
    )
    OR EXISTS (
      SELECT 1 FROM public.series s
      WHERE s.id = b.series_id
        AND s.abbreviation IN ('HALOT', 'TWOT', 'IVPBBC', 'IVP')
        AND b.genre IN (
          'Biblical Reference',
          'Hebrew Language Tools',
          'Greek Language Tools',
          'Latin Language Tools'
        )
    )
  );

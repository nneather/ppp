-- work_type distinguishes monographs from edited volumes and reference works
-- (dictionaries/encyclopedias) for Turabian dispatch and review validation.

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS work_type TEXT NOT NULL DEFAULT 'monograph'
    CHECK (work_type IN ('monograph', 'edited_volume', 'reference_work'));

COMMENT ON COLUMN public.books.work_type IS
  'monograph = author(s); edited_volume = essay collection cited via editor; reference_work = dictionary/encyclopedia/lexicon (future: s.v. citations + signed entries via essays).';

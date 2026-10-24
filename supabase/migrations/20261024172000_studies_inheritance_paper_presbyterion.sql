-- Fill Presbyterion 51.2 pages on the inheritance paper note.
-- The first migration is already applied; this only updates the note.

UPDATE public.papers
SET notes = 'NT305 term paper, Covenant Theological Seminary, submitted 7 May 2025. Published in Presbyterion 51.2 (Fall 2025): 121–126.'
WHERE deleted_at IS NULL
	AND title = 'Our Share of the Inheritance: The Lord is my Portion; Indeed, I have a Beautiful Inheritance';

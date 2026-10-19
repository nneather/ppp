-- library_weima_name_parts: Jeffrey A. D. Weima.
-- middle 'A. D.' denorms to "Jeffrey A. Weima" via left(middle, 1).
-- Match J. N. D. Kelly / J. Robert Wright: given name plus initials in first_name.
-- Refreshes books.author_display via people_list_denorm_refresh. DML-only.

UPDATE public.people
SET first_name = 'Jeffrey A. D.', middle_name = NULL, updated_at = now()
WHERE deleted_at IS NULL
	AND first_name = 'Jeffrey'
	AND middle_name = 'A. D.'
	AND last_name = 'Weima';

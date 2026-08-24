-- library_aug24_wright_name_parts: ACCS IX editor is J. Robert Wright, not J. R.
-- first_name 'J.' + middle 'Robert' denorms to "J. R. Wright" via left(middle,1).
-- Match J. B. Lightfoot / J. N. D. Kelly: given names in first_name, middle NULL.
-- Refreshes books.author_display via people_list_denorm_refresh. DML-only.

UPDATE public.people
SET first_name = 'J. Robert', middle_name = NULL
WHERE deleted_at IS NULL
	AND first_name = 'J.'
	AND middle_name = 'Robert'
	AND last_name = 'Wright';

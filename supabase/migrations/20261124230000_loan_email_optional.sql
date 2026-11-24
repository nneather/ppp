-- A checkout can be recorded with no address. Mail is skipped until one exists.

alter table public.book_loans
	alter column recipient_email drop not null;

alter table public.book_loans
	drop constraint if exists book_loans_email_shape;

alter table public.book_loans
	add constraint book_loans_email_shape check (
		recipient_email is null
		or recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
	);

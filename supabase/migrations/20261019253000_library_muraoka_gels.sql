-- library_muraoka_gels: T. Muraoka, A Greek-English Lexicon of the Septuagint
-- (Peeters, 2009). Same title as Lust/Eynikel/Hauspie; natural key is ISBN.
-- Include on Septuagint studies. Dismiss from NT language tools so the
-- Greek Language Tools genre rule does not surface it there.
-- Idempotent. DML only. Hosted push only.

begin;

insert into public.books (
	title, publisher, publisher_id, publisher_location,
	year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
select
	'A Greek-English Lexicon of the Septuagint',
	'Peeters',
	(
		select p.id from public.publishers p
		where p.canonical_name = 'Peeters' and p.deleted_at is null
		order by p.created_at
		limit 1
	),
	'Louvain',
	2009,
	'9789042922488',
	'Greek Language Tools',
	'monograph',
	'english',
	'reference',
	false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
where not exists (
	select 1 from public.books b
	where b.deleted_at is null
		and b.isbn = '9789042922488'
);

-- Reuse the existing T. Muraoka person (Joüon grammar). Do not add Takamitsu.
insert into public.book_authors (book_id, person_id, role, sort_order)
select b.id, p.id, 'author', 0
from public.books b
join public.people p
	on p.deleted_at is null
	and p.first_name = 'T.'
	and p.middle_name is null
	and p.last_name = 'Muraoka'
where b.deleted_at is null
	and b.isbn = '9789042922488'
	and not exists (
		select 1 from public.book_authors ba
		where ba.book_id = b.id and ba.person_id = p.id
	);

insert into public.resource_set_members (set_id, book_id, kind, bibliographical, created_by)
select rs.id, b.id, 'include', true, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
from public.books b
join public.resource_sets rs
	on rs.slug = 'septuagint-studies' and rs.deleted_at is null
where b.deleted_at is null
	and b.isbn = '9789042922488'
	and not exists (
		select 1 from public.resource_set_members m
		where m.set_id = rs.id and m.book_id = b.id and m.deleted_at is null
	);

insert into public.resource_set_members (set_id, book_id, kind, created_by)
select rs.id, b.id, 'dismiss', 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
from public.books b
join public.resource_sets rs
	on rs.slug = 'nt-language-tools' and rs.deleted_at is null
where b.deleted_at is null
	and b.isbn = '9789042922488'
	and not exists (
		select 1 from public.resource_set_members m
		where m.set_id = rs.id and m.book_id = b.id and m.deleted_at is null
	);

commit;

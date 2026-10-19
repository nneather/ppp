-- library_girdlestone_ot_synonyms: Robert B. Girdlestone,
-- Synonyms of the Old Testament (Eerdmans, 1981 reproduction of 1897).
-- Catalog shape matches Synonyms of the New Testament (short title,
-- middle initial, no series, monograph, reference).
-- Idempotent. DML only. Hosted push only.

begin;

insert into public.people (first_name, middle_name, last_name, created_by)
select 'Robert', 'B.', 'Girdlestone', 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
where not exists (
	select 1 from public.people p
	where p.deleted_at is null
		and p.first_name = 'Robert'
		and p.middle_name = 'B.'
		and p.last_name = 'Girdlestone'
);

insert into public.books (
	title, publisher, publisher_id, publisher_location,
	year, original_year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
select
	'Synonyms of the Old Testament',
	'Eerdmans',
	(
		select p.id from public.publishers p
		where p.canonical_name = 'Eerdmans' and p.deleted_at is null
		order by p.created_at
		limit 1
	),
	'Grand Rapids, MI',
	1981,
	1897,
	'9780802815484',
	'Hebrew Language Tools',
	'monograph',
	'english',
	'reference',
	false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
where not exists (
	select 1 from public.books b
	where b.deleted_at is null
		and b.title = 'Synonyms of the Old Testament'
		and b.series_id is null
);

insert into public.book_authors (book_id, person_id, role, sort_order)
select b.id, p.id, 'author', 0
from public.books b
join public.people p
	on p.deleted_at is null
	and p.first_name = 'Robert'
	and p.middle_name = 'B.'
	and p.last_name = 'Girdlestone'
where b.deleted_at is null
	and b.title = 'Synonyms of the Old Testament'
	and b.series_id is null
	and not exists (
		select 1 from public.book_authors ba
		where ba.book_id = b.id and ba.person_id = p.id
	);

commit;

-- Move Literature → Children's and Young Adult for clear kids/YA clusters (Batch 6 follow-on).
-- Borderline (Hobbit, Ender's Game, Catcher, Verne) stay Literature per owner.

UPDATE public.books b
SET genre = 'Children''s and Young Adult', updated_at = now()
WHERE b.deleted_at IS NULL
	AND b.genre = 'Literature'
	AND (
		-- A. Redwall / Jacques
		EXISTS (
			SELECT 1
			FROM public.book_authors ba
			JOIN public.people pe ON pe.id = ba.person_id
			WHERE ba.book_id = b.id
				AND pe.last_name = 'Jacques'
		)
		-- B. Harry Potter
		OR b.title ILIKE 'Harry Potter%'
		-- C. Narnia (not Space Trilogy / adult Lewis)
		OR b.title IN (
			'Prince Caspian',
			'The Horse and His Boy',
			'The Last Battle',
			'The Lion, the Witch, and the Wardrobe',
			'The Magician''s Nephew',
			'The Silver Chair',
			'Voyage of the Dawn Treader'
		)
		-- D. Classic kids
		OR b.title IN (
			'Alice in Wonderland',
			'The Wonderful Wizard of Oz',
			'Horton Hears a Who',
			'Charlie and the Chocolate Factory',
			'The Phantom Tollboth',
			'Grimm''s Fairy Tales',
			'Kinder- und Hausmärchen',
			'Die Bremer Stadtmusikanten',
			'Emil und die Detektive'
		)
		-- E. L''Engle
		OR b.title IN (
			'A Wind in the Door',
			'The Wrinkle in Time'
		)
		-- F. Peter & the Starcatchers / Barry–Pearson kids
		OR b.title IN (
			'Blood Tide',
			'Cave of the Dark Wind',
			'Escape from the Carnivale',
			'Peter and the Secret of Rundoon',
			'Peter and the Shadow Thieves',
			'Peter and the Starcatchers',
			'Peter and the Sword of Mercy'
		)
		-- G. Other likely YA
		OR b.title IN (
			'Across Five Aprils',
			'Muddle Earth',
			'The Time Quake',
			'The Time Thief',
			'The Time Travelers',
			'Mein erster Flug',
			'Ben liebt Anna',
			'Die Flaschenpost',
			'The Orphan Queen',
			'See How They Run',
			'Adventures of Huckleberry Finn'
		)
	);

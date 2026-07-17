-- Library commentary bible coverage cleanup (088)
-- Assign book_bible_coverage from Commentary titles; IVP Background → Biblical Reference;
-- NIB Vol X essays (Boring/Wright/Sampley) + coverage.
-- Idempotent: coverage inserts guarded by NOT EXISTS; essay/people likewise.

-- ---------------------------------------------------------------------------
-- IVP Bible Background Commentary → Biblical Reference (no coverage)
-- ---------------------------------------------------------------------------
UPDATE public.books
SET genre = 'Biblical Reference', updated_at = now()
WHERE id = '43a91670-3ddc-4f00-b4bc-e32cfaf754a6' AND deleted_at IS NULL AND genre = 'Commentary';

UPDATE public.books
SET genre = 'Biblical Reference', updated_at = now()
WHERE id = '563393a2-029a-4f9a-a15f-afaee072337a' AND deleted_at IS NULL AND genre = 'Commentary';

-- ---------------------------------------------------------------------------
-- book_bible_coverage inserts (missing books only)
-- ---------------------------------------------------------------------------
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT v.book_id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('3bc34859-27df-4ff7-b66e-b2656f3f7878'::uuid, '1 Kings'),
	('3bc34859-27df-4ff7-b66e-b2656f3f7878'::uuid, '2 Kings'),
	('976de395-1e0e-41d5-82ed-eacf1c701229'::uuid, '1 Kings'),
	('976de395-1e0e-41d5-82ed-eacf1c701229'::uuid, '2 Kings'),
	('976de395-1e0e-41d5-82ed-eacf1c701229'::uuid, '1 Chronicles'),
	('976de395-1e0e-41d5-82ed-eacf1c701229'::uuid, '2 Chronicles'),
	('bb2fa211-c979-4751-998e-a62e1c401630'::uuid, '1 Samuel'),
	('bb2fa211-c979-4751-998e-a62e1c401630'::uuid, '2 Samuel'),
	('18df1e47-ddc0-41d7-8d48-cf3424dec70d'::uuid, '1 Kings'),
	('18df1e47-ddc0-41d7-8d48-cf3424dec70d'::uuid, '2 Kings'),
	('dae86d9b-ff41-4c65-bbd4-15be4f2b84fa'::uuid, '1 Peter'),
	('dae86d9b-ff41-4c65-bbd4-15be4f2b84fa'::uuid, '2 Peter'),
	('dae86d9b-ff41-4c65-bbd4-15be4f2b84fa'::uuid, 'Jude'),
	('b0afbe7a-734d-41c0-b52b-6dc170774564'::uuid, '1 Samuel'),
	('b0afbe7a-734d-41c0-b52b-6dc170774564'::uuid, '2 Samuel'),
	('b63c73cd-2d23-47ae-b1b4-aefa99ac6f0b'::uuid, '1 Samuel'),
	('b63c73cd-2d23-47ae-b1b4-aefa99ac6f0b'::uuid, '2 Samuel'),
	('d77461db-b6d5-417d-975f-345592d1ff6e'::uuid, '1 Thessalonians'),
	('d77461db-b6d5-417d-975f-345592d1ff6e'::uuid, '2 Thessalonians'),
	('95cafcd1-0bf0-4fa1-b585-cadaa69c7ff6'::uuid, '1 Thessalonians'),
	('95cafcd1-0bf0-4fa1-b585-cadaa69c7ff6'::uuid, '2 Thessalonians'),
	('331d7521-7ed3-445a-bcad-6f60ca8574a5'::uuid, '1 Timothy'),
	('331d7521-7ed3-445a-bcad-6f60ca8574a5'::uuid, '2 Timothy'),
	('331d7521-7ed3-445a-bcad-6f60ca8574a5'::uuid, 'Titus'),
	('c52d5b1a-4c29-47cb-a46f-3059c330686d'::uuid, '1 Kings'),
	('00ab3892-8ab6-4466-9c4a-25f52cbeccb6'::uuid, '1 Peter'),
	('ec18eb0a-9fec-49ba-8c22-d047b0db48ac'::uuid, '1 Peter'),
	('2de5d0a2-e5d4-4302-bc4d-7e3ad7cb7cd4'::uuid, '1 Samuel'),
	('2de5d0a2-e5d4-4302-bc4d-7e3ad7cb7cd4'::uuid, '2 Samuel'),
	('2de5d0a2-e5d4-4302-bc4d-7e3ad7cb7cd4'::uuid, '1 Kings'),
	('2de5d0a2-e5d4-4302-bc4d-7e3ad7cb7cd4'::uuid, '2 Kings'),
	('2de5d0a2-e5d4-4302-bc4d-7e3ad7cb7cd4'::uuid, '1 Chronicles'),
	('2de5d0a2-e5d4-4302-bc4d-7e3ad7cb7cd4'::uuid, '2 Chronicles'),
	('62d8cfd1-2f04-42f3-9f04-2a3da11d65b3'::uuid, '1 Chronicles'),
	('3bf43427-28e0-4531-a37b-cd4118715230'::uuid, '1 Kings'),
	('3bf43427-28e0-4531-a37b-cd4118715230'::uuid, '2 Kings'),
	('f607a8ab-1f21-469d-9510-d482e8643962'::uuid, '1 John'),
	('f607a8ab-1f21-469d-9510-d482e8643962'::uuid, '2 John'),
	('f607a8ab-1f21-469d-9510-d482e8643962'::uuid, '3 John'),
	('7d43c2c5-2208-4a0d-b4a1-a48ddbe5e864'::uuid, '1 John'),
	('7d43c2c5-2208-4a0d-b4a1-a48ddbe5e864'::uuid, '2 John'),
	('7d43c2c5-2208-4a0d-b4a1-a48ddbe5e864'::uuid, '3 John'),
	('c9ed84b7-9edf-4d1a-a238-6660310fba78'::uuid, '2 Corinthians'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, 'Romans'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, '1 Corinthians'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, '2 Corinthians'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, 'Galatians'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, 'Ephesians'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, 'Philippians'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, 'Colossians'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, '1 Thessalonians'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, '2 Thessalonians'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, '1 Timothy'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, '2 Timothy'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, 'Titus'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, 'Philemon'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, 'Hebrews'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, 'James'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, '1 Peter'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, '2 Peter'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, '1 John'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, '2 John'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, '3 John'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, 'Jude'),
	('f26e671b-86e0-4d97-85da-a762386f3010'::uuid, 'Revelation'),
	('4d8435bc-8b91-474f-b410-f5b8bf7d8afa'::uuid, 'Philemon'),
	('a21f8f78-e6f7-4e88-980e-9fd44ce86a50'::uuid, 'Matthew'),
	('d1b907fb-1c27-41f9-80be-f2ed98345ee5'::uuid, 'Hebrews'),
	('89d894e4-0c38-48b0-90fd-6eb10a96deef'::uuid, 'Galatians'),
	('70ae1833-8d4b-4826-b828-35c2179d94e7'::uuid, 'Daniel'),
	('70ae1833-8d4b-4826-b828-35c2179d94e7'::uuid, 'Hosea'),
	('3a0b1085-7f04-4544-aca0-fb5214da564f'::uuid, 'Daniel'),
	('3a0b1085-7f04-4544-aca0-fb5214da564f'::uuid, 'Hosea'),
	('3a0b1085-7f04-4544-aca0-fb5214da564f'::uuid, 'Joel'),
	('3a0b1085-7f04-4544-aca0-fb5214da564f'::uuid, 'Amos'),
	('3a0b1085-7f04-4544-aca0-fb5214da564f'::uuid, 'Obadiah'),
	('3a0b1085-7f04-4544-aca0-fb5214da564f'::uuid, 'Jonah'),
	('3a0b1085-7f04-4544-aca0-fb5214da564f'::uuid, 'Micah'),
	('3a0b1085-7f04-4544-aca0-fb5214da564f'::uuid, 'Nahum'),
	('3a0b1085-7f04-4544-aca0-fb5214da564f'::uuid, 'Habakkuk'),
	('3a0b1085-7f04-4544-aca0-fb5214da564f'::uuid, 'Zephaniah'),
	('3a0b1085-7f04-4544-aca0-fb5214da564f'::uuid, 'Haggai'),
	('3a0b1085-7f04-4544-aca0-fb5214da564f'::uuid, 'Zechariah'),
	('3a0b1085-7f04-4544-aca0-fb5214da564f'::uuid, 'Malachi'),
	('4d64bcfe-1b07-46fb-b199-a62f154ea025'::uuid, 'Mark'),
	('bf83e2c1-52b4-4373-8858-8362390385fb'::uuid, '1 Corinthians'),
	('cb5878bc-09b2-4ad7-a063-4e4c203c4676'::uuid, 'Romans'),
	('29937c6b-5050-4320-9e55-ff870471d15c'::uuid, 'Deuteronomy'),
	('d31e7efb-71d0-4b4c-9bf4-7b6c2a2827f3'::uuid, 'Deuteronomy'),
	('6eacc77e-4cc0-4d22-9ecd-9b0605efd0bf'::uuid, 'Deuteronomy'),
	('9a301dff-111c-459c-a9e7-d419fba08c5f'::uuid, 'Deuteronomy'),
	('21549a88-6cb4-4469-859e-8199caaa22a7'::uuid, 'Deuteronomy'),
	('21549a88-6cb4-4469-859e-8199caaa22a7'::uuid, 'Joshua'),
	('21549a88-6cb4-4469-859e-8199caaa22a7'::uuid, 'Judges'),
	('21549a88-6cb4-4469-859e-8199caaa22a7'::uuid, 'Ruth'),
	('bcf40c29-db0b-4914-a32a-a007801f6bbb'::uuid, 'Ephesians'),
	('c73aa498-80da-4d83-9236-b2877b473ff4'::uuid, 'Ephesians'),
	('dccd6f17-6e4f-41cc-a8f5-b6de5ec1879e'::uuid, 'Ephesians'),
	('2aa3de3d-dd90-4203-9c3c-221e19ef9ed6'::uuid, 'Ephesians'),
	('2aa3de3d-dd90-4203-9c3c-221e19ef9ed6'::uuid, 'Philippians'),
	('2aa3de3d-dd90-4203-9c3c-221e19ef9ed6'::uuid, 'Colossians'),
	('2aa3de3d-dd90-4203-9c3c-221e19ef9ed6'::uuid, '1 Thessalonians'),
	('2aa3de3d-dd90-4203-9c3c-221e19ef9ed6'::uuid, '2 Thessalonians'),
	('2aa3de3d-dd90-4203-9c3c-221e19ef9ed6'::uuid, '1 Timothy'),
	('2aa3de3d-dd90-4203-9c3c-221e19ef9ed6'::uuid, '2 Timothy'),
	('2aa3de3d-dd90-4203-9c3c-221e19ef9ed6'::uuid, 'Titus'),
	('2aa3de3d-dd90-4203-9c3c-221e19ef9ed6'::uuid, 'Philemon'),
	('e0a59733-bb04-4720-a75f-502a5e09253c'::uuid, 'Ephesians'),
	('e0a59733-bb04-4720-a75f-502a5e09253c'::uuid, 'Philemon'),
	('13e147b6-9835-418e-aeb1-7c1606edb420'::uuid, 'Esther'),
	('8fe47941-7968-4e4f-ad74-7317a63ed24a'::uuid, 'Exodus'),
	('a9b1e6fa-9de3-410f-9d40-f485464d0e9b'::uuid, 'Exodus'),
	('d5f6d22a-946c-4ba5-858a-e373399f3394'::uuid, 'Exodus'),
	('f2ef6fa7-f9a4-4d9d-a19b-ff590529a906'::uuid, 'Ezekiel'),
	('f2ef6fa7-f9a4-4d9d-a19b-ff590529a906'::uuid, 'Daniel'),
	('d777380a-eaf9-4089-81e0-9c52a8ccc38d'::uuid, 'Ezekiel'),
	('d777380a-eaf9-4089-81e0-9c52a8ccc38d'::uuid, 'Daniel'),
	('63daab45-780a-464c-9518-f2d51e9cacf0'::uuid, 'Ezra'),
	('18d2990e-1968-45e9-96a1-2473832548ee'::uuid, 'Ezra'),
	('18d2990e-1968-45e9-96a1-2473832548ee'::uuid, 'Nehemiah'),
	('1c21dbae-aaca-41fd-a4ff-5dd719867b85'::uuid, 'Ezra'),
	('1c21dbae-aaca-41fd-a4ff-5dd719867b85'::uuid, 'Nehemiah'),
	('0ca27bf7-333f-434c-b5be-96559924141f'::uuid, 'Ezra'),
	('0ca27bf7-333f-434c-b5be-96559924141f'::uuid, 'Nehemiah'),
	('0ca27bf7-333f-434c-b5be-96559924141f'::uuid, 'Esther'),
	('0ca27bf7-333f-434c-b5be-96559924141f'::uuid, 'Job'),
	('efc8cfef-b26f-46cf-9c0a-96f6cc711f9c'::uuid, 'Ezra'),
	('efc8cfef-b26f-46cf-9c0a-96f6cc711f9c'::uuid, 'Nehemiah'),
	('efc8cfef-b26f-46cf-9c0a-96f6cc711f9c'::uuid, 'Esther'),
	('efc8cfef-b26f-46cf-9c0a-96f6cc711f9c'::uuid, 'Job'),
	('e8cb4962-588c-455e-970a-3b6463c4b8a2'::uuid, 'Galatians'),
	('6674c886-7e32-4790-a04a-b971bff765d1'::uuid, 'Galatians'),
	('6674c886-7e32-4790-a04a-b971bff765d1'::uuid, 'Ephesians'),
	('6674c886-7e32-4790-a04a-b971bff765d1'::uuid, 'Philippians'),
	('6674c886-7e32-4790-a04a-b971bff765d1'::uuid, 'Colossians'),
	('6674c886-7e32-4790-a04a-b971bff765d1'::uuid, '1 Thessalonians'),
	('6674c886-7e32-4790-a04a-b971bff765d1'::uuid, '2 Thessalonians'),
	('6674c886-7e32-4790-a04a-b971bff765d1'::uuid, '1 Timothy'),
	('6674c886-7e32-4790-a04a-b971bff765d1'::uuid, '2 Timothy'),
	('6674c886-7e32-4790-a04a-b971bff765d1'::uuid, 'Titus'),
	('6674c886-7e32-4790-a04a-b971bff765d1'::uuid, 'Philemon'),
	('3ee3ca20-c8d1-4b4b-be8b-69ab396a451e'::uuid, 'Galatians'),
	('3ee3ca20-c8d1-4b4b-be8b-69ab396a451e'::uuid, 'Ephesians'),
	('8337b373-0af0-4ebc-90d2-b1f3edf9031a'::uuid, 'Exodus'),
	('8337b373-0af0-4ebc-90d2-b1f3edf9031a'::uuid, 'Leviticus'),
	('8337b373-0af0-4ebc-90d2-b1f3edf9031a'::uuid, 'Numbers'),
	('8337b373-0af0-4ebc-90d2-b1f3edf9031a'::uuid, 'Deuteronomy'),
	('5cc86a2f-fd7e-4e59-a7b5-cda3adad2669'::uuid, 'Exodus'),
	('5cc86a2f-fd7e-4e59-a7b5-cda3adad2669'::uuid, 'Leviticus'),
	('5cc86a2f-fd7e-4e59-a7b5-cda3adad2669'::uuid, 'Numbers'),
	('1e2d3394-99b3-4862-b4ed-09a48314e847'::uuid, 'Genesis'),
	('d6361c8c-2b04-4a96-bb4a-caba9fc012e7'::uuid, 'Habakkuk'),
	('d6361c8c-2b04-4a96-bb4a-caba9fc012e7'::uuid, 'Zephaniah'),
	('d6361c8c-2b04-4a96-bb4a-caba9fc012e7'::uuid, 'Haggai'),
	('d6361c8c-2b04-4a96-bb4a-caba9fc012e7'::uuid, 'Zechariah'),
	('d6361c8c-2b04-4a96-bb4a-caba9fc012e7'::uuid, 'Malachi'),
	('a0b67590-f240-4315-8a7e-9b1c4bc1de5c'::uuid, 'Exodus'),
	('a0b67590-f240-4315-8a7e-9b1c4bc1de5c'::uuid, 'Leviticus'),
	('a0b67590-f240-4315-8a7e-9b1c4bc1de5c'::uuid, 'Numbers'),
	('a0b67590-f240-4315-8a7e-9b1c4bc1de5c'::uuid, 'Deuteronomy'),
	('c723b97b-04db-4779-a47a-ef11df38724a'::uuid, 'Exodus'),
	('c723b97b-04db-4779-a47a-ef11df38724a'::uuid, 'Leviticus'),
	('c723b97b-04db-4779-a47a-ef11df38724a'::uuid, 'Numbers'),
	('c723b97b-04db-4779-a47a-ef11df38724a'::uuid, 'Deuteronomy'),
	('1d0ba45c-8570-41c2-8fe7-68b8d0562aae'::uuid, 'Hebrews'),
	('1662a3cc-a4c7-4ae5-b30a-4a3d4ae877cc'::uuid, 'Hebrews'),
	('bc780c01-c7d7-46e5-945e-814f9b89bf6f'::uuid, 'Hebrews'),
	('bc780c01-c7d7-46e5-945e-814f9b89bf6f'::uuid, 'James'),
	('bc780c01-c7d7-46e5-945e-814f9b89bf6f'::uuid, '1 Peter'),
	('bc780c01-c7d7-46e5-945e-814f9b89bf6f'::uuid, '2 Peter'),
	('bc780c01-c7d7-46e5-945e-814f9b89bf6f'::uuid, '1 John'),
	('bc780c01-c7d7-46e5-945e-814f9b89bf6f'::uuid, '2 John'),
	('bc780c01-c7d7-46e5-945e-814f9b89bf6f'::uuid, '3 John'),
	('bc780c01-c7d7-46e5-945e-814f9b89bf6f'::uuid, 'Jude'),
	('bc780c01-c7d7-46e5-945e-814f9b89bf6f'::uuid, 'Revelation'),
	('4651a20b-b178-424f-b31f-68c6fe9edf83'::uuid, 'Hebrews'),
	('4651a20b-b178-424f-b31f-68c6fe9edf83'::uuid, 'James'),
	('4651a20b-b178-424f-b31f-68c6fe9edf83'::uuid, '1 Peter'),
	('4651a20b-b178-424f-b31f-68c6fe9edf83'::uuid, '2 Peter'),
	('4651a20b-b178-424f-b31f-68c6fe9edf83'::uuid, '1 John'),
	('4651a20b-b178-424f-b31f-68c6fe9edf83'::uuid, 'Jude'),
	('722607c9-7be4-4d09-8211-50eaa1f89516'::uuid, 'Hosea'),
	('722607c9-7be4-4d09-8211-50eaa1f89516'::uuid, 'Joel'),
	('722607c9-7be4-4d09-8211-50eaa1f89516'::uuid, 'Amos'),
	('722607c9-7be4-4d09-8211-50eaa1f89516'::uuid, 'Obadiah'),
	('722607c9-7be4-4d09-8211-50eaa1f89516'::uuid, 'Jonah'),
	('01fb2795-22f5-43d5-ba85-7ce5397c8fbb'::uuid, '1 Chronicles'),
	('01fb2795-22f5-43d5-ba85-7ce5397c8fbb'::uuid, '2 Chronicles'),
	('dac61b60-b2a4-4494-99a7-e74511193c4e'::uuid, 'Isaiah'),
	('4beef45a-d742-4d8f-9b23-020e8702a42a'::uuid, 'Isaiah'),
	('7772aedc-0d45-42d1-9f08-24be6282d972'::uuid, 'Isaiah'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Isaiah'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Jeremiah'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Lamentations'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Ezekiel'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Daniel'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Hosea'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Joel'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Amos'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Obadiah'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Jonah'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Micah'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Nahum'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Habakkuk'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Zephaniah'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Haggai'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Zechariah'),
	('ac211e8e-1c6d-49fa-a479-63c52bbde1bc'::uuid, 'Malachi'),
	('e22cfc63-eaa7-4a23-b559-1ad7b45138df'::uuid, 'Isaiah'),
	('e22cfc63-eaa7-4a23-b559-1ad7b45138df'::uuid, 'Jeremiah'),
	('e22cfc63-eaa7-4a23-b559-1ad7b45138df'::uuid, 'Lamentations'),
	('e22cfc63-eaa7-4a23-b559-1ad7b45138df'::uuid, 'Ezekiel'),
	('933d2ec8-2ea9-4d21-b15c-ab5f347785d2'::uuid, 'James'),
	('a098f663-2d92-4dee-82da-b2056f7de0e8'::uuid, 'James'),
	('40e4e228-30b3-4936-b65a-8196d926f05a'::uuid, 'James'),
	('6b044a1c-285e-4f77-a887-f74a7026e342'::uuid, 'Jeremiah'),
	('c0c30a93-6dd7-445c-8599-114586e9b5c5'::uuid, 'Jeremiah'),
	('530feacb-05be-4e70-b496-f4f4d4639f14'::uuid, 'Jeremiah'),
	('5c66ccb7-ac03-402c-affe-4a280280597b'::uuid, 'Jeremiah'),
	('3ded3928-a7b0-4926-8c44-92a2e6e8e9ec'::uuid, 'Jeremiah'),
	('3ded3928-a7b0-4926-8c44-92a2e6e8e9ec'::uuid, 'Lamentations'),
	('3ded3928-a7b0-4926-8c44-92a2e6e8e9ec'::uuid, 'Ezekiel'),
	('24fd6b7c-daca-457e-bcf3-ccfa33490441'::uuid, 'Jeremiah'),
	('24fd6b7c-daca-457e-bcf3-ccfa33490441'::uuid, 'Lamentations'),
	('aecaedd5-8419-402e-9ee3-189ec1883c6b'::uuid, 'Job'),
	('aecaedd5-8419-402e-9ee3-189ec1883c6b'::uuid, 'Psalms'),
	('aecaedd5-8419-402e-9ee3-189ec1883c6b'::uuid, 'Proverbs'),
	('aecaedd5-8419-402e-9ee3-189ec1883c6b'::uuid, 'Ecclesiastes'),
	('aecaedd5-8419-402e-9ee3-189ec1883c6b'::uuid, 'Song of Songs'),
	('700be0c0-bfe5-4850-98a6-13f39421c2f9'::uuid, 'Joel'),
	('700be0c0-bfe5-4850-98a6-13f39421c2f9'::uuid, 'Amos'),
	('700be0c0-bfe5-4850-98a6-13f39421c2f9'::uuid, 'Obadiah'),
	('700be0c0-bfe5-4850-98a6-13f39421c2f9'::uuid, 'Jonah'),
	('700be0c0-bfe5-4850-98a6-13f39421c2f9'::uuid, 'Micah'),
	('700be0c0-bfe5-4850-98a6-13f39421c2f9'::uuid, 'Nahum'),
	('0019dde9-cfdc-4f1b-a146-ee71a170e585'::uuid, 'John'),
	('0019dde9-cfdc-4f1b-a146-ee71a170e585'::uuid, 'Acts'),
	('27a9f268-56b4-4e0c-a4b1-c8cee3b02224'::uuid, 'Jonah'),
	('a0d9f982-faae-4133-aa1a-0ba16a952385'::uuid, 'Joshua'),
	('c500f43b-23a5-4e3f-9c81-8e36743811fa'::uuid, 'Joshua'),
	('f580615f-7498-48c6-8614-e22fbdc9f926'::uuid, 'Joshua'),
	('f580615f-7498-48c6-8614-e22fbdc9f926'::uuid, 'Judges'),
	('f580615f-7498-48c6-8614-e22fbdc9f926'::uuid, 'Ruth'),
	('f580615f-7498-48c6-8614-e22fbdc9f926'::uuid, '1 Samuel'),
	('f580615f-7498-48c6-8614-e22fbdc9f926'::uuid, '2 Samuel'),
	('f580615f-7498-48c6-8614-e22fbdc9f926'::uuid, '1 Kings'),
	('f580615f-7498-48c6-8614-e22fbdc9f926'::uuid, '2 Kings'),
	('f580615f-7498-48c6-8614-e22fbdc9f926'::uuid, '1 Chronicles'),
	('f580615f-7498-48c6-8614-e22fbdc9f926'::uuid, '2 Chronicles'),
	('f580615f-7498-48c6-8614-e22fbdc9f926'::uuid, 'Ezra'),
	('f580615f-7498-48c6-8614-e22fbdc9f926'::uuid, 'Nehemiah'),
	('f580615f-7498-48c6-8614-e22fbdc9f926'::uuid, 'Esther'),
	('7c8876a4-bf67-4518-a23f-6ca2a45a9ad6'::uuid, 'Joshua'),
	('7c8876a4-bf67-4518-a23f-6ca2a45a9ad6'::uuid, 'Judges'),
	('7c8876a4-bf67-4518-a23f-6ca2a45a9ad6'::uuid, 'Ruth'),
	('7c8876a4-bf67-4518-a23f-6ca2a45a9ad6'::uuid, '1 Samuel'),
	('7c8876a4-bf67-4518-a23f-6ca2a45a9ad6'::uuid, '2 Samuel'),
	('8d3cd5ac-00ab-451e-8585-97a73d7bde78'::uuid, 'Joshua'),
	('8d3cd5ac-00ab-451e-8585-97a73d7bde78'::uuid, 'Psalms'),
	('c4e76dc9-6dd0-4f52-a990-46db60775a09'::uuid, 'Judges'),
	('16383efb-3504-47db-a926-56fafd145491'::uuid, 'Judges'),
	('7648a81f-503e-4ef4-b8c3-572b0c6e558b'::uuid, 'Judges'),
	('7648a81f-503e-4ef4-b8c3-572b0c6e558b'::uuid, 'Ruth'),
	('37e6aa00-94ee-42bf-bc38-6b64b54f4c52'::uuid, 'Leviticus'),
	('6c5b8059-0803-43a8-a9d6-13852de5d893'::uuid, 'Leviticus'),
	('5efabe52-5fb9-40fb-8d65-3e5dc75ae5e2'::uuid, 'Leviticus'),
	('bbd8c822-685b-4b30-84e3-8e20ad74dee5'::uuid, 'Matthew'),
	('bbd8c822-685b-4b30-84e3-8e20ad74dee5'::uuid, 'Mark'),
	('bbd8c822-685b-4b30-84e3-8e20ad74dee5'::uuid, 'Luke'),
	('f7630d48-86b2-46fe-96a4-d3fd1b809de6'::uuid, 'Micah'),
	('f7630d48-86b2-46fe-96a4-d3fd1b809de6'::uuid, 'Nahum'),
	('f7630d48-86b2-46fe-96a4-d3fd1b809de6'::uuid, 'Habakkuk'),
	('f7630d48-86b2-46fe-96a4-d3fd1b809de6'::uuid, 'Zephaniah'),
	('f7630d48-86b2-46fe-96a4-d3fd1b809de6'::uuid, 'Haggai'),
	('f7630d48-86b2-46fe-96a4-d3fd1b809de6'::uuid, 'Zechariah'),
	('f7630d48-86b2-46fe-96a4-d3fd1b809de6'::uuid, 'Malachi'),
	('0e25726d-f773-4117-96d2-b097850c31e6'::uuid, 'Hosea'),
	('0e25726d-f773-4117-96d2-b097850c31e6'::uuid, 'Joel'),
	('0e25726d-f773-4117-96d2-b097850c31e6'::uuid, 'Amos'),
	('0e25726d-f773-4117-96d2-b097850c31e6'::uuid, 'Obadiah'),
	('0e25726d-f773-4117-96d2-b097850c31e6'::uuid, 'Jonah'),
	('0e25726d-f773-4117-96d2-b097850c31e6'::uuid, 'Micah'),
	('0e25726d-f773-4117-96d2-b097850c31e6'::uuid, 'Nahum'),
	('0e25726d-f773-4117-96d2-b097850c31e6'::uuid, 'Habakkuk'),
	('0e25726d-f773-4117-96d2-b097850c31e6'::uuid, 'Zephaniah'),
	('0e25726d-f773-4117-96d2-b097850c31e6'::uuid, 'Haggai'),
	('0e25726d-f773-4117-96d2-b097850c31e6'::uuid, 'Zechariah'),
	('0e25726d-f773-4117-96d2-b097850c31e6'::uuid, 'Malachi'),
	('a77d73a1-5a00-418c-a23d-030c536d46ce'::uuid, 'Hosea'),
	('a77d73a1-5a00-418c-a23d-030c536d46ce'::uuid, 'Joel'),
	('a77d73a1-5a00-418c-a23d-030c536d46ce'::uuid, 'Amos'),
	('a77d73a1-5a00-418c-a23d-030c536d46ce'::uuid, 'Obadiah'),
	('a77d73a1-5a00-418c-a23d-030c536d46ce'::uuid, 'Jonah'),
	('a77d73a1-5a00-418c-a23d-030c536d46ce'::uuid, 'Micah'),
	('a77d73a1-5a00-418c-a23d-030c536d46ce'::uuid, 'Nahum'),
	('a77d73a1-5a00-418c-a23d-030c536d46ce'::uuid, 'Habakkuk'),
	('a77d73a1-5a00-418c-a23d-030c536d46ce'::uuid, 'Zephaniah'),
	('a77d73a1-5a00-418c-a23d-030c536d46ce'::uuid, 'Haggai'),
	('a77d73a1-5a00-418c-a23d-030c536d46ce'::uuid, 'Zechariah'),
	('a77d73a1-5a00-418c-a23d-030c536d46ce'::uuid, 'Malachi'),
	('806c25d4-1b2d-4681-8042-6c7a0a1708f4'::uuid, 'Nehemiah'),
	('3f78e12e-32ad-44c7-b443-2a53313595c6'::uuid, 'Acts'),
	('3f78e12e-32ad-44c7-b443-2a53313595c6'::uuid, 'Romans'),
	('3f78e12e-32ad-44c7-b443-2a53313595c6'::uuid, '1 Corinthians'),
	('daad41ee-cfdc-4121-8954-4357515ae33c'::uuid, 'Numbers'),
	('af4d2573-0669-4cb9-aa13-f6eaf4971b72'::uuid, 'Numbers'),
	('0050f89f-4c13-47e8-b038-2dfc86cdc8a1'::uuid, 'Numbers'),
	('f3dd4dd5-e1cc-4e25-8dc2-1c17c93046fe'::uuid, 'Genesis'),
	('f3dd4dd5-e1cc-4e25-8dc2-1c17c93046fe'::uuid, 'Exodus'),
	('f3dd4dd5-e1cc-4e25-8dc2-1c17c93046fe'::uuid, 'Leviticus'),
	('f3dd4dd5-e1cc-4e25-8dc2-1c17c93046fe'::uuid, 'Numbers'),
	('f3dd4dd5-e1cc-4e25-8dc2-1c17c93046fe'::uuid, 'Deuteronomy'),
	('d84cb371-a1bd-4266-ac83-4da16a232515'::uuid, 'Philippians'),
	('7a9061ba-9cdd-426c-bcec-5c672f39c9d6'::uuid, 'Philippians'),
	('c370cfd0-a80b-4d50-8497-ee11369ae666'::uuid, 'Philippians'),
	('61ee883e-73db-4b02-bf7e-2120f5c84fd4'::uuid, 'Proverbs'),
	('74158069-b8b1-435b-8f61-f70592c7327f'::uuid, 'Proverbs'),
	('74158069-b8b1-435b-8f61-f70592c7327f'::uuid, 'Ecclesiastes'),
	('74158069-b8b1-435b-8f61-f70592c7327f'::uuid, 'Song of Songs'),
	('73cd1b32-2440-45e3-a1b7-0e8e5cd9d316'::uuid, 'Proverbs'),
	('73cd1b32-2440-45e3-a1b7-0e8e5cd9d316'::uuid, 'Ecclesiastes'),
	('73cd1b32-2440-45e3-a1b7-0e8e5cd9d316'::uuid, 'Song of Songs'),
	('6e7363fa-a351-4328-9da3-ea77b61cf683'::uuid, 'Psalms'),
	('f38957cd-06af-48ff-9d94-ac8aec38699c'::uuid, 'Psalms'),
	('21fbb41d-a83c-4ae8-8288-c90e258157e1'::uuid, 'Psalms'),
	('b82e4d27-8ee8-447a-85bd-7632b08d5476'::uuid, 'Psalms'),
	('68d9a795-cf59-415e-8528-911f76f9b31e'::uuid, 'Psalms'),
	('32d948c8-9f0c-40bd-8f01-ef433905ab3c'::uuid, 'Psalms'),
	('32d948c8-9f0c-40bd-8f01-ef433905ab3c'::uuid, 'Proverbs'),
	('32d948c8-9f0c-40bd-8f01-ef433905ab3c'::uuid, 'Ecclesiastes'),
	('32d948c8-9f0c-40bd-8f01-ef433905ab3c'::uuid, 'Song of Songs'),
	('cb297087-ae10-4444-8e82-1a31ec5c5a7e'::uuid, 'Revelation'),
	('29c55270-be82-4f30-84d3-6023aca9c032'::uuid, 'Revelation'),
	('00bb1711-22b1-45aa-97cd-8da3d73d1c4c'::uuid, 'Romans'),
	('00bb1711-22b1-45aa-97cd-8da3d73d1c4c'::uuid, '1 Corinthians'),
	('00bb1711-22b1-45aa-97cd-8da3d73d1c4c'::uuid, '2 Corinthians'),
	('00bb1711-22b1-45aa-97cd-8da3d73d1c4c'::uuid, 'Galatians'),
	('961cdfb4-5934-4629-9f49-ac325b4b4526'::uuid, 'Ruth'),
	('e8f6101e-fd90-4743-998b-07d9af72b31e'::uuid, 'Ruth'),
	('e8f6101e-fd90-4743-998b-07d9af72b31e'::uuid, 'Esther'),
	('4e07c365-3971-4327-b125-314d966db1ec'::uuid, 'Leviticus'),
	('d755555c-224d-48f3-913a-6e3acfba28e3'::uuid, 'Numbers'),
	('ac4df541-c34a-486a-bee0-11a5b4a9bda1'::uuid, 'Revelation'),
	('23072da8-0a95-44ea-94d5-9a884a546136'::uuid, 'Revelation'),
	('44486c08-6688-4b89-8f35-cdf8afe9db67'::uuid, 'Ezra'),
	('44486c08-6688-4b89-8f35-cdf8afe9db67'::uuid, 'Nehemiah'),
	('bb0b01d8-ed29-4cdf-9e54-b9757db4a785'::uuid, 'Galatians'),
	('8a2fed76-f556-4a68-b499-7248ec5658a5'::uuid, '1 John'),
	('8a2fed76-f556-4a68-b499-7248ec5658a5'::uuid, '2 John'),
	('8a2fed76-f556-4a68-b499-7248ec5658a5'::uuid, '3 John'),
	('aa506ab3-73de-4549-bdb0-8fffafe2b226'::uuid, 'Ephesians'),
	('aa506ab3-73de-4549-bdb0-8fffafe2b226'::uuid, 'Philemon'),
	('cc77fc06-5695-4179-b62f-6b30eb5c1384'::uuid, '1 John'),
	('cc77fc06-5695-4179-b62f-6b30eb5c1384'::uuid, '2 John'),
	('cc77fc06-5695-4179-b62f-6b30eb5c1384'::uuid, '3 John'),
	('e1e841a3-92b8-4221-831a-ed2de01a32fe'::uuid, 'Philemon'),
	('c1bf8565-1c93-4ed1-b7ba-247de40a5cd3'::uuid, '1 Timothy'),
	('c1bf8565-1c93-4ed1-b7ba-247de40a5cd3'::uuid, '2 Timothy'),
	('c1bf8565-1c93-4ed1-b7ba-247de40a5cd3'::uuid, 'Titus'),
	('2847bd08-6dc1-426a-b726-28f979b76bee'::uuid, 'Isaiah'),
	('bbed8783-0c7f-4ce3-9676-3aa0e46a44a4'::uuid, 'Psalms'),
	('de2a577b-a69a-4fa8-be09-4735dbd24562'::uuid, 'Psalms'),
	('17eee4de-43d9-43a1-815d-0eef165d7473'::uuid, 'Psalms')
) AS v(book_id, bible_book)
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage bbc
	WHERE bbc.book_id = v.book_id AND bbc.bible_book = v.bible_book
);

-- ---------------------------------------------------------------------------
-- NIB Vol X: people + essays + essay authors + essay coverage
-- Contributors (from personal_notes): Boring (Acts), Wright (Romans), Sampley (1 Cor)
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name)
SELECT v.first_name, v.middle_name, v.last_name
FROM (VALUES
	('M.', 'Eugene', 'Boring'),
	('J.', 'Paul', 'Sampley')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE COALESCE(p.first_name, '') = v.first_name
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
		AND p.deleted_at IS NULL
);

-- Prefer "N. T." for Turabian on existing Wright row used for Romans essay
UPDATE public.people
SET first_name = 'N. T.', updated_at = now()
WHERE id = 'e4982542-dabb-4673-b705-404e68cb12ab'
	AND deleted_at IS NULL
	AND first_name = 'N.';

INSERT INTO public.essays (essay_title, parent_book_id, created_by)
SELECT 'Acts', '3f78e12e-32ad-44c7-b443-2a53313595c6'::uuid, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
WHERE NOT EXISTS (
	SELECT 1 FROM public.essays e
	WHERE e.parent_book_id = '3f78e12e-32ad-44c7-b443-2a53313595c6'::uuid
		AND e.essay_title = 'Acts'
		AND e.deleted_at IS NULL
);

INSERT INTO public.essay_authors (essay_id, person_id, role, sort_order)
SELECT e.id, p.id, 'author', 0
FROM public.essays e
JOIN public.people p ON p.last_name = 'Boring'
	AND COALESCE(p.first_name, '') = 'M.'
	AND COALESCE(p.middle_name, '') = COALESCE('Eugene', '')
	AND p.deleted_at IS NULL
WHERE e.parent_book_id = '3f78e12e-32ad-44c7-b443-2a53313595c6'::uuid
	AND e.essay_title = 'Acts'
	AND e.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.essay_authors ea
		WHERE ea.essay_id = e.id AND ea.person_id = p.id
	);

INSERT INTO public.book_bible_coverage (essay_id, bible_book, created_by)
SELECT e.id, 'Acts', 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.essays e
WHERE e.parent_book_id = '3f78e12e-32ad-44c7-b443-2a53313595c6'::uuid
	AND e.essay_title = 'Acts'
	AND e.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.book_bible_coverage bbc
		WHERE bbc.essay_id = e.id AND bbc.bible_book = 'Acts'
	);

INSERT INTO public.essays (essay_title, parent_book_id, created_by)
SELECT 'Romans', '3f78e12e-32ad-44c7-b443-2a53313595c6'::uuid, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
WHERE NOT EXISTS (
	SELECT 1 FROM public.essays e
	WHERE e.parent_book_id = '3f78e12e-32ad-44c7-b443-2a53313595c6'::uuid
		AND e.essay_title = 'Romans'
		AND e.deleted_at IS NULL
);

INSERT INTO public.essay_authors (essay_id, person_id, role, sort_order)
SELECT e.id, p.id, 'author', 0
FROM public.essays e
JOIN public.people p ON p.last_name = 'Wright'
	AND COALESCE(p.first_name, '') = 'N. T.'
	AND COALESCE(p.middle_name, '') = COALESCE(NULL, '')
	AND p.deleted_at IS NULL
WHERE e.parent_book_id = '3f78e12e-32ad-44c7-b443-2a53313595c6'::uuid
	AND e.essay_title = 'Romans'
	AND e.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.essay_authors ea
		WHERE ea.essay_id = e.id AND ea.person_id = p.id
	);

INSERT INTO public.book_bible_coverage (essay_id, bible_book, created_by)
SELECT e.id, 'Romans', 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.essays e
WHERE e.parent_book_id = '3f78e12e-32ad-44c7-b443-2a53313595c6'::uuid
	AND e.essay_title = 'Romans'
	AND e.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.book_bible_coverage bbc
		WHERE bbc.essay_id = e.id AND bbc.bible_book = 'Romans'
	);

INSERT INTO public.essays (essay_title, parent_book_id, created_by)
SELECT '1 Corinthians', '3f78e12e-32ad-44c7-b443-2a53313595c6'::uuid, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
WHERE NOT EXISTS (
	SELECT 1 FROM public.essays e
	WHERE e.parent_book_id = '3f78e12e-32ad-44c7-b443-2a53313595c6'::uuid
		AND e.essay_title = '1 Corinthians'
		AND e.deleted_at IS NULL
);

INSERT INTO public.essay_authors (essay_id, person_id, role, sort_order)
SELECT e.id, p.id, 'author', 0
FROM public.essays e
JOIN public.people p ON p.last_name = 'Sampley'
	AND COALESCE(p.first_name, '') = 'J.'
	AND COALESCE(p.middle_name, '') = COALESCE('Paul', '')
	AND p.deleted_at IS NULL
WHERE e.parent_book_id = '3f78e12e-32ad-44c7-b443-2a53313595c6'::uuid
	AND e.essay_title = '1 Corinthians'
	AND e.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.essay_authors ea
		WHERE ea.essay_id = e.id AND ea.person_id = p.id
	);

INSERT INTO public.book_bible_coverage (essay_id, bible_book, created_by)
SELECT e.id, '1 Corinthians', 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.essays e
WHERE e.parent_book_id = '3f78e12e-32ad-44c7-b443-2a53313595c6'::uuid
	AND e.essay_title = '1 Corinthians'
	AND e.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.book_bible_coverage bbc
		WHERE bbc.essay_id = e.id AND bbc.bible_book = '1 Corinthians'
	);

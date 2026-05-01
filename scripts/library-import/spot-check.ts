/**
 * Pass 1 spot-check: pull 10 random scholarly-core books from prod and print
 * their hydrated state (authors, series, genre, year, etc.) so I can eyeball
 * against Library_Migration_Notes.md.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
config({ path: resolve(ROOT, '.env') });
config({ path: resolve(ROOT, '.env.local'), override: true });
const sb = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function fmtBook(id: string): Promise<string> {
	const { data: b } = await sb
		.from('books')
		.select(
			'id, title, subtitle, year, publisher, edition, volume_number, genre, language, needs_review, isbn, page_count, primary_category_id, series_id'
		)
		.eq('id', id)
		.maybeSingle();
	if (!b) return `(missing ${id})`;
	const book = b as Record<string, unknown>;
	const { data: ba } = await sb
		.from('book_authors')
		.select('person_id, role, sort_order')
		.eq('book_id', id);
	const personIds = (ba ?? []).map((r) => (r as { person_id: string }).person_id);
	const { data: people } = personIds.length > 0 ? await sb.from('people').select('id, first_name, middle_name, last_name, suffix').in('id', personIds) : { data: [] };
	const peopleMap = new Map(
		(people ?? []).map((p) => [
			(p as { id: string }).id,
			p as { id: string; first_name: string | null; middle_name: string | null; last_name: string; suffix: string | null }
		])
	);
	const authorStrs = (ba ?? [])
		.sort((x, y) => (x as { sort_order: number }).sort_order - (y as { sort_order: number }).sort_order)
		.map((a) => {
			const p = peopleMap.get((a as { person_id: string }).person_id);
			if (!p) return `?(${(a as { person_id: string }).person_id})`;
			const role = (a as { role: string }).role;
			const segs = [p.first_name, p.middle_name, p.last_name, p.suffix].filter(Boolean).join(' ');
			return `${segs}${role !== 'author' ? ` [${role}]` : ''}`;
		});

	let seriesStr = '';
	if (book.series_id) {
		const { data: s } = await sb
			.from('series')
			.select('name, abbreviation')
			.eq('id', book.series_id as string)
			.maybeSingle();
		if (s) seriesStr = ` [${(s as { abbreviation: string | null }).abbreviation ?? (s as { name: string }).name}]`;
	}
	const vol = book.volume_number ? ` vol ${book.volume_number}` : '';
	return `"${book.title ?? '(no title)'}"${book.subtitle ? `: ${book.subtitle}` : ''} (${book.year ?? '?'})${seriesStr}${vol}\n    by ${authorStrs.join('; ') || '(no authors)'}\n    genre=${book.genre ?? '?'}, lang=${book.language}, needs_review=${book.needs_review}, isbn=${book.isbn ?? '-'}, pages=${book.page_count ?? '-'}, edition=${book.edition ?? '-'}`;
}

async function main() {
	// Pull random scholarly-core clean rows
	const { data: rows } = await sb
		.from('books')
		.select('id')
		.in('genre', [
			'Commentary',
			'Bibles',
			'Biblical Reference',
			'Greek Language Tools',
			'Hebrew Language Tools'
		])
		.eq('needs_review', false)
		.is('deleted_at', null);
	const ids = (rows ?? []).map((r) => (r as { id: string }).id);
	const seed = 0xfeedface;
	let s = seed;
	const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
	const sample: string[] = [];
	const taken = new Set<number>();
	while (sample.length < 10 && taken.size < ids.length) {
		const i = Math.floor(rand() * ids.length);
		if (taken.has(i)) continue;
		taken.add(i);
		sample.push(ids[i]);
	}
	console.log(`Spot-checking 10 of ${ids.length} scholarly-core clean rows:\n`);
	for (let i = 0; i < sample.length; i++) {
		console.log(`${i + 1}. ${await fmtBook(sample[i])}\n`);
	}

	// Also spot-check a few notable curated rows by title
	console.log('--- Specific notes-curated rows ---\n');
	for (const t of [
		'Theological Dictionary of the New Testament',
		'The Anchor Bible Dictionary',
		'Brockhaus Enzyklopädie',
		'A Greek-English Lexicon of the New Testament and Other Early Christian Literature',
		'Theological Wordbook of the Old Testament',
		'1 & 2 Kings'
	]) {
		const { data } = await sb
			.from('books')
			.select('id, volume_number')
			.eq('title', t)
			.is('deleted_at', null)
			.order('volume_number', { ascending: true });
		if (!data || data.length === 0) {
			console.log(`(NOT FOUND) "${t}"\n`);
			continue;
		}
		for (const r of data) {
			console.log(await fmtBook((r as { id: string }).id));
			console.log('');
		}
	}
}
main().catch((e) => {
	console.error(e);
	process.exit(1);
});

/**
 * One-shot patch for the 4 Brockhaus rows that landed wrong on Pass 1:
 *   - 3 Wörterbuch vols: title was the source raw "DEUTSCHES WÖRTERBUCH X-Y"
 *     because applyBrockhaus regex required "Brockhaus" prefix. Fix to
 *     canonical title + volume_number + needs_review=false + clear bogus
 *     enrichment.
 *   - Die Heilige Schrift: source had series='BH' (publisher confusion) but
 *     it's a BBL Bible. Clear series_id.
 *
 * Code is fixed for Pass 2 (see commit). This script just patches the live DB.
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

async function main() {
	// Resolve required FKs.
	const { data: bhSeries } = await sb
		.from('series')
		.select('id')
		.eq('abbreviation', 'BH')
		.maybeSingle();
	if (!bhSeries) throw new Error('No BH series found');
	const { data: cat } = await sb
		.from('categories')
		.select('id')
		.eq('slug', 'languages-reference')
		.maybeSingle();
	if (!cat) throw new Error('No languages-reference category');

	// Find Wörterbuch rows (any title containing WÖRTERBUCH except the supplementary "WÖRTERBUCH ENGLISH" which is an Enzyklopädie row vol 27)
	const { data: wbk } = await sb
		.from('books')
		.select('id, title')
		.or('title.ilike.%DEUTSCHES W%RTERBUCH%')
		.is('deleted_at', null);
	console.log('Wörterbuch rows to fix:', wbk?.length);
	for (const r of wbk ?? []) {
		const t = (r as { title: string }).title;
		// Pattern: "DEUTSCHES WÖRTERBUCH A-GLUB"
		const m = t.match(/^DEUTSCHES W[ÖO]RTERBUCH\s+(.+)$/i);
		const range = m ? m[1].toUpperCase().trim() : '';
		const vols = ['A-GLUB', 'GLUC-REG', 'REH-ZZ'];
		const vol = vols.indexOf(range) + 1; // 1-based; 0 if not found
		console.log(` ${(r as { id: string }).id}  "${t}" → vol ${vol || '?'}`);
		// personal_notes intentionally NOT included — B1/B2 trigger blocks
		// non-owner UPDATEs of that column, and `auth.uid()` is NULL under
		// service-role. The letter range can be added via the UI later (or
		// captured properly on Pass 2 since the importer INSERT path isn't
		// blocked by the trigger).
		const payload: Record<string, unknown> = {
			title: 'Brockhaus Deutsches Wörterbuch',
			series_id: (bhSeries as { id: string }).id,
			volume_number: vol > 0 ? String(vol) : null,
			language: 'german',
			needs_review: false,
			needs_review_note: null,
			genre: 'Biblical Reference',
			primary_category_id: (cat as { id: string }).id,
			year: null,
			publisher: null,
			publisher_location: null,
			page_count: null,
			isbn: null,
			subtitle: null
		};
		const { error } = await sb.from('books').update(payload).eq('id', (r as { id: string }).id);
		if (error) throw error;
	}

	// Die Heilige Schrift (was tagged series=BH; clear it)
	const { data: heilige } = await sb
		.from('books')
		.select('id, series_id')
		.eq('title', 'Die Heilige Schrift')
		.is('deleted_at', null);
	for (const r of heilige ?? []) {
		const row = r as { id: string; series_id: string | null };
		if (row.series_id !== (bhSeries as { id: string }).id) continue;
		console.log(` ${row.id}  "Die Heilige Schrift" → clearing BH series`);
		const { error } = await sb.from('books').update({ series_id: null }).eq('id', row.id);
		if (error) throw error;
	}
	console.log('Done.');
}
main().catch((e) => {
	console.error(e);
	process.exit(1);
});

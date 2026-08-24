/**
 * One-shot: import Sheet1 + People for Things CSVs into hosted contacts.
 * Usage: npx tsx scripts/contacts-sheet-import.ts /tmp/sheet1.csv /tmp/pft.csv
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import { importSheet1AndPotentialInvite } from '../src/lib/contacts/server/sheet-import-action.ts';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerId = process.env.POS_OWNER_ID;
if (!url || !key || !ownerId) {
	console.error('Need PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, POS_OWNER_ID');
	process.exit(1);
}

const sheet1Path = process.argv[2];
const pftPath = process.argv[3];
if (!sheet1Path) {
	console.error('Usage: tsx scripts/contacts-sheet-import.ts sheet1.csv [pft.csv]');
	process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const result = await importSheet1AndPotentialInvite(supabase, ownerId, {
	sheet1Csv: readFileSync(sheet1Path, 'utf8'),
	peopleForThingsCsv: pftPath ? readFileSync(pftPath, 'utf8') : null
});
console.log(JSON.stringify(result, null, 2));

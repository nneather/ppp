/**
 * One-shot Canvas → classwork import (preview default; --apply writes).
 *
 *   npm run classwork:canvas-import
 *   npm run classwork:canvas-import -- --apply
 *   npm run classwork:canvas-import -- --term=FA-26 --include-zero-point
 *
 * Env: CANVAS_HOST, CANVAS_TOKEN (.env or .env.local), PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, POS_OWNER_ID.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import {
	applyCanvasImport,
	fetchCanvasCatalog,
	formatCanvasImportPreview,
	loadCanvasImportState,
	planCanvasImport
} from '../src/lib/classwork/server/canvas-import.ts';

config({ path: '.env' });
config({ path: '.env.local', override: true });

function argValue(name: string): string | undefined {
	const pref = `${name}=`;
	const hit = process.argv.find((a) => a.startsWith(pref));
	return hit ? hit.slice(pref.length) : undefined;
}

const APPLY = process.argv.includes('--apply');
const termCode = argValue('--term') ?? 'FA-26';
const includeZeroPoint = process.argv.includes('--include-zero-point');
const includeAttendance = process.argv.includes('--include-attendance');
const includeMakeup = process.argv.includes('--include-makeup');
const minDueYmd = argValue('--min-due');

const host = process.env.CANVAS_HOST?.trim();
const token = process.env.CANVAS_TOKEN?.trim();
const url = process.env.PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const ownerId = process.env.POS_OWNER_ID?.trim();

if (!host || !token) {
	console.error('Need CANVAS_HOST and CANVAS_TOKEN in .env or .env.local');
	process.exit(1);
}
if (!url || !key || !ownerId) {
	console.error('Need PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, POS_OWNER_ID');
	process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const catalog = await fetchCanvasCatalog(host, token);
const existing = await loadCanvasImportState(supabase);
const preview = planCanvasImport(catalog, existing, {
	termCode,
	minDueYmd: minDueYmd ?? undefined,
	includeZeroPoint,
	includeAttendance,
	includeMakeup
});

console.log(formatCanvasImportPreview(preview));

if (!APPLY) {
	console.log('\nDry run. Re-run with --apply to write.');
	process.exit(0);
}

const result = await applyCanvasImport(supabase, ownerId, preview);
console.log('\nApplied:', JSON.stringify(result));

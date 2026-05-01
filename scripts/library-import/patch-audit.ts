/**
 * Post-apply patch: stamp `audit_log.changed_by = OWNER_ID` for any rows
 * the Pass 1 apply created with NULL attribution. Runs against the cutoff
 * timestamp written to data/pass1_start.txt.
 *
 * Decision 007 explicitly allows this fallback when the trigger can't
 * resolve auth.uid() under a service-role connection.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
config({ path: resolve(ROOT, '.env') });
config({ path: resolve(ROOT, '.env.local'), override: true });

async function main() {
	const cutoff = readFileSync(resolve(HERE, 'data/pass1_start.txt'), 'utf8').trim();
	const owner = process.env.POS_OWNER_ID;
	if (!owner) throw new Error('POS_OWNER_ID missing');
	console.log(`Cutoff:  ${cutoff}`);
	console.log(`Owner:   ${owner}`);
	const sb = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

	// 1. Count NULL-attribution rows in window pre-patch
	const { count: nullBefore, error: e1 } = await sb
		.from('audit_log')
		.select('*', { count: 'exact', head: true })
		.is('changed_by', null)
		.gte('changed_at', cutoff);
	if (e1) throw e1;
	console.log(`NULL changed_by since cutoff: ${nullBefore}`);

	if (!nullBefore || nullBefore === 0) {
		console.log('Nothing to patch.');
		return;
	}

	// 2. Patch
	const { error: e2 } = await sb
		.from('audit_log')
		.update({ changed_by: owner })
		.is('changed_by', null)
		.gte('changed_at', cutoff);
	if (e2) throw e2;

	// 3. Verify
	const { count: nullAfter, error: e3 } = await sb
		.from('audit_log')
		.select('*', { count: 'exact', head: true })
		.is('changed_by', null)
		.gte('changed_at', cutoff);
	if (e3) throw e3;
	console.log(`NULL changed_by since cutoff (post-patch): ${nullAfter}`);

	// 4. Sample 5 rows to confirm
	const { data: sample, error: e4 } = await sb
		.from('audit_log')
		.select('table_name, operation, changed_by, changed_at')
		.gte('changed_at', cutoff)
		.order('changed_at', { ascending: false })
		.limit(5);
	if (e4) throw e4;
	console.log('\nSample post-patch:');
	for (const r of sample ?? []) {
		console.log(
			`  ${r.changed_at}  ${r.table_name.padEnd(20)}  ${r.operation.padEnd(8)}  changed_by=${r.changed_by ?? 'NULL'}`
		);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

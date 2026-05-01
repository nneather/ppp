import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
config({ path: resolve(ROOT, '.env') });
config({ path: resolve(ROOT, '.env.local'), override: true });

async function main() {
	const sb = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
	const { data, error } = await sb
		.from('audit_log')
		.select('table_name, operation, changed_by, changed_at, record_id')
		.order('changed_at', { ascending: false })
		.limit(10);
	if (error) {
		console.error(error);
		process.exit(1);
	}
	console.log('--- last 10 audit_log entries ---');
	for (const r of data ?? []) {
		console.log(
			`${r.changed_at}  ${r.table_name.padEnd(20)}  ${r.operation.padEnd(8)}  changed_by=${r.changed_by ?? 'NULL'}  rec=${r.record_id}`
		);
	}
	const { count, error: cErr } = await sb
		.from('books')
		.select('*', { count: 'exact', head: true })
		.is('deleted_at', null);
	if (cErr) console.error(cErr);
	console.log('\nlive books:', count);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

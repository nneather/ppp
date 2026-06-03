/**
 * RLS smoke — library suite against ppp-staging only.
 */
import { createServiceClient, signInAs } from './lib/clients.ts';
import { loadStagingEnv, requireEnv } from './lib/env.ts';
import { cleanupSmokeRows } from './lib/cleanup.ts';
import { runLibrarySuite } from './suites/library.ts';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const suiteArg = args.find((a) => a.startsWith('--suite='));
const suite = suiteArg?.split('=')[1] ?? 'library';

async function main(): Promise<void> {
	loadStagingEnv();
	requireEnv('PUBLIC_SUPABASE_URL');
	requireEnv('PUBLIC_SUPABASE_ANON_KEY');
	requireEnv('SUPABASE_SERVICE_ROLE_KEY');
	requireEnv('RLS_TEST_OWNER_EMAIL');
	requireEnv('RLS_TEST_OWNER_PASSWORD');
	requireEnv('RLS_TEST_VIEWER_WRITE_EMAIL');
	requireEnv('RLS_TEST_VIEWER_WRITE_PASSWORD');
	requireEnv('RLS_TEST_VIEWER_READ_EMAIL');
	requireEnv('RLS_TEST_VIEWER_READ_PASSWORD');

	const ref = process.env.SUPABASE_REF ?? '(unset)';
	const url = process.env.PUBLIC_SUPABASE_URL ?? '';
	const urlRef = url.match(/https?:\/\/([^.]+)\./)?.[1] ?? '?';
	if (process.env.SUPABASE_REF && urlRef !== '?' && urlRef !== process.env.SUPABASE_REF) {
		console.error(`Ref mismatch: SUPABASE_REF=${process.env.SUPABASE_REF} URL ref=${urlRef}`);
		process.exit(2);
	}

	console.log(`RLS smoke — suite=${suite} dryRun=${dryRun}`);
	console.log(`  target: ${url} (ref ${ref})\n`);

	const service = createServiceClient();
	await cleanupSmokeRows(service);

	const owner = await signInAs('RLS_TEST_OWNER_EMAIL', 'RLS_TEST_OWNER_PASSWORD');
	const viewerWrite = await signInAs(
		'RLS_TEST_VIEWER_WRITE_EMAIL',
		'RLS_TEST_VIEWER_WRITE_PASSWORD'
	);
	const viewerRead = await signInAs('RLS_TEST_VIEWER_READ_EMAIL', 'RLS_TEST_VIEWER_READ_PASSWORD');

	const { data: ownerProfile } = await owner.client
		.from('profiles')
		.select('role')
		.eq('id', owner.userId)
		.single();
	if (ownerProfile?.role !== 'owner') {
		console.error(
			`RLS_TEST_OWNER must have profiles.role=owner (got ${ownerProfile?.role ?? 'null'})`
		);
		process.exit(2);
	}

	let results: { id: string; ok: boolean; detail?: string }[] = [];

	if (suite === 'library') {
		results = await runLibrarySuite({
			owner,
			viewerWrite,
			viewerRead,
			service,
			dryRun
		});
	} else {
		console.error(`Unknown suite: ${suite}`);
		process.exit(2);
	}

	const failed = results.filter((r) => !r.ok);
	console.log(`\n${results.length - failed.length}/${results.length} passed`);
	if (failed.length > 0) {
		for (const f of failed) {
			console.error(`  ${f.id}: ${f.detail}`);
		}
		process.exit(1);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

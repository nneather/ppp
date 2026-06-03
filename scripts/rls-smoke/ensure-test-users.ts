/**
 * Idempotent staging test users for RLS smoke.
 * Uses service role — run only against ppp-staging (.env.staging.local).
 */
import { createServiceClient } from './lib/clients.ts';
import { loadStagingEnv, requireEnv } from './lib/env.ts';

const VIEWER_WRITE_EMAIL = 'RLS_TEST_VIEWER_WRITE_EMAIL';
const VIEWER_WRITE_PASSWORD = 'RLS_TEST_VIEWER_WRITE_PASSWORD';
const VIEWER_READ_EMAIL = 'RLS_TEST_VIEWER_READ_EMAIL';
const VIEWER_READ_PASSWORD = 'RLS_TEST_VIEWER_READ_PASSWORD';

async function ensureAuthUser(
	service: ReturnType<typeof createServiceClient>,
	email: string,
	password: string
): Promise<string> {
	const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 1000 });
	if (listErr) throw new Error(`listUsers: ${listErr.message}`);

	const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
	if (existing) {
		console.log(`  auth user exists: ${email} (${existing.id})`);
		return existing.id;
	}

	const { data: created, error: createErr } = await service.auth.admin.createUser({
		email,
		password,
		email_confirm: true
	});
	if (createErr || !created.user) {
		throw new Error(`createUser ${email}: ${createErr?.message ?? 'no user'}`);
	}
	console.log(`  created auth user: ${email} (${created.user.id})`);
	return created.user.id;
}

async function ensureViewerProfile(
	service: ReturnType<typeof createServiceClient>,
	userId: string,
	email: string
): Promise<void> {
	const { error: profileErr } = await service.from('profiles').upsert(
		{ id: userId, email, role: 'viewer' },
		{ onConflict: 'id' }
	);
	if (profileErr) throw new Error(`profiles upsert: ${profileErr.message}`);
}

async function ensurePermission(
	service: ReturnType<typeof createServiceClient>,
	userId: string,
	accessLevel: 'read' | 'write'
): Promise<void> {
	const { error } = await service.from('user_permissions').upsert(
		{ user_id: userId, module: 'library', access_level: accessLevel },
		{ onConflict: 'user_id,module' }
	);
	if (error) throw new Error(`user_permissions: ${error.message}`);
}

async function main(): Promise<void> {
	loadStagingEnv();
	requireEnv('PUBLIC_SUPABASE_URL');
	requireEnv('SUPABASE_SERVICE_ROLE_KEY');

	const writeEmail = requireEnv(VIEWER_WRITE_EMAIL);
	const writePassword = requireEnv(VIEWER_WRITE_PASSWORD);
	const readEmail = requireEnv(VIEWER_READ_EMAIL);
	const readPassword = requireEnv(VIEWER_READ_PASSWORD);

	console.log('RLS smoke — ensure test users (staging)\n');

	const service = createServiceClient();

	const writeId = await ensureAuthUser(service, writeEmail, writePassword);
	await ensureViewerProfile(service, writeId, writeEmail);
	await ensurePermission(service, writeId, 'write');

	const readId = await ensureAuthUser(service, readEmail, readPassword);
	await ensureViewerProfile(service, readId, readEmail);
	await ensurePermission(service, readId, 'read');

	console.log('\nDone. Owner sign-in uses RLS_TEST_OWNER_EMAIL / RLS_TEST_OWNER_PASSWORD.');
	console.log('Run: npm run test:rls');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

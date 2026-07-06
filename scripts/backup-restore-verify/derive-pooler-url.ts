#!/usr/bin/env npx tsx
/**
 * Derive Session Pooler URL for ppp-prod and print to stdout (for gh secret set).
 * Probes aws-{0,1,2}-<region>.pooler.supabase.com — cluster is not always aws-0.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/backup-restore-verify/derive-pooler-url.ts | gh secret set BACKUP_DATABASE_URL
 */
import postgres from 'postgres';
import { execSync } from 'node:child_process';

const ref = process.env.SUPABASE_REF ?? 'objtrdmmqlndtfddtzan';
const direct =
	process.env.LIBRARY_DST_DATABASE_URL ?? process.env.BACKUP_DATABASE_URL ?? '';
const m = direct.match(/^postgresql:\/\/postgres:([^@]+)@/);
if (!m) {
	console.error('Set LIBRARY_DST_DATABASE_URL (Direct URI with postgres:password@) in .env.local');
	process.exit(1);
}
const pass = decodeURIComponent(m[1]);

let region = process.env.SUPABASE_REGION;
if (!region) {
	try {
		const out = execSync('npx dotenv -e .env -- supabase projects list', {
			encoding: 'utf8',
			cwd: new URL('../..', import.meta.url).pathname
		});
		const projects = JSON.parse(out) as { projects: { ref: string; region: string }[] };
		region = projects.projects.find((p) => p.ref === ref)?.region;
	} catch {
		// ignore
	}
}
if (!region) {
	console.error('Could not determine region; set SUPABASE_REGION');
	process.exit(1);
}

async function tryHost(host: string): Promise<string | null> {
	try {
		const sql = postgres({
			host,
			port: 5432,
			database: 'postgres',
			user: `postgres.${ref}`,
			password: pass,
			ssl: 'require',
			connect_timeout: 15,
			max: 1
		});
		const rows = await sql`SELECT 1 as ok`;
		await sql.end();
		if (rows[0]?.ok !== 1) return null;
		const enc = encodeURIComponent(pass);
		return `postgresql://postgres.${ref}:${enc}@${host}:5432/postgres`;
	} catch {
		return null;
	}
}

async function main(): Promise<void> {
	for (const n of [0, 1, 2, 3]) {
		const host = `aws-${n}-${region}.pooler.supabase.com`;
		const url = await tryHost(host);
		if (url) {
			process.stdout.write(url);
			return;
		}
	}
	console.error(`No pooler host worked for region ${region}. Copy Session pooler URI from Dashboard → Connect.`);
	process.exit(1);
}

void main();

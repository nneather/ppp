/**
 * Resolve a Postgres URI for library CLI scripts on hosted Supabase.
 *
 * Direct URIs (`db.<ref>.supabase.co`) are IPv6-only on many networks — when
 * only LIBRARY_DST_DATABASE_URL is set, derive the Session Pooler URI
 * (same approach as scripts/backup-restore-verify/derive-pooler-url.ts).
 */

import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const DIRECT_HOST_RE = /^db\.[a-z0-9]+\.supabase\.co$/i;

function directCredentials(
	directUrl: string
): { ref: string; password: string; host: string } | null {
	const m = directUrl.match(/^postgresql:\/\/postgres:([^@]+)@([^:/]+)/);
	if (!m) return null;
	const host = m[2]!;
	const refMatch = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
	const ref = refMatch?.[1] ?? process.env.SUPABASE_REF?.trim();
	if (!ref) return null;
	return { ref, password: decodeURIComponent(m[1]!), host };
}

function resolveRegion(ref: string): string | null {
	const fromEnv = process.env.SUPABASE_REGION?.trim();
	if (fromEnv) return fromEnv;
	try {
		const out = execSync('npx dotenv -e .env -- supabase projects list', {
			encoding: 'utf8',
			cwd: ROOT
		});
		const projects = JSON.parse(out) as { projects: { ref: string; region: string }[] };
		return projects.projects.find((p) => p.ref === ref)?.region ?? null;
	} catch {
		return null;
	}
}

async function tryPoolerHost(
	ref: string,
	password: string,
	host: string
): Promise<string | null> {
	try {
		const sql = postgres({
			host,
			port: 5432,
			database: 'postgres',
			user: `postgres.${ref}`,
			password,
			ssl: 'require',
			connect_timeout: 15,
			max: 1
		});
		const rows = await sql`SELECT 1 as ok`;
		await sql.end({ timeout: 5 });
		if (rows[0]?.ok !== 1) return null;
		const enc = encodeURIComponent(password);
		return `postgresql://postgres.${ref}:${enc}@${host}:5432/postgres`;
	} catch {
		return null;
	}
}

/** Derive Session Pooler URI from a Direct connection string. */
export async function derivePoolerFromDirect(directUrl: string): Promise<string | null> {
	const creds = directCredentials(directUrl);
	if (!creds) return null;
	const region = resolveRegion(creds.ref);
	if (!region) return null;
	for (const n of [0, 1, 2, 3]) {
		const host = `aws-${n}-${region}.pooler.supabase.com`;
		const url = await tryPoolerHost(creds.ref, creds.password, host);
		if (url) return url;
	}
	return null;
}

/**
 * LIBRARY_RESEARCH_DATABASE_URL (pooler) wins; else LIBRARY_DST/SRC with
 * auto-pooler when the host is the IPv6-only Direct endpoint.
 */
export async function resolveLibraryResearchDatabaseUrl(): Promise<string> {
	const explicit = process.env.LIBRARY_RESEARCH_DATABASE_URL?.trim();
	if (explicit) return explicit;

	const direct =
		process.env.LIBRARY_DST_DATABASE_URL?.trim() ||
		process.env.LIBRARY_SRC_DATABASE_URL?.trim();
	if (!direct) {
		throw new Error(
			'Set LIBRARY_RESEARCH_DATABASE_URL (Session Pooler) or LIBRARY_DST_DATABASE_URL in .env.local. See scripts/library-review-research/README.md'
		);
	}

	const creds = directCredentials(direct);
	if (creds && DIRECT_HOST_RE.test(creds.host)) {
		const pooler = await derivePoolerFromDirect(direct);
		if (pooler) {
			console.warn(
				'[library-research] Direct db host is IPv6-only on many networks — using Session Pooler.'
			);
			return pooler;
		}
		console.warn(
			'[library-research] Could not derive Session Pooler; set LIBRARY_RESEARCH_DATABASE_URL from Dashboard → Connect → Session pooler.'
		);
	}

	return direct;
}

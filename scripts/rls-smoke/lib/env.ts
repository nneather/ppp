import { config as dotenvConfig } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Load staging env only — never prod .env.local (RLS smoke must not touch prod). */
export function loadStagingEnv(): void {
	dotenvConfig({ path: resolve(ROOT, '.env.staging') });
	dotenvConfig({ path: resolve(ROOT, '.env.staging.local'), override: true });
}

export function requireEnv(name: string): string {
	const v = process.env[name]?.trim();
	if (!v) {
		console.error(`\nMissing required env: ${name}`);
		console.error('Copy .env.staging.example → .env.staging and fill .env.staging.local');
		console.error('See scripts/rls-smoke/README.md');
		process.exit(2);
	}
	return v;
}

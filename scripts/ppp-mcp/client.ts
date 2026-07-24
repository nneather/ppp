/**
 * Owner-asserted Supabase service-role client for the local ppp MCP server.
 * Service role bypasses RLS — assert POS_OWNER_ID matches the live owner profile.
 * Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */

import { chdir } from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/types/database.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
export const PPP_ROOT = resolve(HERE, '../..');

/** Ensure $lib / dotenv resolve even when the MCP client cwd is not the repo. */
try {
	chdir(PPP_ROOT);
} catch {
	/* ignore — smoke/tests may already be rooted */
}

dotenvConfig({ path: resolve(PPP_ROOT, '.env') });
dotenvConfig({ path: resolve(PPP_ROOT, '.env.local'), override: true });

function requireEnv(name: string): string {
	const v = process.env[name]?.trim();
	if (!v) {
		throw new Error(
			`Missing required env ${name}. Add to .env.local (see scripts/ppp-mcp/README.md).`
		);
	}
	return v;
}

export type PppMcpClient = {
	supabase: SupabaseClient<Database>;
	ownerId: string;
};

let cached: PppMcpClient | null = null;

/**
 * Create (once) a service-role client after verifying POS_OWNER_ID is the live owner.
 */
export async function getPppMcpClient(): Promise<PppMcpClient> {
	if (cached) return cached;

	const url = requireEnv('PUBLIC_SUPABASE_URL');
	const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
	const ownerId = requireEnv('POS_OWNER_ID');

	const supabase = createClient<Database>(url, serviceKey, {
		auth: { persistSession: false, autoRefreshToken: false }
	});

	const { data, error } = await supabase
		.from('profiles')
		.select('id, role')
		.eq('id', ownerId)
		.is('deleted_at', null)
		.maybeSingle();

	if (error) {
		throw new Error(`Owner assert failed (profiles lookup): ${error.message}`);
	}
	if (!data || data.role !== 'owner') {
		throw new Error(
			`Owner assert failed: POS_OWNER_ID=${ownerId} is not a live profiles.role=owner row.`
		);
	}

	cached = { supabase, ownerId };
	return cached;
}

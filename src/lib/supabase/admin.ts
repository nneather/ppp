import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

/** Service-role client for cron / system writers (bypasses RLS). Server-only. */
export function createServiceRoleClient(): SupabaseClient {
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!key) {
		throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
	}
	return createClient(PUBLIC_SUPABASE_URL, key, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
}

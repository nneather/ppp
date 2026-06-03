import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Resolve the current user without a network round-trip when the session JWT
 * is already in cookies (`getSession`). Falls back to `getUser()` only when
 * the cookie session is absent (e.g. stale tab).
 *
 * When asymmetric JWT signing keys are enabled in Supabase, prefer upgrading
 * to `auth.getClaims()` once @supabase/supabase-js in this repo exposes it.
 */
export async function resolveSessionUser(supabase: SupabaseClient): Promise<User | null> {
	const {
		data: { session },
		error: sessionError
	} = await supabase.auth.getSession();

	if (!sessionError && session?.user) {
		return session.user;
	}

	const {
		data: { user },
		error
	} = await supabase.auth.getUser();
	if (error) return null;
	return user;
}

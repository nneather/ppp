import type { SupabaseClient, User } from '@supabase/supabase-js';

/** Narrow user shape returned by safeGetSession — only id and email are used downstream. */
export type SessionUser = Pick<User, 'id' | 'email'>;

/**
 * Resolve the current user via locally verified JWT claims (`getClaims`).
 * With asymmetric signing keys enabled in Supabase, verification uses cached JWKS
 * (no per-request Auth HTTP call). With legacy HS256, getClaims falls back to
 * a server verify — still preferable to trusting getSession() cookie data alone.
 */
export async function resolveSessionUser(supabase: SupabaseClient): Promise<SessionUser | null> {
	const { data, error } = await supabase.auth.getClaims();
	if (error || !data?.claims) return null;

	const { sub, email } = data.claims;
	if (typeof sub !== 'string' || sub.length === 0) return null;

	return {
		id: sub,
		email: typeof email === 'string' ? email : undefined
	};
}

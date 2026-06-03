import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadStagingEnv, requireEnv } from './env.ts';

export type SignedInClient = {
	client: SupabaseClient;
	userId: string;
	accessToken: string;
};

export function createServiceClient(): SupabaseClient {
	loadStagingEnv();
	const url = requireEnv('PUBLIC_SUPABASE_URL');
	const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
	return createClient(url, key, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
}

export function createAnonClient(): SupabaseClient {
	loadStagingEnv();
	const url = requireEnv('PUBLIC_SUPABASE_URL');
	const key = requireEnv('PUBLIC_SUPABASE_ANON_KEY');
	return createClient(url, key, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
}

export async function signInAs(emailEnv: string, passwordEnv: string): Promise<SignedInClient> {
	loadStagingEnv();
	const email = requireEnv(emailEnv);
	const password = requireEnv(passwordEnv);
	const client = createAnonClient();
	const { data, error } = await client.auth.signInWithPassword({ email, password });
	if (error || !data.session?.user) {
		throw new Error(
			`Sign-in failed for ${emailEnv}: ${error?.message ?? 'no session'} — run npm run test:rls:ensure-users`
		);
	}
	return {
		client,
		userId: data.session.user.id,
		accessToken: data.session.access_token
	};
}

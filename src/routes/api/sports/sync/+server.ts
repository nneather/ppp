import { timingSafeEqual } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createServiceRoleClient } from '$lib/supabase/admin';
import { runSportsSync } from '$lib/sports/server/sync';
import type { RequestHandler } from './$types';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Hobby max is 10s; keep the hint for Pro if the project is upgraded. */
export const config = { maxDuration: 60 };

function cronAuthorized(request: Request): boolean {
	const secret = env.CRON_SECRET;
	if (!secret) return false;
	const header = request.headers.get('authorization');
	if (!header?.startsWith('Bearer ')) return false;
	const token = header.slice('Bearer '.length);
	try {
		const a = Buffer.from(token);
		const b = Buffer.from(secret);
		if (a.length !== b.length) return false;
		return timingSafeEqual(a, b);
	} catch {
		return false;
	}
}

async function ownerAuthorized(locals: App.Locals): Promise<boolean> {
	const { user } = await locals.safeGetSession();
	if (!user) return false;
	const profileRes = await locals.supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.maybeSingle();
	return (profileRes.data?.role as string | null) === 'owner';
}

function writerClient(asOwner: boolean, locals: App.Locals): SupabaseClient {
	if (asOwner) return locals.supabase;
	return createServiceRoleClient();
}

export const GET: RequestHandler = async ({ request, url, locals }) => {
	const cronOk = cronAuthorized(request);
	const asOwner = cronOk ? false : await ownerAuthorized(locals);
	if (!cronOk && !asOwner) {
		return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	}

	const includeStandings =
		url.searchParams.get('standings') === '1' || url.searchParams.get('standings') === 'true';

	try {
		const admin = writerClient(asOwner, locals);
		const result = await runSportsSync(admin, { includeStandings });
		return json(result, { status: result.ok ? 200 : 207 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ ok: false, error: message }, { status: 500 });
	}
};

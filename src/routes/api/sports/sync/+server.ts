import { timingSafeEqual } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createServiceRoleClient } from '$lib/supabase/admin';
import { runSportsSync } from '$lib/sports/server/sync';
import type { RequestHandler } from './$types';

function authorize(request: Request): boolean {
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

export const GET: RequestHandler = async ({ request, url }) => {
	if (!authorize(request)) {
		return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	}

	const includeStandings =
		url.searchParams.get('standings') === '1' || url.searchParams.get('standings') === 'true';

	try {
		const admin = createServiceRoleClient();
		const result = await runSportsSync(admin, { includeStandings });
		return json(result, { status: result.ok ? 200 : 207 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ ok: false, error: message }, { status: 500 });
	}
};

/**
 * Lightweight perf smoke — Server-Timing budgets on key navigations.
 * Requires a running dev/preview server and PERF_SMOKE_* credentials.
 */
import { createClient } from '@supabase/supabase-js';

const ORIGIN = process.env.PERF_SMOKE_ORIGIN ?? 'http://localhost:5173';
const EMAIL = process.env.PERF_SMOKE_EMAIL ?? process.env.RLS_TEST_OWNER_EMAIL;
const PASSWORD = process.env.PERF_SMOKE_PASSWORD ?? process.env.RLS_TEST_OWNER_PASSWORD;
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.PUBLIC_SUPABASE_ANON_KEY;

const BUDGETS = {
	libraryNav: Number(process.env.PERF_BUDGET_LIBRARY_NAV ?? 1200),
	librarySearch: Number(process.env.PERF_BUDGET_LIBRARY_SEARCH ?? 1500),
	dashboard: Number(process.env.PERF_BUDGET_DASHBOARD ?? 800)
} as const;

function parseTotalMs(serverTiming: string | null): number | null {
	if (!serverTiming) return null;
	const total = serverTiming
		.split(',')
		.map((s) => s.trim())
		.find((s) => s.startsWith('total;'));
	if (!total) return null;
	const m = /dur=(\d+)/.exec(total);
	return m ? Number(m[1]) : null;
}

async function signIn(): Promise<string> {
	if (!SUPABASE_URL || !SUPABASE_ANON) {
		throw new Error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY');
	}
	if (!EMAIL || !PASSWORD) {
		throw new Error('Missing PERF_SMOKE_EMAIL/PERF_SMOKE_PASSWORD (or RLS_TEST_OWNER_*)');
	}
	const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
	const { data, error } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
	if (error || !data.session) throw new Error(`Sign-in failed: ${error?.message ?? 'no session'}`);
	const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
	const cookieName = `sb-${projectRef}-auth-token`;
	const payload = JSON.stringify({
		access_token: data.session.access_token,
		refresh_token: data.session.refresh_token,
		expires_at: data.session.expires_at,
		expires_in: data.session.expires_in,
		token_type: data.session.token_type,
		user: data.session.user
	});
	return `${cookieName}=${encodeURIComponent(payload)}`;
}

async function fetchTiming(path: string, cookie: string): Promise<number> {
	const res = await fetch(`${ORIGIN}${path}`, {
		headers: { cookie },
		redirect: 'manual'
	});
	if (res.status >= 300 && res.status < 400) {
		const loc = res.headers.get('location');
		if (loc) return fetchTiming(loc.startsWith('http') ? new URL(loc).pathname : loc, cookie);
	}
	if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
	const total = parseTotalMs(res.headers.get('server-timing'));
	if (total == null) throw new Error(`${path} missing Server-Timing: total`);
	return total;
}

async function main() {
	const cookie = await signIn();
	const cases: { name: string; path: string; budget: number }[] = [
		{ name: 'dashboard', path: '/dashboard', budget: BUDGETS.dashboard },
		{ name: 'library nav', path: '/library', budget: BUDGETS.libraryNav },
		{ name: 'library search', path: '/library?q=test', budget: BUDGETS.librarySearch }
	];

	let failed = false;
	for (const c of cases) {
		const ms = await fetchTiming(c.path, cookie);
		const ok = ms <= c.budget;
		console.log(`${ok ? '✓' : '✗'} ${c.name}: ${ms}ms (budget ${c.budget}ms) — ${c.path}`);
		if (!ok) failed = true;
	}
	if (failed) process.exit(1);
	console.log('Perf smoke passed.');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

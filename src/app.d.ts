/// <reference types="vite-plugin-pwa/svelte" />
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionUser } from '$lib/server/auth-session';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{ user: SessionUser | null }>;
			perf: import('$lib/server/perf').PerfCollector;
		}
	}
}

export {};

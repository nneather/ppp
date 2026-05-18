/// <reference types="vite-plugin-pwa/svelte" />
import type { SupabaseClient, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{ user: User | null }>;
		}
	}
}

export {};

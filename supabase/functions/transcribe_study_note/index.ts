/** Transcribe one studies-audio object and delete it. Never writes a note. */

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'studies-audio';
const MAX_AUDIO_BYTES = 2_097_152;
const DEFAULT_MODEL = 'gpt-transcribe';
const OPENAI_URL = 'https://api.openai.com/v1/audio/transcriptions';
const PROMPT =
	'A seminary reading note spoken in English. It may begin with an author surname and a page number.';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXT_MIME: Record<string, string> = {
	webm: 'audio/webm',
	mp4: 'audio/mp4',
	ogg: 'audio/ogg'
};

function resolveCorsOrigin(req: Request): string | null {
	const origin = req.headers.get('Origin');
	if (!origin) return null;
	const site = Deno.env.get('SITE_URL')?.replace(/\/$/, '');
	if (site && origin === site) return origin;
	const extras = Deno.env.get('CORS_ALLOWED_ORIGINS')?.split(',').map((s) => s.trim()) ?? [];
	if (extras.includes(origin)) return origin;
	if (origin.endsWith('.vercel.app')) return origin;
	return null;
}

function corsHeadersFor(req: Request): Record<string, string> {
	const origin = resolveCorsOrigin(req);
	return {
		...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
		'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
		Vary: 'Origin'
	};
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' }
	});
}

async function getUserIdFromAuthApi(
	supabaseUrl: string,
	anonKey: string,
	authHeader: string
): Promise<string | null> {
	const base = supabaseUrl.replace(/\/$/, '');
	const res = await fetch(`${base}/auth/v1/user`, {
		headers: { Authorization: authHeader, apikey: anonKey }
	});
	if (!res.ok) return null;
	let body: unknown;
	try {
		body = await res.json();
	} catch {
		return null;
	}
	if (!body || typeof body !== 'object') return null;
	const id = (body as { id?: unknown }).id;
	return typeof id === 'string' && id.length > 0 ? id : null;
}

async function requireOwner(
	admin: ReturnType<typeof createClient>,
	userId: string
): Promise<boolean> {
	const { data, error } = await admin
		.from('profiles')
		.select('role')
		.eq('id', userId)
		.maybeSingle();
	if (error || !data) return false;
	return (data as { role: string }).role === 'owner';
}

/** Keep in step with audioPathOwnedBy in src/lib/studies/voice-capture.ts. */
function ownedAudio(objectPath: string, userId: string): { ext: string; mime: string } | null {
	if (!UUID_RE.test(userId)) return null;
	if (objectPath.includes('..') || objectPath.includes('\\') || objectPath.startsWith('/')) {
		return null;
	}
	const segments = objectPath.split('/').filter((segment) => segment.length > 0);
	if (segments.length !== 2 || segments[0] !== userId) return null;
	const file = segments[1] ?? '';
	const dot = file.lastIndexOf('.');
	if (dot <= 0) return null;
	const id = file.slice(0, dot);
	const ext = file.slice(dot + 1).toLowerCase();
	const mime = EXT_MIME[ext];
	if (!UUID_RE.test(id) || !mime) return null;
	return { ext, mime };
}

function sanitizeKeywords(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const out: string[] = [];
	for (const item of raw) {
		if (typeof item !== 'string') continue;
		const trimmed = item.trim();
		if (!/^[^<>\r\n]{1,40}$/.test(trimmed)) continue;
		if (out.includes(trimmed)) continue;
		out.push(trimmed);
		if (out.length >= 12) break;
	}
	return out;
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeadersFor(req) });
	}
	if (req.method !== 'POST') {
		return jsonResponse(req, { error: 'Method not allowed' }, 405);
	}

	const supabaseUrl = Deno.env.get('SUPABASE_URL');
	const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
	const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
	const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim() ?? '';
	const model = Deno.env.get('OPENAI_TRANSCRIBE_MODEL')?.trim() || DEFAULT_MODEL;

	if (!supabaseUrl || !anonKey || !serviceRoleKey) {
		return jsonResponse(req, { error: 'Server configuration error' }, 500);
	}

	const authHeader = req.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		return jsonResponse(req, { error: 'Unauthorized' }, 401);
	}
	const userId = await getUserIdFromAuthApi(supabaseUrl, anonKey, authHeader);
	if (!userId) return jsonResponse(req, { error: 'Unauthorized' }, 401);

	const admin = createClient(supabaseUrl, serviceRoleKey, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
	if (!(await requireOwner(admin, userId))) {
		return jsonResponse(req, { error: 'Owner only.' }, 403);
	}

	let body: { object_path?: unknown; keywords?: unknown };
	try {
		body = await req.json();
	} catch {
		return jsonResponse(req, { error: 'Invalid JSON body' }, 400);
	}
	const objectPath = typeof body.object_path === 'string' ? body.object_path.trim() : '';
	const owned = ownedAudio(objectPath, userId);
	if (!owned) {
		return jsonResponse(req, { error: 'object_path does not match your account.' }, 403);
	}

	try {
		if (!openaiKey) {
			return jsonResponse(req, { error: 'Transcription is not configured.' }, 503);
		}

		const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(objectPath);
		if (downloadError || !blob) {
			console.error('[transcribe_study_note] download', downloadError?.message ?? 'missing');
			return jsonResponse(req, { error: 'Could not read the recording.' }, 404);
		}
		if (blob.size === 0) {
			return jsonResponse(req, { error: 'No speech recognized.' }, 422);
		}
		if (blob.size > MAX_AUDIO_BYTES) {
			return jsonResponse(req, { error: 'That recording is too long.' }, 413);
		}

		const form = new FormData();
		form.append('file', new File([blob], `note.${owned.ext}`, { type: owned.mime }));
		form.append('model', model);
		form.append('prompt', PROMPT);
		form.append('languages[]', 'en');
		for (const keyword of sanitizeKeywords(body.keywords)) {
			form.append('keywords[]', keyword);
		}

		let openaiRes: Response;
		try {
			openaiRes = await fetch(OPENAI_URL, {
				method: 'POST',
				headers: { Authorization: `Bearer ${openaiKey}` },
				body: form,
				signal: AbortSignal.timeout(30_000)
			});
		} catch (err) {
			console.error('[transcribe_study_note] openai fetch', err instanceof Error ? err.name : 'error');
			return jsonResponse(req, { error: 'Transcription failed. Try again.' }, 502);
		}

		if (!openaiRes.ok) {
			console.error('[transcribe_study_note] openai HTTP', openaiRes.status);
			return jsonResponse(req, { error: 'Transcription failed. Try again.' }, 502);
		}

		let payload: unknown;
		try {
			payload = await openaiRes.json();
		} catch {
			return jsonResponse(req, { error: 'Transcription failed. Try again.' }, 502);
		}
		const text =
			payload && typeof payload === 'object' && typeof (payload as { text?: unknown }).text === 'string'
				? (payload as { text: string }).text.trim()
				: '';
		if (!text) return jsonResponse(req, { error: 'No speech recognized.' }, 422);
		return jsonResponse(req, { text });
	} finally {
		const { error: removeError } = await admin.storage.from(BUCKET).remove([objectPath]);
		if (removeError) console.error('[transcribe_study_note] delete', removeError.message);
	}
});

/** OCR scripture refs — returns structured candidates only; never writes DB rows. */

const corsHeaders: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' }
	});
}

/** Resolves the current user id via GoTrue (supports ES256); avoids local JWT verify in Edge. */
async function getUserIdFromAuthApi(
	supabaseUrl: string,
	anonKey: string,
	authHeader: string
): Promise<string | null> {
	const base = supabaseUrl.replace(/\/$/, '');
	const res = await fetch(`${base}/auth/v1/user`, {
		headers: {
			Authorization: authHeader,
			apikey: anonKey
		}
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Object path must be `${userId}/${bookId}/filename` with userId = JWT sub and book_id match.
 */
function pathMatchesUserAndBook(objectPath: string, userId: string, bookId: string): boolean {
	const segments = objectPath.split('/').filter((s) => s.length > 0);
	if (segments.length < 3) return false;
	return segments[0] === userId && segments[1] === bookId;
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	if (req.method !== 'POST') {
		return jsonResponse({ error: 'Method not allowed' }, 405);
	}

	const supabaseUrl = Deno.env.get('SUPABASE_URL');
	const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
	if (!supabaseUrl || !anonKey) {
		return jsonResponse({ error: 'Server configuration error' }, 500);
	}

	const authHeader = req.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	const userId = await getUserIdFromAuthApi(supabaseUrl, anonKey, authHeader);
	if (!userId) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	let body: { object_path?: string; mime_type?: string; book_id?: string };
	try {
		body = await req.json();
	} catch {
		return jsonResponse({ error: 'Invalid JSON body' }, 400);
	}

	const object_path = typeof body.object_path === 'string' ? body.object_path.trim() : '';
	const mime_type = typeof body.mime_type === 'string' ? body.mime_type.trim() : '';
	const book_id = typeof body.book_id === 'string' ? body.book_id.trim() : '';

	if (!object_path || !mime_type || !book_id) {
		return jsonResponse(
			{ error: 'object_path, mime_type, and book_id are required.' },
			400
		);
	}
	if (!UUID_RE.test(book_id)) {
		return jsonResponse({ error: 'Invalid book_id.' }, 400);
	}
	if (!pathMatchesUserAndBook(object_path, userId, book_id)) {
		return jsonResponse({ error: 'object_path does not match your account or book.' }, 403);
	}

	// Provider integration (Anthropic, Vision API, etc.) lands in a follow-up; stub response only.
	return jsonResponse({
		rawText: '',
		candidates: [] as unknown[]
	});
});

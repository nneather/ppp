/** Canvas REST helper for the classwork import CLI. Token stays server/env-only. */

export class CanvasApiError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = 'CanvasApiError';
	}
}

function joinUrl(host: string, path: string, params?: Record<string, string | number | string[]>): string {
	const base = host.replace(/\/+$/, '');
	const url = new URL(path.startsWith('http') ? path : `${base}${path}`);
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			if (Array.isArray(v)) {
				for (const item of v) url.searchParams.append(k, String(item));
			} else {
				url.searchParams.set(k, String(v));
			}
		}
	}
	return url.toString();
}

function nextLink(linkHeader: string | null): string | null {
	if (!linkHeader) return null;
	for (const part of linkHeader.split(',')) {
		const m = /<([^>]+)>\s*;\s*rel="next"/.exec(part);
		if (m) return m[1]!;
	}
	return null;
}

async function canvasFetch(
	url: string,
	token: string
): Promise<{ status: number; json: unknown; link: string | null }> {
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
	});
	const text = await res.text();
	let json: unknown = null;
	if (text.length > 0) {
		try {
			json = JSON.parse(text) as unknown;
		} catch {
			json = { message: text.slice(0, 200) };
		}
	}
	return { status: res.status, json, link: res.headers.get('link') };
}

export async function canvasGet<T>(
	host: string,
	token: string,
	path: string,
	params?: Record<string, string | number | string[]>
): Promise<T> {
	const { status, json } = await canvasFetch(joinUrl(host, path, params), token);
	if (status === 401) {
		throw new CanvasApiError('Canvas token rejected (401). Mint a new token.', status);
	}
	if (status < 200 || status >= 300) {
		throw new CanvasApiError(`Canvas GET ${path} failed (${status}).`, status);
	}
	return json as T;
}

export async function canvasGetPages<T>(
	host: string,
	token: string,
	path: string,
	params?: Record<string, string | number | string[]>
): Promise<T[]> {
	const out: T[] = [];
	let url: string | null = joinUrl(host, path, params);
	while (url) {
		const { status, json, link } = await canvasFetch(url, token);
		if (status === 401) {
			throw new CanvasApiError('Canvas token rejected (401). Mint a new token.', status);
		}
		if (status < 200 || status >= 300) {
			throw new CanvasApiError(`Canvas GET ${path} failed (${status}).`, status);
		}
		if (Array.isArray(json)) out.push(...(json as T[]));
		url = nextLink(link);
	}
	return out;
}

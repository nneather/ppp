const ALLOWED = new Set(['p', 'h2', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'br']);

function escapeAttr(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/** http(s) and mailto only. Anything else becomes an empty href. */
export function sanitizeHref(raw: string): string | null {
	const href = raw.trim();
	if (/^https?:\/\//i.test(href)) return href;
	if (/^mailto:/i.test(href)) return href;
	return null;
}

/**
 * Allowlist for the template editor's blocks: paragraph, heading, lists,
 * emphasis, and links (including the button class). Drops every other tag.
 */
export function sanitizeEmailHtml(input: string): string {
	let html = input.replace(/<!--[\s\S]*?-->/g, '');
	html = html.replace(
		/<\s*(script|style|iframe|object|embed|form|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
		''
	);
	html = html.replace(/<\s*(script|style|iframe|object|embed|form|svg|math)\b[^>]*\/?\s*>/gi, '');

	return html.replace(/<\/?\s*([a-zA-Z0-9]+)([^>]*)>/g, (full, rawTag: string, attrs: string) => {
		const name = rawTag.toLowerCase();
		if (!ALLOWED.has(name)) return '';
		const closing = /^<\s*\//.test(full);
		if (name === 'br') return '<br>';
		if (closing) return `</${name}>`;
		if (name !== 'a') return `<${name}>`;

		const hrefMatch = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
		const hrefRaw = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? '';
		const href = sanitizeHref(hrefRaw);
		const button = /\bppp-email-button\b/.test(attrs);
		const classAttr = button ? ' class="ppp-email-button"' : '';
		if (!href) return `<a${classAttr}>`;
		return `<a href="${escapeAttr(href)}"${classAttr}>`;
	});
}

/** Inline styles so the button survives clients that drop classes. */
export function inlineEmailButtonStyles(html: string): string {
	return html.replace(
		/<a href="([^"]*)" class="ppp-email-button">/g,
		'<a href="$1" style="display:inline-block;background:#18181b;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;">'
	);
}

export function emailHtmlToText(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|h2|li)>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

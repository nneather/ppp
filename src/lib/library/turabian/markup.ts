/** Wrap title in italics for HTML; plain uses no markup. */
export function italicTitle(title: string, mode: 'html' | 'plain'): string {
	const t = title.trim();
	if (!t) return '';
	if (mode === 'html') return `<i>${escapeHtml(t)}</i>`;
	return t;
}

export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** En dash between page numbers / years in plain and html. */
export function enDash(a: string, b: string): string {
	return `${a}\u2013${b}`;
}

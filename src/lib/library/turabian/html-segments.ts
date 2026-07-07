export type CitationHtmlSegment = {
	text: string;
	italic: boolean;
};

function unescapeCitationHtml(s: string): string {
	// Inverse of `escape()` in format.ts / publication.ts — only these two entities are emitted.
	return s.replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}

/**
 * Parse `CitationFormatted.html` into flat text runs for non-HTML targets (.docx).
 * The Turabian formatters emit only `<i>…</i>` markup plus `&amp;` / `&lt;` entities,
 * so this stays a two-token split rather than a real HTML parser.
 */
export function parseCitationHtmlSegments(html: string): CitationHtmlSegment[] {
	const segments: CitationHtmlSegment[] = [];
	const parts = html.split(/<\/?i>/);
	// Segments alternate plain / italic starting plain: `a<i>b</i>c` → ['a', 'b', 'c'].
	for (let i = 0; i < parts.length; i++) {
		const text = unescapeCitationHtml(parts[i] ?? '');
		if (text.length === 0) continue;
		segments.push({ text, italic: i % 2 === 1 });
	}
	return segments;
}

export type CitationHtmlSegment = {
	text: string;
	italic: boolean;
};

function unescapeCitationHtml(s: string): string {
	// Inverse of the entities the citation formatters emit. Quote marks are
	// `&ldquo;` / `&rdquo;` (essay and journal titles). Ampersand must be last
	// so `&amp;ldquo;` is not decoded into a quotation mark.
	return s
		.replace(/&lt;/g, '<')
		.replace(/&ldquo;/g, '\u201c')
		.replace(/&rdquo;/g, '\u201d')
		.replace(/&ndash;/g, '\u2013')
		.replace(/&mdash;/g, '\u2014')
		.replace(/&amp;/g, '&');
}

/**
 * Parse `CitationFormatted.html` into flat text runs for non-HTML targets (.docx).
 * The Turabian formatters emit `<i>…</i>` plus a small set of entities,
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

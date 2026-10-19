import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import { parseCitationHtmlSegments } from '$lib/library/turabian/html-segments';
import type { CitationFormatted } from '$lib/library/turabian/types';

export type BibliographyDocxSection = {
	heading: string | null;
	entries: CitationFormatted[];
};

// Twips: 720 = 0.5" (Turabian hanging indent); half-points: 24 = 12pt.
const HANGING_INDENT_TWIPS = 720;
const FONT_SIZE_HALF_POINTS = 24;
const ENTRY_SPACING_AFTER_TWIPS = 240;

function entryParagraph(entry: CitationFormatted): Paragraph {
	const runs = parseCitationHtmlSegments(entry.html).map(
		(segment) => new TextRun({ text: segment.text, italics: segment.italic })
	);
	return new Paragraph({
		indent: { left: HANGING_INDENT_TWIPS, hanging: HANGING_INDENT_TWIPS },
		spacing: { after: ENTRY_SPACING_AFTER_TWIPS },
		children: runs
	});
}

function sectionHeadingParagraph(text: string): Paragraph {
	return new Paragraph({
		spacing: { before: 360, after: 200 },
		children: [new TextRun({ text, bold: true, size: FONT_SIZE_HALF_POINTS })]
	});
}

function bodyParagraphs(
	entries: CitationFormatted[],
	sections?: BibliographyDocxSection[]
): Paragraph[] {
	const heading = new Paragraph({
		alignment: AlignmentType.CENTER,
		spacing: { after: ENTRY_SPACING_AFTER_TWIPS * 2 },
		children: [new TextRun({ text: 'Bibliography' })]
	});
	const children: Paragraph[] = [heading];
	if (sections && sections.length > 0) {
		for (const section of sections) {
			if (section.heading) children.push(sectionHeadingParagraph(section.heading));
			for (const entry of section.entries) children.push(entryParagraph(entry));
		}
		return children;
	}
	for (const entry of entries) children.push(entryParagraph(entry));
	return children;
}

/**
 * Turabian bibliography as a .docx buffer: centered heading, one paragraph per
 * entry with 0.5" hanging indent, italics carried over from CitationFormatted.html.
 * Pass `sections` for research-group headings (bold, no hanging indent).
 * Server-side only — keep `docx` out of the turabian barrel (client bundles import it).
 */
export async function buildBibliographyDocx(
	entries: CitationFormatted[],
	opts?: { sections?: BibliographyDocxSection[] }
): Promise<Uint8Array> {
	const doc = new Document({
		styles: {
			default: {
				document: {
					run: { font: 'Times New Roman', size: FONT_SIZE_HALF_POINTS }
				}
			}
		},
		sections: [
			{
				// docx defaults to A4; Turabian papers are US Letter (12240 x 15840 twips).
				properties: { page: { size: { width: 12240, height: 15840 } } },
				children: bodyParagraphs(entries, opts?.sections)
			}
		]
	});

	return Packer.toBuffer(doc);
}

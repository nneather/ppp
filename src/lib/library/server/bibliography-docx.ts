import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import { parseCitationHtmlSegments } from '$lib/library/turabian/html-segments';
import type { CitationFormatted } from '$lib/library/turabian/types';

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

/**
 * Turabian bibliography as a .docx buffer: centered heading, one paragraph per
 * entry with 0.5" hanging indent, italics carried over from CitationFormatted.html.
 * Server-side only — keep `docx` out of the turabian barrel (client bundles import it).
 */
export async function buildBibliographyDocx(entries: CitationFormatted[]): Promise<Uint8Array> {
	const heading = new Paragraph({
		alignment: AlignmentType.CENTER,
		spacing: { after: ENTRY_SPACING_AFTER_TWIPS * 2 },
		children: [new TextRun({ text: 'Bibliography' })]
	});

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
				children: [heading, ...entries.map((entry) => entryParagraph(entry))]
			}
		]
	});

	return Packer.toBuffer(doc);
}

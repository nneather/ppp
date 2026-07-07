import type { OcrScriptureCandidate } from '$lib/library/ocr-scripture-refs';
import {
	CONFIDENCE_REVIEW_THRESHOLD,
	isDraftRowSaveable,
	mapCandidateToRow,
	sourcePageIndexForCandidate,
	type ScriptureDraftRow,
	type ScripturePageJob
} from '$lib/library/scripture-draft-row';

function applyContinuationCarry(row: ScriptureDraftRow, lastBook: string): string {
	if (row.continuation_from_previous_page && !row.bible_book.trim() && lastBook.length > 0) {
		row.bible_book = lastBook;
		row.continuation_from_previous_page = false;
		const conf = row.confidence_score ?? 1;
		row.needs_review = conf < CONFIDENCE_REVIEW_THRESHOLD;
		row.expanded = row.needs_review;
		row.included = isDraftRowSaveable(row);
	}
	if (row.bible_book.trim().length > 0) return row.bible_book.trim();
	return lastBook;
}

function setPositionInPageSlice(out: ScriptureDraftRow[], pageStartIdx: number, pageEndIdx: number) {
	if (pageEndIdx < pageStartIdx) return;
	const count = pageEndIdx - pageStartIdx + 1;
	for (let i = pageStartIdx; i <= pageEndIdx; i++) {
		if (count === 1) out[i]!.positionInPage = 'only';
		else if (i === pageStartIdx) out[i]!.positionInPage = 'first';
		else if (i === pageEndIdx) out[i]!.positionInPage = 'last';
		else out[i]!.positionInPage = 'middle';
	}
}

function countOcrBoundaryGroups(jobs: ScripturePageJob[]): number {
	let n = 0;
	for (const job of jobs) {
		if (job.status !== 'done' || !job.candidates?.length) continue;
		if (job.isPdf) {
			const indices = new Set<number>();
			for (const c of job.candidates) indices.add(sourcePageIndexForCandidate(c));
			n += indices.size > 0 ? indices.size : 1;
		} else {
			n += 1;
		}
	}
	return n;
}

export function mergeJobsIntoRows(jobs: ScripturePageJob[]): ScriptureDraftRow[] {
	const ordered = [...jobs].sort((a, b) => a.order - b.order);
	const doneJobs = ordered.filter((j) => j.status === 'done' && j.candidates?.length);
	const boundaryTotal = countOcrBoundaryGroups(doneJobs);
	let lastBook = '';
	const out: ScriptureDraftRow[] = [];
	let globalGroupIndex = 0;

	for (const job of ordered) {
		if (job.status !== 'done' || !job.candidates?.length) continue;

		if (job.isPdf) {
			const byPage = new Map<number, OcrScriptureCandidate[]>();
			for (const c of job.candidates) {
				const idx = sourcePageIndexForCandidate(c);
				const list = byPage.get(idx) ?? [];
				list.push(c);
				byPage.set(idx, list);
			}
			const pageIndices = [...byPage.keys()].sort((a, b) => a - b);
			const pdfPageTotal = pageIndices.length > 0 ? Math.max(...pageIndices) + 1 : 1;

			for (const pageIdx of pageIndices) {
				globalGroupIndex++;
				const pageStartIdx = out.length;
				for (const c of byPage.get(pageIdx) ?? []) {
					const row = mapCandidateToRow(c);
					row.source_image_url = job.sourcePath;
					row.pageJobOrder = globalGroupIndex;
					row.pageJobTotal = boundaryTotal;
					row.pageJobId = job.id;
					row.pageLabelKind = 'pdf-page';
					row.pdfPageOrder = pageIdx + 1;
					row.pdfPageTotal = pdfPageTotal;
					lastBook = applyContinuationCarry(row, lastBook);
					out.push(row);
				}
				setPositionInPageSlice(out, pageStartIdx, out.length - 1);
			}
		} else {
			globalGroupIndex++;
			const pageStartIdx = out.length;
			for (const c of job.candidates) {
				const row = mapCandidateToRow(c);
				row.source_image_url = job.sourcePath;
				row.pageJobOrder = globalGroupIndex;
				row.pageJobTotal = boundaryTotal;
				row.pageJobId = job.id;
				row.pageLabelKind = 'file';
				lastBook = applyContinuationCarry(row, lastBook);
				out.push(row);
			}
			setPositionInPageSlice(out, pageStartIdx, out.length - 1);
		}
	}
	return out;
}

export function stampSourcePageIndex(
	candidates: OcrScriptureCandidate[],
	pageIndex: number
): OcrScriptureCandidate[] {
	return candidates.map((c) => ({
		...c,
		source_page_index: c.source_page_index ?? pageIndex
	}));
}

export function pdfOcrWarningText(failedPages: number[], pageTotal: number): string {
	const labels = failedPages.map((i) => `page ${i + 1}/${pageTotal}`).join(', ');
	return `OCR failed on ${labels}. Other pages were extracted — retry failed page(s) on the chip above or add rows manually.`;
}

export function removeCandidatesForPdfPages(
	candidates: OcrScriptureCandidate[],
	pageIndices: number[]
): OcrScriptureCandidate[] {
	const removeSet = new Set(pageIndices);
	return candidates.filter((c) => !removeSet.has(sourcePageIndexForCandidate(c)));
}

export type OcrMergeOutcome = {
	rows: ScriptureDraftRow[];
	extractInfo: string | null;
	extractMessage: string | null;
};

export function finalizeOcrMerge(pages: ScripturePageJob[]): OcrMergeOutcome {
	if (pages.length === 0) {
		return { rows: [], extractInfo: null, extractMessage: null };
	}
	if (!pages.every((p) => p.status === 'done' || p.status === 'error')) {
		return { rows: [], extractInfo: null, extractMessage: null };
	}

	const merged = mergeJobsIntoRows(pages);
	const partialWarnings = pages
		.map((p) => p.pdfOcrWarning)
		.filter((w): w is string => typeof w === 'string' && w.length > 0);

	if (merged.length > 0) {
		return {
			rows: merged,
			extractInfo: partialWarnings.length > 0 ? partialWarnings.join(' ') : null,
			extractMessage: null
		};
	}

	const anyDone = pages.some((p) => p.status === 'done');
	return {
		rows: [],
		extractInfo: anyDone
			? 'No references detected — add manually below.'
			: 'Could not read any page — check errors on the chips above.',
		extractMessage: null
	};
}

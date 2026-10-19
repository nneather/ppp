/**
 * Per-source usage on a study ([243]). Import lands on `candidate`.
 * The compiled bibliography defaults to consulted + cited.
 */
export const STUDY_USAGES = ['candidate', 'consulted', 'cited'] as const;
export type StudyUsage = (typeof STUDY_USAGES)[number];

export const STUDY_USAGE_LABELS: Record<StudyUsage, string> = {
	candidate: 'Candidate',
	consulted: 'Consulted',
	cited: 'Cited'
};

export function parseStudyUsage(raw: string | null | undefined): StudyUsage {
	if (raw === 'candidate' || raw === 'consulted' || raw === 'cited') return raw;
	return 'candidate';
}

/** One tap advances candidate → consulted → cited → candidate. */
export function nextStudyUsage(usage: StudyUsage): StudyUsage {
	const i = STUDY_USAGES.indexOf(usage);
	return STUDY_USAGES[(i + 1) % STUDY_USAGES.length] ?? 'candidate';
}

export function includeInCompiledBibliography(
	usage: StudyUsage,
	includeCandidates: boolean
): boolean {
	if (includeCandidates) return true;
	return usage === 'consulted' || usage === 'cited';
}

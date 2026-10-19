/** Paper XOR sermon parent on `study_sources` and `study_research_groups`. */
export type StudyParent = { kind: 'paper'; id: string } | { kind: 'sermon'; id: string };

export function studyParentField(parent: StudyParent): 'paper_id' | 'sermon_id' {
	return parent.kind === 'paper' ? 'paper_id' : 'sermon_id';
}

/** Plain-text notes for the clipboard, grouped by source. */

export type NoteCopyInput = {
	sourceKey: string;
	sourceLabel: string | null;
	page: string | null;
	passageDisplay: string | null;
	body: string;
	createdAt: string;
};

function locator(note: NoteCopyInput): string {
	const page = note.page?.trim() ?? '';
	const passage = note.passageDisplay?.trim() ?? '';
	if (page && passage) return `${page} (${passage})`;
	return page || passage;
}

function noteLine(label: string, note: NoteCopyInput): string {
	const where = locator(note);
	return where ? `${label}, ${where}: ${note.body}` : `${label}: ${note.body}`;
}

function pageRank(page: string | null): number {
	const match = page?.match(/\d+/);
	return match ? Number.parseInt(match[0]!, 10) : Number.MAX_SAFE_INTEGER;
}

/** Unattached notes first, then each source’s notes by page. */
export function formatStudyNotesCopy(notes: NoteCopyInput[]): string {
	const unattached = notes.filter((note) => !note.sourceKey);
	const groups = new Map<string, { label: string; notes: NoteCopyInput[] }>();
	for (const note of notes) {
		if (!note.sourceKey) continue;
		const existing = groups.get(note.sourceKey);
		if (existing) existing.notes.push(note);
		else groups.set(note.sourceKey, { label: note.sourceLabel?.trim() || 'Source', notes: [note] });
	}
	const ordered = [...groups.values()].sort((a, b) => {
		const aNewest = Math.max(...a.notes.map((note) => Date.parse(note.createdAt) || 0));
		const bNewest = Math.max(...b.notes.map((note) => Date.parse(note.createdAt) || 0));
		return bNewest - aNewest;
	});

	const blocks: string[] = [];
	if (unattached.length > 0) {
		blocks.push(unattached.map((note) => noteLine('Unattached', note)).join('\n'));
	}
	for (const group of ordered) {
		const lines = [...group.notes]
			.sort((a, b) => pageRank(a.page) - pageRank(b.page))
			.map((note) => noteLine(group.label, note));
		blocks.push(lines.join('\n'));
	}
	return blocks.join('\n\n');
}

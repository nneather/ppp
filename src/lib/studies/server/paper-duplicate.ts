import type { SupabaseClient } from '@supabase/supabase-js';
import {
	findPaperDuplicate,
	type LivePaperRef,
	type PaperDuplicate
} from '$lib/studies/paper-dedupe';

type PassageEmbed = {
	bible_book: string;
	chapter_start: number | null;
	verse_start: number | null;
	role: string;
	deleted_at: string | null;
};

type PaperEmbed = {
	id: string;
	title: string;
	passage_display: string | null;
	paper_passages: PassageEmbed[] | null;
};

export async function findLivePaperDuplicate(
	supabase: SupabaseClient,
	candidate: { title: string; passageDisplay: string | null }
): Promise<{ duplicate: PaperDuplicate | null; error: string | null }> {
	const { data, error } = await supabase
		.from('papers')
		.select(
			'id, title, passage_display, paper_passages (bible_book, chapter_start, verse_start, role, deleted_at)'
		)
		.is('deleted_at', null);

	if (error) {
		console.error('[papers] duplicate lookup', error);
		return { duplicate: null, error: error.message };
	}

	const live: LivePaperRef[] = ((data ?? []) as PaperEmbed[]).map((paper) => {
		const primary = (paper.paper_passages ?? []).find(
			(row) => row.deleted_at == null && row.role === 'primary'
		);
		return {
			id: paper.id,
			title: paper.title,
			passageDisplay: paper.passage_display,
			primary: primary
				? {
						bibleBook: primary.bible_book,
						chapter: primary.chapter_start,
						verseStart: primary.verse_start
					}
				: null
		};
	});

	return { duplicate: findPaperDuplicate(candidate, live), error: null };
}

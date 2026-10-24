/** One reading note on a paper or sermon. Client-safe. */
export type StudyNoteView = {
	id: string;
	sourceId: string | null;
	page: string | null;
	passageDisplay: string | null;
	bibleBook: string | null;
	chapter: number | null;
	verseStart: number | null;
	verseEnd: number | null;
	body: string;
	createdAt: string;
};

export type StudyNoteAnchorFields = {
	passage_display: string | null;
	bible_book: string | null;
	chapter: number | null;
	verse_start: number | null;
	verse_end: number | null;
};

/**
 * Commentary lists (sermon shelf, By book, Commentaries:{book} sets) include
 * a volume only when the library marks it owned. An essay uses the parent
 * book. Parked (`shelf_dismissed`) is a later filter on that owned set.
 */
export function commentaryCoverageOwned(row: {
	kind: 'book' | 'essay';
	/** The volume when `kind` is `book`. Ignored for an essay. */
	bookOwned: boolean;
	/** The parent volume when `kind` is `essay`. */
	parentOwned: boolean | null;
}): boolean {
	if (row.kind === 'essay') return row.parentOwned === true;
	return row.bookOwned === true;
}

export function ownedCommentaryBook(book: { owned: boolean } | null | undefined): boolean {
	return commentaryCoverageOwned({
		kind: 'book',
		bookOwned: book?.owned === true,
		parentOwned: null
	});
}

/** Essay coverage follows the parent book, which is the volume on the shelf. */
export function ownedCommentaryEssay(parent: { owned: boolean } | null | undefined): boolean {
	return commentaryCoverageOwned({
		kind: 'essay',
		bookOwned: false,
		parentOwned: parent?.owned ?? null
	});
}

import {
	formatSystematicVerseSpan,
	groupSystematicPointersByVerse,
	type SystematicPointer,
	type SystematicSetBlock
} from '$lib/library/outline';
import { visibleSystematicRefs } from '$lib/studies/systematics-dismiss';

export type SystematicPassageHit = {
	key: string;
	bookId: string;
	refId: string;
	display: string;
	verseLabel: string | null;
	seriesName: string | null;
	authorLabel: string | null;
	dismissed?: boolean;
};

export type SystematicCardModel = {
	key: string;
	title: string;
	meta: string | null;
	span: string | null;
	rows: SystematicPassageHit[];
};

function toHit(
	pointer: Pick<SystematicPointer, 'refId' | 'bookId' | 'display'>,
	verseLabel: string | null,
	seriesName: string | null,
	authorLabel: string | null,
	dismissed: ReadonlySet<string>
): SystematicPassageHit {
	return {
		key: pointer.refId,
		bookId: pointer.bookId,
		refId: pointer.refId,
		display: pointer.display,
		verseLabel,
		seriesName,
		authorLabel,
		dismissed: dismissed.has(pointer.refId)
	};
}

function setCards(
	blocks: SystematicSetBlock[],
	dismissed: ReadonlySet<string>,
	showDismissed: boolean
): SystematicCardModel[] {
	return blocks.flatMap((block) => {
		const pointers = visibleSystematicRefs(block.pointers, dismissed, showDismissed);
		if (pointers.length === 0) return [];
		return [
			{
				key: block.seriesId ?? block.seriesName,
				title: block.seriesName,
				meta: block.authorLabel,
				span: formatSystematicVerseSpan(pointers),
				rows: pointers.map((pointer) =>
					toHit(pointer, pointer.verseLabel, null, null, dismissed)
				)
			}
		];
	});
}

function verseCards(
	groups: ReturnType<typeof groupSystematicPointersByVerse>,
	dismissed: ReadonlySet<string>,
	showDismissed: boolean
): SystematicCardModel[] {
	return groups.flatMap((group) => {
		const visible = visibleSystematicRefs(group.rows, dismissed, showDismissed);
		if (visible.length === 0) return [];
		return [
			{
				key: group.verseLabel,
				title: group.verseLabel,
				meta: null,
				span: null,
				rows: visible.map((row) => toHit(row, null, row.seriesName, row.authorLabel, dismissed))
			}
		];
	});
}

export function systematicDisplayCards(
	blocks: SystematicSetBlock[],
	sort: 'systematic' | 'verse',
	dismissed: ReadonlySet<string>,
	showDismissed: boolean
): SystematicCardModel[] {
	if (sort === 'systematic') return setCards(blocks, dismissed, showDismissed);
	return verseCards(groupSystematicPointersByVerse(blocks), dismissed, showDismissed);
}

export function dismissedSystematicCount(
	blocks: SystematicSetBlock[],
	dismissed: ReadonlySet<string>
): number {
	return blocks.reduce(
		(count, block) => count + block.pointers.filter((pointer) => dismissed.has(pointer.refId)).length,
		0
	);
}

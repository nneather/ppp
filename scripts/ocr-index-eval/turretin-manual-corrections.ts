/**
 * Hand-reviewed corrections for FineReader mangled lines (keyed page:col:raw).
 * Merged into parse via `manualReviewBlocks()` — durable without turretin.review.txt churn.
 */
import { blockKey, type ReviewBlock } from './turretin-review.ts';

export type ManualFix = {
	book: string;
	corrected: string;
};

export type ManualSkip = {
	book: string;
	why: string;
};

function parseManualKey(key: string): { printedPage: number; column: number; raw: string } | null {
	const m = key.match(/^(\d+):(\d+):(.+)$/);
	if (!m) return null;
	return { printedPage: Number(m[1]), column: Number(m[2]), raw: m[3] };
}

export const MANUAL_CORRECTIONS: Record<string, ManualFix> = {
	// Deuteronomy glued chapter:verse (missing colon)
	'743:2:319-1:137': { book: 'Deuteronomy', corrected: '31:9—1:137' },
	'743:2:3239—1:181': { book: 'Deuteronomy', corrected: '32:39—1:181' },
	'743:2:3311—3:437': { book: 'Deuteronomy', corrected: '33:11—3:437' },
	'743:2:33:2-2:225 33 5—3:317': {
		book: 'Deuteronomy',
		corrected: '33:2—2:225, 33:5—3:317'
	},
	'742:3:B:32-2:20, 707, 3:287': {
		book: 'Deuteronomy',
		corrected: '13:32—2:20, 707, 3:287'
	},
	// Genesis (4-as-dash / comma verses)
	'739:1:1:941-1:451': { book: 'Genesis', corrected: '1:9,10—1:451' },
	'740:1:16:742-1:558': { book: 'Genesis', corrected: '16:7–12—1:558' },
	'740:1:17:944-2:223, 3:342': { book: 'Genesis', corrected: '17:9–14—2:223, 3:342' },
	'740:1:18:145-1:186': { book: 'Genesis', corrected: '18:1–15—1:186' },
	// Exodus mega-line
	'741:2:23:20, 21-1:276, 2:197, 225 23 20-25-2:26 23 24—2:26': {
		book: 'Exodus',
		corrected: '23:20, 21—1:276, 2:197, 2:225'
	},
	// 2 Samuel / Daniel OCR l→1
	'744:2:21:lfF.—2:68': { book: '2 Samuel', corrected: '21:1—2:68' },
	'752:2:l:8fF.—2:20': { book: 'Daniel', corrected: '1:8—2:20' },
	// 2 Chronicles
	'745:2:21:16,17,19-1:79': { book: '2 Chronicles', corrected: '21:16–19—1:79' },
	'745:2:28:3, 4-3:49 28 24, 25-3:49': {
		book: '2 Chronicles',
		corrected: '28:3, 4—3:49, 28:24, 25—3:49'
	},
	'745:2:2910—3:318 29 30, 31-3:262': {
		book: '2 Chronicles',
		corrected: '29:10—3:318, 29:30, 31—3:262'
	},
	// Psalms
	'747:2:92:14-2:605 94 9—1:179': {
		book: 'Psalms',
		corrected: '92:14—2:605, 94:9—1:179'
	},
	'747:2:95:7, 8-2:415 95 9-1:283': {
		book: 'Psalms',
		corrected: '95:7, 8—2:415, 95:9—1:283'
	},
	'748:1:139:740-1:198, 2:358': { book: 'Psalms', corrected: '139:7–10—1:198, 2:358' },
	'748:1:D9:l-4-1:209': { book: 'Psalms', corrected: '139:1–4—1:209' },
	'748:2:9412—2:663': { book: 'Psalms', corrected: '94:12—2:663' },
	// Jeremiah / Luke
	'751:2:22:18, 19-1:76 22 21-1:631': {
		book: 'Jeremiah',
		corrected: '22:18, 19—1:76, 22:21—1:631'
	},
	'751:2:23:5-1:80, 2:291 23 5, 6-1:283, 2:198,': {
		book: 'Jeremiah',
		corrected: '23:5—1:80, 2:291, 23:5, 6—1:283, 2:198, 2:487'
	},
	'751:2:23:9-1:448 23 21—1:161, 3:212': {
		book: 'Jeremiah',
		corrected: '23:9—1:448, 23:21—1:161, 3:212'
	},
	'751:2:23:27, 28-3:74 23 32-3:212': {
		book: 'Jeremiah',
		corrected: '23:27, 28—3:74, 23:32—3:212'
	},
	'758:1:l:67ff.—2:300': { book: 'Luke', corrected: '1:67—2:300' },
	'759:2:24:28-2:76,133 24 30-3:458': {
		book: 'Luke',
		corrected: '24:28—2:76, 133, 24:30—3:458'
	},
	// 1 Maccabees whole-book pointer
	'754:1:book of—3:49': { book: '1 Maccabees', corrected: '1–16—3:49' },
	// Matthew / Acts (B:/D: → 13:)
	'755:2:12:lff.-2:399': { book: 'Matthew', corrected: '12:1—2:399' },
	'755:3:B:23-2:588, 589': { book: 'Matthew', corrected: '13:23—2:588, 589' },
	'763:3:B:6-3:510': { book: 'Acts', corrected: '13:6—3:510' },
	'763:3:D:30-2:365': { book: 'Acts', corrected: '13:30—2:365' },
	'762:3:3:25-2:169,170,171,194. 307': {
		book: 'Acts',
		corrected: '3:25—2:169, 170, 171, 194, 307'
	},
	// Romans ff. stripped
	'765:2:4:12ff.—2:205': { book: 'Romans', corrected: '4:12—2:205' },
	'765:3:5:12ff.—1:617, 628': { book: 'Romans', corrected: '5:12—1:617, 628' },
	'767:1:9:30ff.-1:361': { book: 'Romans', corrected: '9:30—1:361' },
	'767:2:12:lff.-2:703': { book: 'Romans', corrected: '12:12—2:703' },
	// John / Romans glued verses
	'760:3:8:141-1:115': { book: 'John', corrected: '8:1–11—1:115' },
	'762:1:16:1345-1:310': { book: 'John', corrected: '16:13–15—1:310' },
	'766:1:7:1749-2:698': { book: 'Romans', corrected: '7:17–19—2:698' },
	// 1 Corinthians (printing error + glued verse)
	'769:2:13:13-3:22, 27, 28, 377, 383, 385, 400, 474, 514': {
		book: '1 Corinthians',
		corrected: '12:13—3:22, 27, 28, 377, 383, 385, 400, 474, 514'
	},
	'769:3:15:1345-3:567-68': { book: '1 Corinthians', corrected: '15:13–15—3:567-68' },
	// Publisher typo: volume 4 does not exist (Parker, 2026-10-20)
	'769:1:10:16,17-4:445': { book: '1 Corinthians', corrected: '10:16,17—3:445' },
	'768:3:7:18ff.-3:255': { book: '1 Corinthians', corrected: '7:18—3:255' },
	'769:2:12:14-3:153': { book: '1 Corinthians', corrected: '12:14—3:153' },
	'769:2:12:15-3:153': { book: '1 Corinthians', corrected: '12:15—3:153' },
	'769:2:12:20, 21-3:153': { book: '1 Corinthians', corrected: '12:20, 21—3:153' },
	'769:2:12:27-1:186, 3:12, 467': {
		book: '1 Corinthians',
		corrected: '12:27—1:186, 3:12, 467'
	},
	'769:2:12:28-1:99, 3:200, 276': {
		book: '1 Corinthians',
		corrected: '12:28—1:99, 3:200, 276'
	},
	'769:2:12:28, 29-3:149': { book: '1 Corinthians', corrected: '12:28, 29—3:149' },
	'769:2:12:31-2:134': { book: '1 Corinthians', corrected: '12:31—2:134' },
	'769:3:14:40-1:135, 2:164, 3:213 290': {
		book: '1 Corinthians',
		corrected: '14:40—1:135, 2:164, 3:213, 290'
	},
	// Galatians
	'771:1:1:7—2:6B': { book: 'Galatians', corrected: '1:7—2:613' },
	// 2 Maccabees column order (printed 15:39 before 15:14)
	'754:2:15:39—2:14': { book: '2 Maccabees', corrected: '15:14—2:14' },
	// 1 Peter glued verse (printed index; not Philippians)
	'777:3:1:1042-2:228': { book: '1 Peter', corrected: '1:10–12—2:228' },
	// Revelation glued verses + ff.
	'779:3:6:941-1:484': { book: 'Revelation', corrected: '6:9–11—1:484' },
	'780:1:8:1042-3:589': { book: 'Revelation', corrected: '8:10–12—3:589' },
	'780:1:12:11-2:21142, 221': { book: 'Revelation', corrected: '12:11—2:211-12, 221' },
	'780:2:19:lff.-3:636': { book: 'Revelation', corrected: '19:1—3:636' },
	// Proverbs ff.
	'748:2:8:27ff.-1:287': { book: 'Proverbs', corrected: '8:27—1:287' }
};

export const MANUAL_SKIPS: Record<string, ManualSkip> = {
	'739:1:Index of S': { book: '', why: 'header fragment' },
	'739:2:cripture and A': { book: 'Genesis', why: 'header fragment' },
	'739:3:pocrypha': { book: 'Genesis', why: 'header fragment' },
	'745:3:1:64': { book: 'Esther', why: 'orphan page token without scripture ref' },
	'749:2:2:198, 290-91, 304, 376, 392, 398, 463': {
		book: 'Isaiah',
		why: 'locator-only fragment'
	},
	'770:3:652-53, 671, 3:352': { book: 'Hebrews', why: 'locator-only fragment' },
	'772:1:332, 357-58, 363, 2:685': { book: 'James', why: 'locator-only fragment' },
	'772:1:Ill INDEX': { book: 'Ephesians', why: 'running header' },
	'751:2:\'■87': { book: 'Jeremiah', why: 'OCR garbage' }
};

export function manualReviewBlocks(): ReviewBlock[] {
	const blocks: ReviewBlock[] = [];
	for (const [key, fix] of Object.entries(MANUAL_CORRECTIONS)) {
		const loc = parseManualKey(key);
		if (!loc) continue;
		blocks.push({
			printedPage: loc.printedPage,
			column: loc.column,
			raw: loc.raw,
			book: fix.book,
			corrected: fix.corrected,
			reason: 'manual correction'
		});
	}
	for (const [key, skip] of Object.entries(MANUAL_SKIPS)) {
		const loc = parseManualKey(key);
		if (!loc) continue;
		blocks.push({
			printedPage: loc.printedPage,
			column: loc.column,
			raw: loc.raw,
			book: skip.book || undefined,
			skip: skip.why,
			reason: 'manual skip'
		});
	}
	return blocks;
}

/** Manual entries override review-file blocks on the same page:col:raw. */
export function mergeReviewCorrections(prior: ReviewBlock[], manual: ReviewBlock[]): ReviewBlock[] {
	const byKey = new Map<string, ReviewBlock>();
	for (const b of prior) {
		if (!b.raw?.trim()) continue;
		byKey.set(blockKey(b), b);
	}
	for (const b of manual) {
		const k = blockKey(b);
		const existing = byKey.get(k);
		if (existing) {
			const merged: ReviewBlock = {
				...existing,
				book: b.book ?? existing.book,
				corrected: b.corrected ?? existing.corrected,
				skip: b.skip ?? existing.skip
			};
			if (merged.corrected?.trim()) merged.skip = undefined;
			byKey.set(k, merged);
		} else {
			byKey.set(k, b);
		}
	}
	return [...byKey.values()];
}

export function manualFixForBlock(block: ReviewBlock): { corrected?: string; skip?: string } {
	const key = blockKey(block);
	const skip = MANUAL_SKIPS[key];
	if (skip) return { skip: skip.why };
	const fix = MANUAL_CORRECTIONS[key];
	if (fix) return { corrected: fix.corrected };
	return {};
}

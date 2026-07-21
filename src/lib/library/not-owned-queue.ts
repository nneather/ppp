/**
 * Curated Goodreads not-owned queue ([101]).
 * Source: brainstorms/2026-07-17-goodreads-not-owned-queue.md
 * Do not invent ISBNs; create via /settings/library/not-owned only.
 */

export type NotOwnedQueueItem = {
	/** Stable key for UI / FormData (slug of title). */
	key: string;
	title: string;
	author: string | null;
	rating: number | null;
	notes: string | null;
};

function keyFor(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 80);
}

export const NOT_OWNED_QUEUE: readonly NotOwnedQueueItem[] = [
	{
		key: keyFor('Letters to Malcolm: Chiefly on Prayer'),
		title: 'Letters to Malcolm: Chiefly on Prayer',
		author: 'C.S. Lewis',
		rating: 5,
		notes: null
	},
	{
		key: keyFor('The Chronicles of Narnia (box set)'),
		title: 'The Chronicles of Narnia (box set)',
		author: 'C.S. Lewis',
		rating: 4,
		notes: 'Individuals already catalogued'
	},
	{
		key: keyFor('A Little Book on the Christian Life'),
		title: 'A Little Book on the Christian Life',
		author: 'John Calvin',
		rating: 5,
		notes: null
	},
	{
		key: keyFor('Delighting in the Trinity'),
		title: 'Delighting in the Trinity',
		author: 'Michael Reeves',
		rating: 5,
		notes: null
	},
	{
		key: keyFor("Paul's Concept of Inheritance"),
		title: "Paul's Concept of Inheritance",
		author: 'James D. Hester',
		rating: 5,
		notes: null
	},
	{
		key: keyFor('Redeemer Church Planting Manual'),
		title: 'Redeemer Church Planting Manual',
		author: 'Thompson & Keller',
		rating: 5,
		notes: null
	},
	{
		key: keyFor('The Incarnation of God'),
		title: 'The Incarnation of God',
		author: 'John C. Clark',
		rating: 5,
		notes: null
	},
	{
		key: keyFor('Letters to Children'),
		title: 'Letters to Children',
		author: 'C.S. Lewis',
		rating: 5,
		notes: 'Ed. Lyle Dorsett'
	},
	{
		key: keyFor('How to Read a Book'),
		title: 'How to Read a Book',
		author: 'Mortimer J. Adler',
		rating: 5,
		notes: null
	},
	{
		key: keyFor('Anxious'),
		title: 'Anxious',
		author: 'Amy Simpson',
		rating: 4,
		notes: null
	},
	{
		key: keyFor('Bruchko'),
		title: 'Bruchko',
		author: 'Bruce Olson',
		rating: 4,
		notes: null
	},
	{
		key: keyFor('Creation and Fall/Temptation'),
		title: 'Creation and Fall/Temptation',
		author: 'Dietrich Bonhoeffer',
		rating: 4,
		notes: null
	},
	{
		key: keyFor('Godly Jealousy'),
		title: 'Godly Jealousy',
		author: 'Erik Thoennes',
		rating: 4,
		notes: null
	},
	{
		key: keyFor('Show Them No Mercy'),
		title: 'Show Them No Mercy',
		author: 'Stanley N. Gundry',
		rating: 4,
		notes: null
	},
	{
		key: keyFor('To Seek and to Save'),
		title: 'To Seek and to Save',
		author: 'Sinclair B. Ferguson',
		rating: 4,
		notes: null
	},
	{
		key: keyFor('Rise and Walk'),
		title: 'Rise and Walk',
		author: 'Dennis Byrd',
		rating: 4,
		notes: null
	},
	{
		key: keyFor('Singletary on Singletary'),
		title: 'Singletary on Singletary',
		author: 'Mike Singletary',
		rating: 4,
		notes: null
	},
	{
		key: keyFor('Jesus Freaks'),
		title: 'Jesus Freaks',
		author: 'D.C. Talk',
		rating: 4,
		notes: null
	},
	{
		key: keyFor('Hiking Trails in the Collegiate Peaks Wilderness Area'),
		title: 'Hiking Trails in the Collegiate Peaks Wilderness Area',
		author: 'Davis Lora',
		rating: 4,
		notes: null
	},
	{
		key: keyFor('Hiking and Backpacking'),
		title: 'Hiking and Backpacking',
		author: 'Karen Berger',
		rating: 4,
		notes: null
	},
	{
		key: keyFor("Bonhoeffer's Black Jesus"),
		title: "Bonhoeffer's Black Jesus",
		author: 'Reggie L. Williams',
		rating: 3,
		notes: null
	},
	{
		key: keyFor('Essentials of Economics'),
		title: 'Essentials of Economics',
		author: 'Stanley L. Brue',
		rating: 3,
		notes: null
	},
	{
		key: keyFor('Financial Accounting'),
		title: 'Financial Accounting',
		author: 'Thomas R. Dyckman',
		rating: 3,
		notes: null
	},
	{
		key: keyFor('Applied Mathematics'),
		title: 'Applied Mathematics',
		author: 'R. Jesse Phagan',
		rating: 2,
		notes: null
	}
];

export function normalizeTitleKey(title: string): string {
	return title
		.toLowerCase()
		.replace(/['']/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');
}

export function findQueueItem(key: string): NotOwnedQueueItem | null {
	return NOT_OWNED_QUEUE.find((i) => i.key === key) ?? null;
}

import type { PublisherRow } from '$lib/types/library';

/** Join shape from Supabase nested `publishers` select. */
export type PublisherJoin = {
	id: string;
	canonical_name: string;
	default_location: string | null;
	parent?: { default_location: string | null } | null;
};

export function publisherJoinFromRow(pub: PublisherRow | null | undefined): PublisherJoin | null {
	if (!pub) return null;
	return {
		id: pub.id,
		canonical_name: pub.canonical_name,
		default_location: pub.default_location,
		parent: pub.parent_default_location != null ? { default_location: pub.parent_default_location } : null
	};
}

/** Per-book override → imprint default → parent default. */
export function publisherEffectiveLocation(
	bookLocation: string | null | undefined,
	pub: PublisherJoin | null | undefined
): string | null {
	const trimmed = bookLocation?.trim();
	if (trimmed) return trimmed;
	const self = pub?.default_location?.trim();
	if (self) return self;
	const parent = pub?.parent?.default_location?.trim();
	if (parent) return parent;
	return null;
}

/** Canonical imprint name when linked; otherwise free-text on the book. */
export function publisherCanonicalText(
	bookPublisher: string | null | undefined,
	pub: PublisherJoin | null | undefined
): string | null {
	const canonical = pub?.canonical_name?.trim();
	if (canonical) return canonical;
	const raw = bookPublisher?.trim();
	return raw || null;
}

export function publisherDefaultLocationForRow(row: PublisherRow): string | null {
	const self = row.default_location?.trim();
	if (self) return self;
	const parent = row.parent_default_location?.trim();
	if (parent) return parent;
	return null;
}

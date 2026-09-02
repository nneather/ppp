import { CONTEXT_TYPES, type ContextType } from '$lib/types/sermons';

export function parseContextType(raw: string | null | undefined): ContextType | null {
	if (!raw) return null;
	return (CONTEXT_TYPES as readonly string[]).includes(raw) ? (raw as ContextType) : null;
}

export function contextTypeForVenue(
	venues: ReadonlyArray<{ id: string; context_type: ContextType | null }>,
	venueId: string | null | undefined
): ContextType | null {
	if (!venueId) return null;
	return venues.find((v) => v.id === venueId)?.context_type ?? null;
}

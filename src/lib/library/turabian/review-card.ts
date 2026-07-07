import type { ReviewCard } from '$lib/types/library';
import { citationAuthorsForBook, type BookCitationInput } from './types';

export function reviewCardToCitationInput(card: ReviewCard): BookCitationInput {
	return {
		id: card.id,
		title: card.title,
		subtitle: card.subtitle,
		publisher: card.publisher_canonical ?? card.publisher,
		publisher_location: card.publisher_effective_location ?? card.publisher_location,
		year: card.year,
		edition: card.edition,
		total_volumes: card.total_volumes,
		original_year: card.original_year,
		reprint_publisher: card.reprint_publisher,
		reprint_location: card.reprint_location,
		reprint_year: card.reprint_year,
		series_name: card.series_name,
		series_abbreviation: card.series_abbreviation,
		volume_number: card.volume_number,
		genre: card.genre,
		work_type: card.work_type,
		language: card.language,
		authors: citationAuthorsForBook(card)
	};
}

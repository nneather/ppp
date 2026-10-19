import { describe, expect, it } from 'vitest';
import { sourcesForDefaultAttach } from '../default-attach';
import { resolveSetMembers, type RuleCandidate } from '../resource-sets';

describe('sourcesForDefaultAttach', () => {
	it('omits sticky excludes', () => {
		const candidates: RuleCandidate[] = [
			{ bookId: 'calvin', essayId: null, title: 'Institutes', createdAt: null },
			{ bookId: 'turretin', essayId: null, title: 'Elenctic', createdAt: null }
		];
		const { included } = resolveSetMembers({
			candidates,
			overrides: [
				{ kind: 'exclude', bookId: 'turretin', essayId: null, title: 'Elenctic' }
			],
			lastReviewedAt: null
		});
		expect(sourcesForDefaultAttach(included)).toEqual([
			{ bookId: 'calvin', essayId: null }
		]);
	});

	it('omits reference-only members', () => {
		const candidates: RuleCandidate[] = [
			{ bookId: 'lexicon', essayId: null, title: 'BDAG', createdAt: null },
			{ bookId: 'concordance', essayId: null, title: "Englishman's", createdAt: null }
		];
		const { included } = resolveSetMembers({
			candidates,
			overrides: [
				{ kind: 'include', bookId: 'concordance', essayId: null, title: "Englishman's", bibliographical: false }
			],
			lastReviewedAt: null
		});
		expect(sourcesForDefaultAttach(included)).toEqual([{ bookId: 'lexicon', essayId: null }]);
	});
});

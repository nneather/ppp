import { describe, expect, it } from 'vitest';
import {
	applyIndexQualifierFields,
	indexNoteNeedsReview
} from '../scripture-index-qualifiers';

describe('applyIndexQualifierFields', () => {
	it('moves a version tag off the locator', () => {
		const q = applyIndexQualifierFields('1.13.14, cf Vg', null);
		expect(q.pageStart).toBe('1.13.14');
		expect(q.reviewNote).toBe('cf Vg');
		expect(q.edition).toBeNull();
		expect(indexNoteNeedsReview(q.reviewNote)).toBe(false);
	});

	it('leaves a page token and a roman locator alone', () => {
		expect(applyIndexQualifierFields('2:620', null).pageStart).toBe('2:620');
		expect(applyIndexQualifierFields('III.2.12', null).pageStart).toBe('III.2.12');
		expect(applyIndexQualifierFields('pp. 249ff', null).pageStart).toBe('pp. 249ff');
	});

	it('keeps PA on the pointer and marks the edition', () => {
		const q = applyIndexQualifierFields('PA 3', null);
		expect(q.pageStart).toBe('PA 3');
		expect(q.edition).toBe('PA');
		expect(indexNoteNeedsReview(q.reviewNote)).toBe(true);
	});
});

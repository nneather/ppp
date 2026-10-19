import type { Language } from '$lib/types/library';

const RE_EN_ARTICLE = /^(the|a|an)\s+/i;
/** German definite + indefinite articles as whole words at title start. */
const RE_DE_ARTICLE =
	/^(der|die|das|den|dem|des|ein|eine|einer|eines|einem|einen)\s+/i;
/** English + German — used for sort keys regardless of `books.language`. */
const RE_ANY_ARTICLE =
	/^(the|a|an|der|die|das|den|dem|des|ein|eine|einer|eines|einem|einen)\s+/i;

function stripAnyArticles(title: string): string {
	let t = title.trim();
	let prev = '';
	while (t !== prev) {
		prev = t;
		t = t.replace(RE_ANY_ARTICLE, '').trim();
	}
	return t;
}

/**
 * Strip leading articles for short-title display (preserves case).
 * Language-aware: German titles also drop German articles; English keeps
 * the historical English-only strip. Omit language to strip both families.
 */
export function stripLeadingArticleDisplay(title: string | null, language?: Language | null): string {
	if (!title) return '';
	let t = title.trim();
	if (language === 'german') {
		t = t.replace(RE_DE_ARTICLE, '');
		t = t.replace(RE_EN_ARTICLE, '');
		return t.trim();
	}
	if (language === 'english') {
		return t.replace(RE_EN_ARTICLE, '').trim();
	}
	return stripAnyArticles(t);
}

/**
 * Sort key: leading EN + DE articles stripped. Display titles stay unchanged —
 * only the compare key loses the article. `language` is accepted for call-site
 * compatibility and ignored (mixed shelves / wrong language tags still sort right).
 */
export function titleSortKey(title: string | null, _language?: Language | null): string {
	if (!title) return '';
	return stripAnyArticles(title).toLocaleLowerCase();
}

/**
 * Strip English + German leading articles repeatedly for importer title
 * matching (CSV rows may not carry language).
 */
export function stripArticlesForImporterMatchKey(loweredNfd: string): string {
	return stripAnyArticles(loweredNfd);
}

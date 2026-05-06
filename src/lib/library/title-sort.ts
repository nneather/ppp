import type { Language } from '$lib/types/library';

const RE_EN_ARTICLE = /^(the|a|an)\s+/i;
/** German definite + indefinite articles as whole words at title start. */
const RE_DE_ARTICLE =
	/^(der|die|das|den|dem|des|ein|eine|einer|eines|einem|einen)\s+/i;

/**
 * Sort key: leading articles stripped for locale-aware title ordering.
 * English path matches legacy behavior. German uses German articles (and
 * still strips English for mixed-language titles).
 */
export function titleSortKey(title: string | null, language?: Language | null): string {
	if (!title) return '';
	let t = title.trim();
	if (language === 'german') {
		t = t.replace(RE_DE_ARTICLE, '');
		t = t.replace(RE_EN_ARTICLE, '');
	} else {
		t = t.replace(RE_EN_ARTICLE, '');
	}
	return t.toLocaleLowerCase();
}

/**
 * Strip English + German leading articles repeatedly for importer title
 * matching (CSV rows may not carry language).
 */
export function stripArticlesForImporterMatchKey(loweredNfd: string): string {
	let out = loweredNfd.trim();
	let prev = '';
	while (out !== prev) {
		prev = out;
		out = out.replace(
			/^(the|a|an|der|die|das|den|dem|des|ein|eine|einer|eines|einem|einen)\s+/i,
			''
		);
	}
	return out;
}

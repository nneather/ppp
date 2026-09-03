export const MODULE_SLUGS = [
	'library',
	'invoicing',
	'calendar',
	'projects',
	'sermons',
	'sports',
	'classwork',
	'contacts'
] as const;
export type ModuleSlug = (typeof MODULE_SLUGS)[number];

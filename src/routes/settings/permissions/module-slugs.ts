export const MODULE_SLUGS = [
	'library',
	'invoicing',
	'calendar',
	'projects',
	'sermons',
	'studies',
	'sports',
	'classwork',
	'contacts'
] as const;
export type ModuleSlug = (typeof MODULE_SLUGS)[number];

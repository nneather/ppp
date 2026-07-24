export const MODULE_SLUGS = [
	'library',
	'invoicing',
	'calendar',
	'projects',
	'sermons',
	'classwork'
] as const;
export type ModuleSlug = (typeof MODULE_SLUGS)[number];

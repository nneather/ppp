export const MODULE_SLUGS = ['library', 'invoicing', 'calendar', 'projects', 'sermons'] as const;
export type ModuleSlug = (typeof MODULE_SLUGS)[number];

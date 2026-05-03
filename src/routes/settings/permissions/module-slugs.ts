export const MODULE_SLUGS = ['library', 'invoicing', 'calendar', 'projects'] as const;
export type ModuleSlug = (typeof MODULE_SLUGS)[number];

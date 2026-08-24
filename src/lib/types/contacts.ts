/** Closed enums and view-models for the contacts / CRM module. */

/** @deprecated Rolling cadence — replaced by ContactFrequency ([210]). Kept for legacy columns. */
export const DEFAULT_CONTACT_CADENCE_DAYS = 90;

export const CONTACT_STATUSES = ['active', 'retired'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
	active: 'Active',
	retired: 'Retired'
};

/** Meet resets due-to-meet; card does not ([181] / Session 3). */
export const CONTACT_TOUCH_KINDS = ['meet', 'card'] as const;
export type ContactTouchKind = (typeof CONTACT_TOUCH_KINDS)[number];

export const CONTACT_TOUCH_KIND_LABELS: Record<ContactTouchKind, string> = {
	meet: 'Meet',
	card: 'Card'
};

/** Calendar-period meet frequency (sheet C/Q/S/A/N). */
export const CONTACT_FREQUENCIES = [
	'common',
	'quarterly',
	'semiannual',
	'annual',
	'none'
] as const;
export type ContactFrequency = (typeof CONTACT_FREQUENCIES)[number];

export const CONTACT_FREQUENCY_LABELS: Record<ContactFrequency, string> = {
	common: 'Common (no reminder)',
	quarterly: 'Quarterly',
	semiannual: 'Semester',
	annual: 'Annual',
	none: 'None scheduled'
};

/** Sheet letter / word → enum (keys are uppercase). */
export const FREQUENCY_FROM_SHEET: Record<string, ContactFrequency> = {
	C: 'common',
	Q: 'quarterly',
	S: 'semiannual',
	A: 'annual',
	N: 'none',
	COMMON: 'common',
	QUARTERLY: 'quarterly',
	SEMESTER: 'semiannual',
	SEMIANNUAL: 'semiannual',
	BIANNUAL: 'semiannual',
	ANNUAL: 'annual',
	NONE: 'none'
};

export const GIVING_GRADES = ['A', 'B', 'C', 'D', 'E'] as const;
export type GivingGrade = (typeof GIVING_GRADES)[number];

export const RELATIONSHIP_GRADES = ['A', 'B', 'C', 'D'] as const;
export type RelationshipGrade = (typeof RELATIONSHIP_GRADES)[number];

export const CONTACT_LIST_KINDS = ['standing', 'ad_hoc'] as const;
export type ContactListKind = (typeof CONTACT_LIST_KINDS)[number];

export const CONTACT_LIST_KIND_LABELS: Record<ContactListKind, string> = {
	standing: 'Standing',
	ad_hoc: 'Ad hoc'
};

export const CONTACT_LIST_FILTERS = ['active', 'retired', 'all'] as const;
export type ContactListFilter = (typeof CONTACT_LIST_FILTERS)[number];

export type HouseholdChildRow = {
	id: string;
	household_id: string;
	first_name: string;
	last_name: string | null;
	birthday: string | null;
	notes: string | null;
	sort_order: number;
};

export type HouseholdGradeChangeRow = {
	id: string;
	household_id: string;
	changed_on: string;
	giving_grade: GivingGrade | null;
	relationship_grade: RelationshipGrade | null;
	note: string | null;
};

export type HouseholdRow = {
	id: string;
	name: string;
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state: string | null;
	postal_code: string | null;
	country: string | null;
	notes: string | null;
	giving_grade: GivingGrade | null;
	relationship_grade: RelationshipGrade | null;
	address_updated_on: string | null;
	/** Live contacts assigned to this household. */
	memberCount: number;
};

export type ContactListRow = {
	id: string;
	first_name: string;
	last_name: string | null;
	display_name: string;
	household_id: string | null;
	household_name: string | null;
	email: string | null;
	phone: string | null;
	/** @deprecated Prefer frequency */
	cadence_days: number | null;
	/** @deprecated Prefer frequency */
	effective_cadence_days: number;
	frequency: ContactFrequency;
	/** @deprecated Mapped from frequency === 'common' for old UI */
	no_reminders: boolean;
	status: ContactStatus;
	notes: string | null;
	birthday: string | null;
	last_touched_on: string | null;
	giving_grade: GivingGrade | null;
	relationship_grade: RelationshipGrade | null;
};

export type ContactTouchRow = {
	id: string;
	contact_id: string;
	touched_on: string;
	note: string | null;
	kind: ContactTouchKind;
};

export type ContactListDef = {
	id: string;
	name: string;
	notes: string | null;
	sort_order: number;
	kind: ContactListKind;
	memberCount: number;
};

export type ContactListMemberRow = {
	id: string;
	list_id: string;
	contact_id: string | null;
	household_id: string | null;
	/** Display label for the member (contact name or household name). */
	label: string;
	kind: 'contact' | 'household';
	/**
	 * Household members only (C2): false when every live member is retired
	 * (or household empty). Filtered out of the effective Christmas card roster
	 * unless `includeIneligible` is set on the loader.
	 */
	cardEligible?: boolean;
};

export type ContactsListFilters = {
	status: ContactListFilter;
	q: string | null;
	/** Standing (or any) list id — filter contacts in households/members on that list. */
	listId: string | null;
};

/** Dashboard / MCP due-to-meet row (may be household-collapsed). */
export type ContactDueRow = {
	id: string;
	display_name: string;
	/** Representative contact id; due-row Log/Skip also post household_id to fan out. */
	contact_id: string;
	household_id: string | null;
	household_name: string | null;
	frequency: ContactFrequency;
	period_key: string;
	period_end: string;
	last_touched_on: string | null;
	/** Days past period end; null = still inside period (use days_left). */
	days_overdue: number | null;
	days_left: number;
	/** @deprecated Kept for MCP callers that still read cadence. */
	effective_cadence_days: number;
};

/** Uncapped collapsed remaining vs scheduled pool. No ahead/behind clock ([211]). */
export type ContactsPaceSummary = {
	remaining: number;
	total: number;
};

export type PeriodHistoryOutcome = 'hit' | 'skipped' | 'missed';

export type PeriodHistoryRow = {
	period_key: string;
	period_end: string;
	frequency: 'quarterly' | 'semiannual' | 'annual';
	hit: number;
	skipped: number;
	missed: number;
};

/** MCP search_contacts card. */
export type ContactSearchHit = {
	id: string;
	display_name: string;
	email: string | null;
	phone: string | null;
	household_id: string | null;
	household_name: string | null;
	address_summary: string | null;
	frequency: ContactFrequency;
	/** @deprecated */
	effective_cadence_days: number;
	last_touched_on: string | null;
	status: ContactStatus;
	/** @deprecated */
	no_reminders: boolean;
};

/** listId → set of entity ids currently on the list (live memberships). */
export type ListMembershipMaps = {
	householdIdsByListId: Record<string, string[]>;
	contactIdsByListId: Record<string, string[]>;
	/** entityId → list ids (for sheet toggles). */
	listIdsByHouseholdId: Record<string, string[]>;
	listIdsByContactId: Record<string, string[]>;
};

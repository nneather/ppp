/** Closed enums and view-models for the contacts / CRM module. */

/** App fallback when contact override and profile default are both null (3 months). */
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

export const CONTACT_LIST_FILTERS = ['active', 'retired', 'all'] as const;
export type ContactListFilter = (typeof CONTACT_LIST_FILTERS)[number];

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
	cadence_days: number | null;
	/** Resolved cadence (override → profile → app default). */
	effective_cadence_days: number;
	no_reminders: boolean;
	status: ContactStatus;
	notes: string | null;
	last_touched_on: string | null;
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
};

/** Dashboard / MCP due-to-meet row. */
export type ContactDueRow = {
	id: string;
	display_name: string;
	effective_cadence_days: number;
	last_touched_on: string | null;
	/** Days past cadence due date; null = never touched. */
	days_overdue: number | null;
	household_name: string | null;
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
	effective_cadence_days: number;
	last_touched_on: string | null;
	status: ContactStatus;
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

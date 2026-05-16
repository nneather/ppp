import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// SvelteKit reserves non-prefixed exports from +page.server.ts. Underscore-prefix
// constants and types so they can still be imported by the component layer.
export const _PAGE_SIZE = 50;

export const _INVOICING_TABLES = [
	'clients',
	'client_rates',
	'time_entries',
	'invoices',
	'invoice_line_items'
] as const;

export const _LIBRARY_TABLES = [
	'ancient_texts',
	'people',
	'series',
	'books',
	'book_authors',
	'book_bible_coverage',
	'book_ancient_coverage',
	'essays',
	'essay_authors',
	'scripture_references',
	'book_topics',
	'user_permissions'
] as const;

// UI-revertible whitelist: UPDATE-only on these tables. INSERT/DELETE never reverted via UI.
// Library tables intentionally excluded — revert there is whole-row replace and the
// (book_id OR essay_id) CHECK + computed-column triggers make it risky.
export const _REVERTIBLE_TABLES = new Set<string>([
	'clients',
	'client_rates',
	'time_entries',
	'invoices',
	'invoice_line_items',
	'profiles'
]);

// Soft-delete revert is a single-key patch (deleted_at -> null) or its inverse,
// so it sidesteps the whole-row CHECK / computed-column risks that block library
// tables from full revert. Any table with a deleted_at column qualifies.
export const _SOFT_DELETE_REVERTIBLE_TABLES = new Set<string>([
	// invoicing
	'clients',
	'client_rates',
	'time_entries',
	'invoices',
	// library
	'books',
	'people',
	'series',
	'ancient_texts',
	'essays',
	'scripture_references',
	'book_topics'
]);

// Fields that must not be overwritten by a revert: identity, audit metadata,
// and trigger-computed columns. Stripped from old_data before applying.
const STRIP_FIELDS = new Set<string>([
	'id',
	'created_at',
	'created_by',
	'updated_at',
	'verse_start_abs',
	'verse_end_abs'
]);

export type AuditOperation = 'INSERT' | 'UPDATE' | 'DELETE';
export type AuditDisplayOperation = AuditOperation | 'SOFT_DELETE' | 'SOFT_RESTORE';

export type AuditLogRow = {
	id: string;
	table_name: string;
	record_id: string;
	operation: AuditOperation;
	/** UI-friendly operation; UPDATE → SOFT_DELETE / SOFT_RESTORE when diff is just a deleted_at flip. */
	displayOperation: AuditDisplayOperation;
	old_data: Record<string, unknown> | null;
	new_data: Record<string, unknown> | null;
	changed_by: string | null;
	changed_at: string;
	revertible: boolean;
	changed_by_label: string;
	/** Friendly per-entity label, e.g. "Jesus and the Eyewitnesses" or "Richard Bauckham". */
	entityLabel: string | null;
	canRevert: boolean;
};

function isSoftDeleteFlip(
	old_data: Record<string, unknown> | null,
	new_data: Record<string, unknown> | null
): boolean {
	if (!old_data || !new_data) return false;
	return old_data.deleted_at == null && new_data.deleted_at != null;
}

function isSoftRestoreFlip(
	old_data: Record<string, unknown> | null,
	new_data: Record<string, unknown> | null
): boolean {
	if (!old_data || !new_data) return false;
	return old_data.deleted_at != null && new_data.deleted_at == null;
}

function deriveDisplayOperation(
	op: AuditOperation,
	old_data: Record<string, unknown> | null,
	new_data: Record<string, unknown> | null
): AuditDisplayOperation {
	if (op !== 'UPDATE') return op;
	if (isSoftDeleteFlip(old_data, new_data)) return 'SOFT_DELETE';
	if (isSoftRestoreFlip(old_data, new_data)) return 'SOFT_RESTORE';
	return 'UPDATE';
}

/**
 * Friendly label per table — surfaces title/name from the row payload so the
 * audit log doesn't read as a sea of UUIDs. Junctions get their parent UUID
 * because record_id is already the parent (post composite-PK fix migration).
 */
function entityLabelFor(
	table_name: string,
	record_id: string,
	old_data: Record<string, unknown> | null,
	new_data: Record<string, unknown> | null
): string | null {
	const data = new_data ?? old_data;
	if (!data) return null;
	const get = (k: string): string | null => {
		const v = data[k];
		return typeof v === 'string' && v.length > 0 ? v : null;
	};
	switch (table_name) {
		case 'books': {
			const title = get('title');
			const volume = get('volume_number');
			if (title) return volume ? `${title}, vol. ${volume}` : title;
			// Untitled book — fall back to first 8 chars of the UUID so the
			// audit row is still identifiable.
			return `Untitled book #${record_id.slice(0, 8)}`;
		}
		case 'people': {
			const first = get('first_name');
			const last = get('last_name');
			return [first, last].filter(Boolean).join(' ') || null;
		}
		case 'series': {
			const name = get('name');
			const abbrev = get('abbreviation');
			return abbrev && name ? `${abbrev} — ${name}` : (name ?? abbrev);
		}
		case 'categories':
			return get('name');
		case 'ancient_texts':
			return get('canonical_name');
		case 'clients':
			return get('name');
		case 'invoices':
			return get('invoice_number');
		case 'profiles': {
			const fullName = get('full_name');
			const email = get('email');
			return fullName ?? email;
		}
		case 'user_permissions': {
			const mod = get('module');
			const level = get('access_level');
			if (mod && level) return `${mod} · ${level}`;
			return mod ?? level;
		}
		case 'time_entries': {
			const date = get('date');
			const hours = data.hours;
			if (date && (typeof hours === 'number' || typeof hours === 'string')) {
				return `${date} · ${hours}h`;
			}
			return date;
		}
		case 'invoice_line_items':
			return get('description');
		case 'scripture_references': {
			const bibleBook = get('bible_book');
			const cs = data.chapter_start;
			const vs = data.verse_start;
			const ce = data.chapter_end;
			const ve = data.verse_end;
			if (!bibleBook) return null;
			if (cs == null) return bibleBook;
			let ref = `${bibleBook} ${cs}`;
			if (vs != null) ref += `:${vs}`;
			if (ce != null && (ce !== cs || ve !== vs)) {
				ref += `–${ce}`;
				if (ve != null) ref += `:${ve}`;
			}
			return ref;
		}
		case 'book_topics': {
			const topic = get('topic');
			const pageStart = get('page_start');
			return topic && pageStart ? `"${topic}" p. ${pageStart}` : topic;
		}
		case 'book_authors':
		case 'book_bible_coverage':
		case 'book_ancient_coverage':
		case 'essay_authors':
			// record_id is the parent UUID after the composite-PK fix; the audit
			// log UI surfaces it via the existing record_id row already.
			return null;
		default:
			return null;
	}
}

export type AuditFilters = {
	module: 'all' | 'invoicing' | 'library';
	recordId: string;
	changedBy: string;
};

function parseModule(v: string | null): AuditFilters['module'] {
	if (v === 'invoicing' || v === 'library') return v;
	return 'all';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;

	const { data: profileRow, error: profileErr } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.maybeSingle();

	if (profileErr) console.error(profileErr);
	const role = (profileRow?.role as string | null) ?? null;
	const isOwner = role === 'owner';

	const filters: AuditFilters = {
		module: parseModule(url.searchParams.get('module')),
		recordId: (url.searchParams.get('record_id') ?? '').trim(),
		changedBy: (url.searchParams.get('changed_by') ?? '').trim()
	};

	const offsetRaw = Number(url.searchParams.get('offset') ?? 0);
	const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;

	if (!isOwner) {
		return {
			rows: [] as AuditLogRow[],
			filters,
			offset,
			pageSize: _PAGE_SIZE,
			hasMore: false,
			totalKnown: 0,
			loadError: 'Audit log requires owner access.'
		};
	}

	if (filters.recordId.length > 0 && !UUID_RE.test(filters.recordId)) {
		return {
			rows: [] as AuditLogRow[],
			filters,
			offset,
			pageSize: _PAGE_SIZE,
			hasMore: false,
			totalKnown: 0,
			loadError: 'Record ID filter must be a UUID.'
		};
	}

	let q = supabase
		.from('audit_log')
		.select(
			'id, table_name, record_id, operation, old_data, new_data, changed_by, changed_at, revertible'
		)
		.order('changed_at', { ascending: false })
		.range(offset, offset + _PAGE_SIZE - 1);

	if (filters.module === 'invoicing') {
		q = q.in('table_name', _INVOICING_TABLES as unknown as string[]);
	} else if (filters.module === 'library') {
		q = q.in('table_name', _LIBRARY_TABLES as unknown as string[]);
	}
	if (filters.recordId.length > 0) q = q.eq('record_id', filters.recordId);
	if (filters.changedBy.length > 0) q = q.eq('changed_by', filters.changedBy);

	const { data: auditData, error: auditErr } = await q;
	if (auditErr) {
		console.error(auditErr);
		return {
			rows: [] as AuditLogRow[],
			filters,
			offset,
			pageSize: _PAGE_SIZE,
			hasMore: false,
			totalKnown: 0,
			loadError: 'Could not load audit log.'
		};
	}

	const rawRows = auditData ?? [];

	const userIds = Array.from(
		new Set(
			rawRows.map((r) => (r as { changed_by: string | null }).changed_by).filter((v): v is string => v != null)
		)
	);

	const profileMap = new Map<string, { email: string; full_name: string | null }>();
	if (userIds.length > 0) {
		const { data: profileRows, error: profilesErr } = await supabase
			.from('profiles')
			.select('id, email, full_name')
			.in('id', userIds);
		if (profilesErr) console.error(profilesErr);
		for (const p of profileRows ?? []) {
			const row = p as { id: string; email: string; full_name: string | null };
			profileMap.set(row.id, { email: row.email, full_name: row.full_name });
		}
	}

	const rows: AuditLogRow[] = rawRows.map((raw) => {
		const r = raw as {
			id: string;
			table_name: string;
			record_id: string;
			operation: string;
			old_data: unknown;
			new_data: unknown;
			changed_by: string | null;
			changed_at: string;
			revertible: boolean;
		};
		const op = r.operation as AuditOperation;
		const old_data = (r.old_data as Record<string, unknown> | null) ?? null;
		const new_data = (r.new_data as Record<string, unknown> | null) ?? null;
		const profile = r.changed_by ? profileMap.get(r.changed_by) : undefined;
		const label = profile
			? profile.full_name && profile.full_name.trim().length > 0
				? profile.full_name
				: profile.email
			: 'system';
		const displayOp = deriveDisplayOperation(op, old_data, new_data);
		const isSoftDelete = displayOp === 'SOFT_DELETE';
		const isSoftRestore = displayOp === 'SOFT_RESTORE';
		const canRevertFull =
			r.revertible &&
			op === 'UPDATE' &&
			!isSoftDelete &&
			!isSoftRestore &&
			_REVERTIBLE_TABLES.has(r.table_name);
		const canRevertSoftDelete =
			(isSoftDelete || isSoftRestore) &&
			r.revertible &&
			_SOFT_DELETE_REVERTIBLE_TABLES.has(r.table_name);
		const canRevert = canRevertFull || canRevertSoftDelete;
		return {
			id: r.id,
			table_name: r.table_name,
			record_id: r.record_id,
			operation: op,
			displayOperation: displayOp,
			old_data,
			new_data,
			changed_by: r.changed_by,
			changed_at: r.changed_at,
			revertible: r.revertible,
			changed_by_label: label,
			entityLabel: entityLabelFor(r.table_name, r.record_id, old_data, new_data),
			canRevert
		};
	});

	return {
		rows,
		filters,
		offset,
		pageSize: _PAGE_SIZE,
		hasMore: rows.length === _PAGE_SIZE,
		totalKnown: rows.length,
		loadError: null as string | null
	};
};

export const actions: Actions = {
	revert: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(401, { kind: 'revert', message: 'Unauthorized' });

		const fd = await request.formData();
		const auditLogId = String(fd.get('audit_log_id') ?? '').trim();
		if (!auditLogId || !UUID_RE.test(auditLogId)) {
			return fail(400, { kind: 'revert', message: 'Missing or invalid audit log id.' });
		}

		const supabase = locals.supabase;

		// Re-check owner role server-side; do not trust client.
		const { data: profileRow, error: profileErr } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.maybeSingle();
		if (profileErr || !profileRow || (profileRow.role as string | null) !== 'owner') {
			return fail(403, { kind: 'revert', auditLogId, message: 'Owner access required.' });
		}

		const { data: auditRow, error: auditErr } = await supabase
			.from('audit_log')
			.select('id, table_name, record_id, operation, old_data, new_data, revertible')
			.eq('id', auditLogId)
			.maybeSingle();

		if (auditErr || !auditRow) {
			return fail(404, { kind: 'revert', auditLogId, message: 'Audit row not found.' });
		}

		const tableName = auditRow.table_name as string;
		const recordId = auditRow.record_id as string;
		const operation = auditRow.operation as string;
		const revertible = Boolean(auditRow.revertible);
		const oldData = auditRow.old_data as Record<string, unknown> | null;
		const newData = auditRow.new_data as Record<string, unknown> | null;

		if (operation !== 'UPDATE') {
			return fail(400, {
				kind: 'revert',
				auditLogId,
				message: 'Only UPDATE operations can be reverted from the UI.'
			});
		}

		// Soft-delete revert: short-circuit to a single-key patch (deleted_at
		// flip) and skip the strip-list / whole-row replacement dance.
		const softDelete = isSoftDeleteFlip(oldData, newData);
		const softRestore = isSoftRestoreFlip(oldData, newData);
		if (softDelete || softRestore) {
			if (!revertible) {
				return fail(400, {
					kind: 'revert',
					auditLogId,
					message: 'This change is not revertible.'
				});
			}
			if (!_SOFT_DELETE_REVERTIBLE_TABLES.has(tableName)) {
				return fail(400, {
					kind: 'revert',
					auditLogId,
					message: `Soft-delete revert is not supported for table "${tableName}".`
				});
			}
			const patch = softDelete
				? { deleted_at: null }
				: { deleted_at: new Date().toISOString() };
			const { error: updateErr } = await supabase
				.from(tableName as never)
				.update(patch as never)
				.eq('id', recordId);
			if (updateErr) {
				console.error(updateErr);
				return fail(500, {
					kind: 'revert',
					auditLogId,
					message: updateErr.message ?? 'Could not apply soft-delete revert.'
				});
			}
			return { kind: 'revert', auditLogId, success: true as const };
		}

		if (!revertible) {
			return fail(400, { kind: 'revert', auditLogId, message: 'This change is not revertible.' });
		}
		if (!_REVERTIBLE_TABLES.has(tableName)) {
			return fail(400, {
				kind: 'revert',
				auditLogId,
				message: `Revert is not supported for table "${tableName}".`
			});
		}
		if (!oldData || typeof oldData !== 'object') {
			return fail(400, {
				kind: 'revert',
				auditLogId,
				message: 'Audit row has no prior data to revert to.'
			});
		}

		// Invoice extra guard: do not revert past a status transition into sent/paid.
		if (tableName === 'invoices') {
			const { data: current, error: curErr } = await supabase
				.from('invoices')
				.select('status')
				.eq('id', recordId)
				.maybeSingle();
			if (curErr || !current) {
				return fail(404, {
					kind: 'revert',
					auditLogId,
					message: 'Current invoice not found.'
				});
			}
			const currentStatus = current.status as string;
			const oldStatus = oldData.status as string | undefined;
			if (
				(currentStatus === 'sent' || currentStatus === 'paid') &&
				oldStatus !== currentStatus
			) {
				return fail(400, {
					kind: 'revert',
					auditLogId,
					message: 'Cannot revert past a status transition (sent/paid).'
				});
			}
		}

		const patch: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(oldData)) {
			if (STRIP_FIELDS.has(k)) continue;
			patch[k] = v;
		}

		if (Object.keys(patch).length === 0) {
			return fail(400, {
				kind: 'revert',
				auditLogId,
				message: 'Nothing to revert after stripping immutable fields.'
			});
		}

		const { error: updateErr } = await supabase
			.from(tableName as never)
			.update(patch as never)
			.eq('id', recordId);

		if (updateErr) {
			console.error(updateErr);
			return fail(500, {
				kind: 'revert',
				auditLogId,
				message: updateErr.message ?? 'Could not apply revert.'
			});
		}

		return { kind: 'revert', auditLogId, success: true as const };
	}
};

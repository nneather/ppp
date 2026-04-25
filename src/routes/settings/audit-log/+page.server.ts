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
	'book_categories',
	'book_bible_coverage',
	'book_ancient_coverage',
	'essays',
	'essay_authors',
	'scripture_references',
	'book_topics'
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

export type AuditLogRow = {
	id: string;
	table_name: string;
	record_id: string;
	operation: AuditOperation;
	old_data: Record<string, unknown> | null;
	new_data: Record<string, unknown> | null;
	changed_by: string | null;
	changed_at: string;
	revertible: boolean;
	changed_by_label: string;
	canRevert: boolean;
};

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
		const profile = r.changed_by ? profileMap.get(r.changed_by) : undefined;
		const label = profile
			? profile.full_name && profile.full_name.trim().length > 0
				? profile.full_name
				: profile.email
			: 'system';
		const canRevert = r.revertible && op === 'UPDATE' && _REVERTIBLE_TABLES.has(r.table_name);
		return {
			id: r.id,
			table_name: r.table_name,
			record_id: r.record_id,
			operation: op,
			old_data: (r.old_data as Record<string, unknown> | null) ?? null,
			new_data: (r.new_data as Record<string, unknown> | null) ?? null,
			changed_by: r.changed_by,
			changed_at: r.changed_at,
			revertible: r.revertible,
			changed_by_label: label,
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

		if (operation !== 'UPDATE') {
			return fail(400, {
				kind: 'revert',
				auditLogId,
				message: 'Only UPDATE operations can be reverted from the UI.'
			});
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

<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import AuditRow from '$lib/components/audit-row.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import type { PageProps } from './$types';
	import type { AuditLogRow } from './+page.server';

	let { data, form }: PageProps = $props();

	type RevertForm = {
		kind?: string;
		auditLogId?: string;
		message?: string;
		success?: boolean;
	};
	const f = $derived((form ?? null) as RevertForm | null);

	let expanded = $state(new Set<string>());
	function toggle(id: string) {
		const next = new Set(expanded);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expanded = next;
	}

	let confirmOpen = $state(false);
	let confirmRow = $state<AuditLogRow | null>(null);
	let confirmPending = $state(false);
	let revertFormEl: HTMLFormElement | null = null;

	function askRevert(row: AuditLogRow) {
		confirmRow = row;
		confirmOpen = true;
	}

	const revertEnhance: SubmitFunction = () => {
		confirmPending = true;
		return async ({ result, update }) => {
			confirmPending = false;
			await update();
			if (result.type === 'success') {
				confirmOpen = false;
				confirmRow = null;
			}
		};
	};

	function submitRevert() {
		if (!confirmRow || !revertFormEl) return;
		const idInput = revertFormEl.querySelector(
			'input[name="audit_log_id"]'
		) as HTMLInputElement | null;
		if (!idInput) return;
		idInput.value = confirmRow.id;
		revertFormEl.requestSubmit();
	}

	const revertError = $derived(
		f && f.kind === 'revert' && !f.success ? (f.message ?? null) : null
	);
	const revertSuccess = $derived(f && f.kind === 'revert' && f.success === true);

	function buildHref(overrides: Record<string, string | number | null>): string {
		const params = new URLSearchParams();
		const merged = {
			module: data.filters.module === 'all' ? null : data.filters.module,
			record_id: data.filters.recordId || null,
			changed_by: data.filters.changedBy || null,
			offset: data.offset > 0 ? data.offset : null,
			...overrides
		};
		for (const [k, v] of Object.entries(merged)) {
			if (v === null || v === '' || v === 0) continue;
			params.set(k, String(v));
		}
		const qs = params.toString();
		return qs.length > 0 ? `?${qs}` : '?';
	}

	const moduleOptions: { value: 'all' | 'invoicing' | 'library'; label: string }[] = [
		{ value: 'all', label: 'All modules' },
		{ value: 'invoicing', label: 'Invoicing' },
		{ value: 'library', label: 'Library' }
	];

	let recordIdInput = $state('');
	let changedByInput = $state('');
	$effect(() => {
		recordIdInput = data.filters.recordId;
		changedByInput = data.filters.changedBy;
	});
</script>

<svelte:head>
	<title>Audit log — Settings — ppp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 pb-16 md:px-6 md:py-8 md:pb-10">
	<p class="mb-4">
		<a
			href="/settings"
			class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ChevronLeft class="size-4" />
			Settings
		</a>
	</p>

	<header class="mb-8 border-b border-border pb-6">
		<h1 class="text-2xl font-semibold tracking-tight text-foreground">Audit log</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Every insert, update, and delete across the app, newest first. Owner-only.
		</p>
	</header>

	{#if data.loadError}
		<p
			class="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
			role="alert"
		>
			{data.loadError}
		</p>
	{/if}

	{#if revertError}
		<p
			class="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
			role="alert"
		>
			{revertError}
		</p>
	{/if}
	{#if revertSuccess}
		<p
			class="mb-4 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
			role="status"
		>
			Reverted. A new audit row was appended for this revert.
		</p>
	{/if}

	<form
		method="GET"
		class="mb-6 grid gap-3 rounded-xl border border-border bg-card p-4 text-sm md:grid-cols-[10rem_1fr_1fr_auto]"
	>
		<div class="space-y-1">
			<Label for="module">Module</Label>
			<select
				id="module"
				name="module"
				value={data.filters.module}
				class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
			>
				{#each moduleOptions as opt (opt.value)}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>
		<div class="space-y-1">
			<Label for="record_id">Record ID (UUID)</Label>
			<Input
				id="record_id"
				name="record_id"
				type="text"
				bind:value={recordIdInput}
				placeholder="00000000-0000-0000-0000-000000000000"
				class="font-mono"
			/>
		</div>
		<div class="space-y-1">
			<Label for="changed_by">Changed by (UUID)</Label>
			<Input
				id="changed_by"
				name="changed_by"
				type="text"
				bind:value={changedByInput}
				placeholder="user UUID"
				class="font-mono"
			/>
		</div>
		<div class="flex items-end gap-2">
			<Button type="submit" size="sm">Apply</Button>
			<Button
				type="button"
				size="sm"
				variant="outline"
				onclick={() => {
					if (typeof window !== 'undefined') window.location.href = '?';
				}}
			>
				Reset
			</Button>
		</div>
	</form>

	{#if data.rows.length === 0}
		<p class="rounded-lg border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
			No audit entries match the current filters.
		</p>
	{:else}
		<ul class="space-y-3">
			{#each data.rows as row (row.id)}
				<li>
					<AuditRow
						{row}
						expanded={expanded.has(row.id)}
						onToggle={toggle}
						onRevert={askRevert}
					/>
				</li>
			{/each}
		</ul>

		<nav
			class="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"
			aria-label="Pagination"
		>
			<span>
				Showing {data.offset + 1}–{data.offset + data.rows.length}
			</span>
			<div class="flex gap-2">
				{#if data.offset > 0}
					<Button
						type="button"
						variant="outline"
						size="sm"
						href={buildHref({ offset: Math.max(0, data.offset - data.pageSize) })}
					>
						Newer
					</Button>
				{/if}
				{#if data.hasMore}
					<Button
						type="button"
						variant="outline"
						size="sm"
						href={buildHref({ offset: data.offset + data.pageSize })}
					>
						Older
					</Button>
				{/if}
			</div>
		</nav>
	{/if}
</div>

<form
	bind:this={revertFormEl}
	method="POST"
	action="?/revert"
	class="hidden"
	use:enhance={revertEnhance}
>
	<input type="hidden" name="audit_log_id" value="" />
</form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Revert this change?"
	description={confirmRow
		? `Apply the prior state of ${confirmRow.table_name} (id ${confirmRow.record_id.slice(0, 8)}…) back to the record. The revert itself is also audited.`
		: ''}
	confirmLabel="Revert"
	destructive
	pending={confirmPending}
	onConfirm={submitRevert}
/>

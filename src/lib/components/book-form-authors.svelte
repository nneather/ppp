<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { deserialize } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import type { ActionResult } from '@sveltejs/kit';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import PersonAutocomplete from '$lib/components/person-autocomplete.svelte';
	import { cn } from '$lib/utils.js';
	import type { BookAuthorRow } from '$lib/library/book-form-ol';
	import { AUTHOR_ROLES, AUTHOR_ROLE_LABELS } from '$lib/types/library';
	import type { PersonRow } from '$lib/types/library';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';

	let {
		authorRows = $bindable(),
		people = $bindable(),
		personBookCounts,
		personActionPath,
		disabled = false
	}: {
		authorRows: BookAuthorRow[];
		people: PersonRow[];
		personBookCounts: Record<string, number>;
		personActionPath: string;
		disabled?: boolean;
	} = $props();

	let personDialogOpen = $state(false);
	let newPersonFirst = $state('');
	let newPersonMiddle = $state('');
	let newPersonLast = $state('');
	let newPersonSuffix = $state('');
	let personDialogMessage = $state<string | null>(null);
	let personDialogMessageTone = $state<'error' | 'warning'>('error');
	let personDialogPending = $state(false);
	let personDialogConfirmedDuplicate = $state(false);
	let pendingAuthorRowKey = $state<string | null>(null);

	const authorRoleSelectItems = $derived(
		AUTHOR_ROLES.map((r) => ({ value: r, label: AUTHOR_ROLE_LABELS[r] }))
	);

	function isInitial(s: string): boolean {
		return /^[A-Za-z]\.?$/.test(s);
	}
	function stripDot(s: string): string {
		return s.replace(/\.$/, '');
	}

	/**
	 * Best-effort name parse with three input shapes:
	 *   "Bauckham"                  → { last: 'Bauckham' }
	 *   "Robert Bauckham"           → { first: 'Robert', last: 'Bauckham' }
	 *   "John Q. Smith"             → { first: 'John', middle: 'Q', last: 'Smith' }
	 *   "John Quincy Smith"         → { first: 'John Quincy', last: 'Smith' }
	 *   "Mary Anne T Smith"         → { first: 'Mary Anne', middle: 'T', last: 'Smith' }
	 *   "Bauckham, Richard"         → { first: 'Richard', last: 'Bauckham' }
	 *   "Bauckham, Richard J."      → { first: 'Richard', middle: 'J', last: 'Bauckham' }
	 */
	function parseTypedName(text: string): {
		first?: string;
		middle?: string;
		last?: string;
	} {
		const trimmed = text.trim();
		if (!trimmed) return {};

		if (trimmed.includes(',')) {
			const commaIdx = trimmed.indexOf(',');
			const last = trimmed.slice(0, commaIdx).trim();
			const after = trimmed.slice(commaIdx + 1).trim();
			if (!last) return {};
			const tokens = after.split(/\s+/).filter(Boolean);
			if (tokens.length === 0) return { last };
			if (tokens.length === 1) return { first: tokens[0], last };
			const lastTok = tokens[tokens.length - 1];
			if (isInitial(lastTok)) {
				return {
					first: tokens.slice(0, -1).join(' '),
					middle: stripDot(lastTok),
					last
				};
			}
			return { first: tokens.join(' '), last };
		}

		const tokens = trimmed.split(/\s+/);
		if (tokens.length === 1) return { last: tokens[0] };
		if (tokens.length === 2) return { first: tokens[0], last: tokens[1] };
		const last = tokens[tokens.length - 1];
		const maybeMiddle = tokens[tokens.length - 2];
		if (isInitial(maybeMiddle)) {
			return {
				first: tokens.slice(0, -2).join(' '),
				middle: stripDot(maybeMiddle),
				last
			};
		}
		return { first: tokens.slice(0, -1).join(' '), last };
	}

	const dedupHints = $derived.by(() => {
		const map = new Map<string, number>();
		for (const p of people) {
			const initial = p.first_name?.trim().charAt(0).toLowerCase() ?? '';
			const key = `${p.last_name.toLowerCase()}|${initial}`;
			map.set(key, (map.get(key) ?? 0) + 1);
		}
		const out: Record<string, string | null> = {};
		for (const a of authorRows) {
			const p = people.find((x) => x.id === a.person_id);
			if (!p) {
				out[a.key] = null;
				continue;
			}
			const initial = p.first_name?.trim().charAt(0).toLowerCase() ?? '';
			const key = `${p.last_name.toLowerCase()}|${initial}`;
			const dupes = (map.get(key) ?? 0) - 1;
			out[a.key] =
				dupes > 0
					? `${dupes} other person(s) share "${p.last_name}, ${initial.toUpperCase()}." — confirm this is the right one.`
					: null;
		}
		return out;
	});

	function addAuthorRow() {
		authorRows = [
			...authorRows,
			{ key: `new-${Date.now()}-${Math.random()}`, person_id: '', role: 'author' }
		];
	}
	function removeAuthorRow(key: string) {
		authorRows = authorRows.filter((a) => a.key !== key);
	}
	function moveAuthor(key: string, delta: -1 | 1) {
		const idx = authorRows.findIndex((a) => a.key === key);
		if (idx < 0) return;
		const target = idx + delta;
		if (target < 0 || target >= authorRows.length) return;
		const next = authorRows.slice();
		[next[idx], next[target]] = [next[target], next[idx]];
		authorRows = next;
	}

	function applyAuthorFuzzyPick(rowKey: string, personId: string) {
		authorRows = authorRows.map((a) =>
			a.key === rowKey ? { key: a.key, person_id: personId, role: a.role } : a
		);
	}

	function openPersonDialog(
		rowKey: string | null,
		prefill?: { first?: string; middle?: string; last?: string }
	) {
		pendingAuthorRowKey = rowKey;
		newPersonFirst = prefill?.first ?? '';
		newPersonMiddle = prefill?.middle ?? '';
		newPersonLast = prefill?.last ?? '';
		newPersonSuffix = '';
		personDialogMessage = null;
		personDialogMessageTone = 'error';
		personDialogConfirmedDuplicate = false;
		personDialogOpen = true;
	}

	$effect(() => {
		newPersonFirst;
		newPersonLast;
		if (personDialogConfirmedDuplicate) {
			personDialogConfirmedDuplicate = false;
		}
		if (personDialogMessageTone === 'warning') {
			personDialogMessage = null;
		}
	});

	function findCollidingPeople(first: string, last: string): PersonRow[] {
		const lastLower = last.trim().toLowerCase();
		if (!lastLower) return [];
		const initial = first.trim().charAt(0).toLowerCase();
		return people.filter(
			(p) =>
				p.last_name.toLowerCase() === lastLower &&
				(p.first_name?.trim().charAt(0).toLowerCase() ?? '') === initial
		);
	}

	function formatPersonLong(p: PersonRow): string {
		return [p.first_name, p.middle_name, p.last_name, p.suffix]
			.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
			.join(' ');
	}

	async function submitPersonDialog() {
		if (!browser) return;
		if (newPersonLast.trim().length === 0) {
			personDialogMessage = 'Last name is required.';
			personDialogMessageTone = 'error';
			return;
		}
		if (!personDialogConfirmedDuplicate) {
			const collisions = findCollidingPeople(newPersonFirst, newPersonLast);
			if (collisions.length > 0) {
				const names = collisions
					.map((p) => [p.first_name, p.last_name].filter(Boolean).join(' '))
					.join(', ');
				personDialogMessage = `Already in your library: ${names}. Continue creating a separate person?`;
				personDialogMessageTone = 'warning';
				return;
			}
		}
		personDialogPending = true;
		personDialogMessage = null;
		personDialogMessageTone = 'error';
		try {
			const fd = new FormData();
			fd.append('first_name', newPersonFirst);
			fd.append('middle_name', newPersonMiddle);
			fd.append('last_name', newPersonLast);
			fd.append('suffix', newPersonSuffix);
			const resp = await fetch(personActionPath, {
				method: 'POST',
				headers: { 'x-sveltekit-action': 'true' },
				body: fd
			});
			const result = deserialize(await resp.text()) as ActionResult;
			if (result.type === 'success' || result.type === 'failure') {
				const data = (result.data ?? {}) as {
					kind?: string;
					personId?: string;
					message?: string;
				};
				if (result.type === 'failure' || !data.personId) {
					personDialogMessage = data.message ?? 'Could not create person.';
					return;
				}
				const personId = data.personId;
				const newPerson: PersonRow = {
					id: personId,
					first_name: newPersonFirst.trim() || null,
					middle_name: newPersonMiddle.trim() || null,
					last_name: newPersonLast.trim(),
					suffix: newPersonSuffix.trim() || null,
					aliases: []
				};
				people = [...people, newPerson].sort((a, b) =>
					a.last_name.localeCompare(b.last_name)
				);
				if (pendingAuthorRowKey) {
					authorRows = authorRows.map((a) =>
						a.key === pendingAuthorRowKey
							? { key: a.key, person_id: personId, role: a.role }
							: a
					);
				} else {
					authorRows = [
						...authorRows,
						{
							key: `new-${Date.now()}-${Math.random()}`,
							person_id: personId,
							role: 'author'
						}
					];
				}
				personDialogOpen = false;
				pendingAuthorRowKey = null;
				await invalidate('app:library:people').catch(() => {});
				await invalidate('app:library:facets').catch(() => {});
			} else {
				personDialogMessage = 'Network error creating person.';
			}
		} catch (err) {
			console.error(err);
			personDialogMessage = 'Network error creating person.';
		} finally {
			personDialogPending = false;
		}
	}
</script>

<section class="flex flex-col gap-3">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
			Authors
		</h3>
		<Button type="button" size="sm" variant="outline" onclick={addAuthorRow} {disabled}>
			<Plus class="size-4" /> Add author
		</Button>
	</div>

	{#each authorRows as row, idx (row.key)}
		<div class="flex flex-col gap-2 rounded-md border-l-2 border-border bg-muted/20 p-3">
			{#if row.prefillName && !row.person_id && (row.fuzzyCandidates?.length ?? 0) > 0}
				<div
					class="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100"
				>
					<p>
						Open Library says <strong class="font-medium">{row.prefillName}</strong>. Possible
						match{row.fuzzyCandidates!.length > 1 ? 'es' : ''} in your library:
					</p>
					<div class="flex flex-wrap items-center gap-2">
						{#each row.fuzzyCandidates ?? [] as c (c.id)}
							{@const cnt = personBookCounts[c.id] ?? 0}
							<Button
								type="button"
								variant="outline"
								size="sm"
								class="min-h-9 text-xs"
								{disabled}
								onclick={() => applyAuthorFuzzyPick(row.key, c.id)}
							>
								Use {formatPersonLong(c)} ({cnt} book{cnt === 1 ? '' : 's'})
							</Button>
						{/each}
						<Button
							type="button"
							variant="secondary"
							size="sm"
							class="min-h-9 text-xs"
							{disabled}
							onclick={() =>
								row.prefillName && openPersonDialog(row.key, parseTypedName(row.prefillName))}
						>
							Create new
						</Button>
					</div>
				</div>
			{/if}
			{#if row.prefillName && !row.person_id}
				<p class="text-xs text-muted-foreground">
					{#if (row.fuzzyCandidates?.length ?? 0) > 0}
						Link a match above or save to create &ldquo;{row.prefillName}&rdquo;.
					{:else}
						Will be created when you save.
					{/if}
				</p>
			{/if}
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
				<div class="min-w-0 flex-1">
					{#key row.key}
						<PersonAutocomplete
							bind:value={row.person_id}
							{people}
							{personBookCounts}
							initialQuery={row.prefillName ?? ''}
							seedKey={row.key}
							autoOpenOnSeed={row.olSeedAutoOpen ?? true}
							onCreate={(text) => openPersonDialog(row.key, parseTypedName(text))}
						/>
					{/key}
				</div>
				<Select.Root type="single" bind:value={row.role} items={authorRoleSelectItems}>
					<Select.Trigger
						id={`author-role-${row.key}`}
						size="default"
						class="h-12 min-h-11 w-full justify-between px-3 text-base sm:h-10 sm:w-40 sm:text-sm"
						aria-label="Role"
						{disabled}
					>
						<span data-slot="select-value" class="truncate text-left">
							{AUTHOR_ROLE_LABELS[row.role]}
						</span>
					</Select.Trigger>
					<Select.Content>
						{#each AUTHOR_ROLES as r (r)}
							<Select.Item value={r} label={AUTHOR_ROLE_LABELS[r]} class="min-h-10 py-2">
								{AUTHOR_ROLE_LABELS[r]}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<div class="flex min-h-11 items-center gap-1 self-end sm:min-h-0 sm:self-auto">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Move up"
						disabled={disabled || idx === 0}
						onclick={() => moveAuthor(row.key, -1)}
						class={cn('min-h-11 min-w-11 sm:min-h-0 sm:min-w-0', authorRows.length === 1 && 'invisible')}
					>
						<ChevronUp class="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Move down"
						disabled={disabled || idx === authorRows.length - 1}
						onclick={() => moveAuthor(row.key, 1)}
						class={cn('min-h-11 min-w-11 sm:min-h-0 sm:min-w-0', authorRows.length === 1 && 'invisible')}
					>
						<ChevronDown class="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Remove author"
						{disabled}
						onclick={() => removeAuthorRow(row.key)}
						class="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
					>
						<X class="size-4" />
					</Button>
				</div>
			</div>
			{#if dedupHints[row.key]}
				<p
					class="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-200"
				>
					{dedupHints[row.key]}
				</p>
			{/if}
		</div>
	{/each}
</section>

<Dialog.Root bind:open={personDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add person</Dialog.Title>
			<Dialog.Description>
				Last name is required. First / middle / suffix are optional but help with citations
				later.
			</Dialog.Description>
		</Dialog.Header>

		{#if personDialogMessage}
			<p
				class={cn(
					'rounded-md border px-3 py-2 text-sm',
					personDialogMessageTone === 'warning'
						? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
						: 'border-destructive/30 bg-destructive/10 text-destructive'
				)}
				role={personDialogMessageTone === 'warning' ? 'status' : 'alert'}
			>
				{personDialogMessage}
			</p>
		{/if}

		<div class="flex flex-col gap-3">
			<div class="space-y-2">
				<Label for="np-first">First name</Label>
				<Input id="np-first" bind:value={newPersonFirst} class="h-11 text-base" />
			</div>
			<div class="space-y-2">
				<Label for="np-middle">Middle name</Label>
				<Input id="np-middle" bind:value={newPersonMiddle} class="h-11 text-base" />
			</div>
			<div class="space-y-2">
				<Label for="np-last">Last name <span class="text-destructive">*</span></Label>
				<Input id="np-last" bind:value={newPersonLast} class="h-11 text-base" required />
			</div>
			<div class="space-y-2">
				<Label for="np-suffix">Suffix</Label>
				<Input
					id="np-suffix"
					bind:value={newPersonSuffix}
					placeholder="Jr., III"
					class="h-11 text-base"
				/>
			</div>
		</div>

		<Dialog.Footer class="flex-col gap-2 sm:flex-row sm:justify-end">
			<Button
				type="button"
				variant="outline"
				class="h-11"
				onclick={() => (personDialogOpen = false)}
				disabled={personDialogPending}
				hotkey="Escape"
				label="Cancel"
			/>
			{#if personDialogMessageTone === 'warning' && personDialogMessage}
				<Button
					type="button"
					variant="default"
					class="h-11"
					onclick={() => {
						personDialogConfirmedDuplicate = true;
						submitPersonDialog();
					}}
					disabled={personDialogPending}
					hotkey="s"
					label={personDialogPending ? 'Saving…' : 'Continue anyway'}
				/>
			{:else}
				<Button
					type="button"
					class="h-11"
					onclick={submitPersonDialog}
					disabled={personDialogPending}
					hotkey="s"
					label={personDialogPending ? 'Saving…' : 'Add person'}
				/>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

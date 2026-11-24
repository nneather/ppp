<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import ContactListToggles from '$lib/components/contact-list-toggles.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import * as Sheet from '$lib/components/ui/sheet';
	import { formatYmdMediumChicago } from '$lib/invoicing/chicago-date';
	import { contactDisplayName, suggestHouseholdName } from '$lib/contacts/names';
	import {
		GIVING_GRADES,
		RELATIONSHIP_GRADES,
		type ContactLite,
		type ContactListDef,
		type GivingGrade,
		type HouseholdChildRow,
		type HouseholdGradeChangeRow,
		type HouseholdRow,
		type RelationshipGrade
	} from '$lib/types/contacts';

	const NONE = '__none__';

	let {
		open = $bindable(false),
		mode,
		household = null,
		lists = [],
		memberListIds = [],
		gradeChanges = [],
		children = [],
		people = [],
		householdNameById = {},
		errorMessage = null,
		onSaved
	}: {
		/** Every live contact (household People section + "existing contact" search). */
		people?: ContactLite[];
		householdNameById?: Record<string, string>;
		open?: boolean;
		mode: 'create' | 'edit';
		household?: HouseholdRow | null;
		lists?: ContactListDef[];
		memberListIds?: string[];
		gradeChanges?: HouseholdGradeChangeRow[];
		children?: HouseholdChildRow[];
		errorMessage?: string | null;
		onSaved?: () => void | Promise<void>;
	} = $props();

	let sheetSide: 'right' | 'bottom' = $state('bottom');
	let pending = $state(false);

	let name = $state('');
	let addressLine1 = $state('');
	let addressLine2 = $state('');
	let city = $state('');
	let stateAbbr = $state('');
	let postalCode = $state('');
	let country = $state('');
	let notes = $state('');
	let givingGrade = $state<GivingGrade | ''>('');
	let relationshipGrade = $state<RelationshipGrade | ''>('');
	let selectedListIds = $state<string[]>([]);

	let childFirst = $state('');
	let childLast = $state('');
	let childBirthday = $state('');

	const formAction = $derived(mode === 'create' ? '?/createHousehold' : '?/updateHousehold');
	const sheetTitle = $derived(mode === 'create' ? 'New household' : 'Edit household');

	const givingSelectValue = $derived(givingGrade || NONE);
	const givingLabel = $derived(givingGrade ? givingGrade : '—');
	const relSelectValue = $derived(relationshipGrade || NONE);
	const relLabel = $derived(relationshipGrade ? relationshipGrade : '—');

	function seedFromHousehold() {
		if (mode === 'edit' && household) {
			name = household.name;
			addressLine1 = household.address_line_1 ?? '';
			addressLine2 = household.address_line_2 ?? '';
			city = household.city ?? '';
			stateAbbr = household.state ?? '';
			postalCode = household.postal_code ?? '';
			country = household.country ?? '';
			notes = household.notes ?? '';
			givingGrade = household.giving_grade ?? '';
			relationshipGrade = household.relationship_grade ?? '';
			selectedListIds = [...memberListIds];
		} else {
			name = '';
			addressLine1 = '';
			addressLine2 = '';
			city = '';
			stateAbbr = '';
			postalCode = '';
			country = '';
			notes = '';
			givingGrade = '';
			relationshipGrade = '';
			selectedListIds = [];
		}
		childFirst = '';
		childLast = householdLastName();
		childBirthday = '';
		addMode = 'new';
		peopleMsg = null;
		peopleErr = null;
		resetPeopleInputs();
	}

	$effect(() => {
		if (!browser) return;
		const mq = window.matchMedia('(min-width: 768px)');
		const sync = () => {
			sheetSide = mq.matches ? 'right' : 'bottom';
		};
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});

	$effect(() => {
		if (!open) return;
		untrack(() => seedFromHousehold());
	});

	const onSubmit: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update({ reset: false });
			if (result.type === 'success') {
				open = false;
				await onSaved?.();
			}
		};
	};

	/* ── People (adults) ───────────────────────────────────────────────── */
	const members = $derived(household ? people.filter((p) => p.household_id === household.id) : []);

	/** Same default the "Someone new" last name uses: the first person already in the household. */
	function householdLastName(): string {
		return members[0]?.last_name ?? '';
	}
	let addMode = $state<'new' | 'existing'>('new');
	let newFirst = $state('');
	let newLast = $state('');
	let pickQuery = $state('');
	let pickId = $state('');
	let renameOn = $state(true);
	let peopleMsg = $state<string | null>(null);
	let peopleErr = $state<string | null>(null);

	const pickMatches = $derived.by(() => {
		const q = pickQuery.trim().toLowerCase();
		if (!q || !household) return [];
		return people
			.filter(
				(p) => p.household_id !== household.id && contactDisplayName(p).toLowerCase().includes(q)
			)
			.slice(0, 6);
	});
	const picked = $derived(people.find((p) => p.id === pickId) ?? null);
	const incoming = $derived(
		addMode === 'new'
			? newFirst.trim()
				? { first_name: newFirst.trim(), last_name: newLast.trim() || null }
				: null
			: picked
	);
	const suggestedName = $derived(
		incoming
			? suggestHouseholdName([...members.filter((m) => m.status === 'active'), incoming])
			: ''
	);
	const offerRename = $derived(!!suggestedName && suggestedName !== name.trim());

	function resetPeopleInputs() {
		newFirst = '';
		newLast = householdLastName();
		pickQuery = '';
		pickId = '';
		renameOn = true;
	}

	const onPeopleMutation: SubmitFunction = () => {
		peopleErr = null;
		peopleMsg = null;
		return async ({ result, update }) => {
			await update({ reset: false, invalidateAll: false });
			if (result.type === 'failure') {
				peopleErr = (result.data?.message as string | undefined) ?? 'Could not save.';
				return;
			}
			if (result.type === 'success') {
				const d = (result.data ?? {}) as {
					message?: string | null;
					household?: Record<string, string | null> | null;
					listIds?: string[];
				};
				// Re-seed the main form from the household's real state. A merge can
				// change the name, address, grades, notes and lists; stale fields here
				// would let a later "Update household" quietly undo it.
				const h = d.household;
				if (h) {
					name = h.name ?? name;
					addressLine1 = h.address_line_1 ?? '';
					addressLine2 = h.address_line_2 ?? '';
					city = h.city ?? '';
					stateAbbr = h.state ?? '';
					postalCode = h.postal_code ?? '';
					country = h.country ?? '';
					notes = h.notes ?? '';
					givingGrade = (h.giving_grade as GivingGrade | null) ?? '';
					relationshipGrade = (h.relationship_grade as RelationshipGrade | null) ?? '';
				}
				if (d.listIds) selectedListIds = [...d.listIds];
				peopleMsg = d.message ?? null;
				resetPeopleInputs();
				await onSaved?.();
			}
		};
	};

	const onChildMutation: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				childFirst = '';
				childLast = householdLastName();
				childBirthday = '';
				await onSaved?.();
			}
		};
	};
</script>

<Sheet.Root bind:open>
	<Sheet.Content side={sheetSide} class="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
		<Sheet.Header class="shrink-0 border-b border-border pb-4">
			<Sheet.Title>{sheetTitle}</Sheet.Title>
			<Sheet.Description class="text-sm text-muted-foreground">
				Envelope name + mailing address. Add or move people under People.
			</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action={formAction}
			use:enhance={onSubmit}
			class="flex flex-1 flex-col gap-4 px-1 py-4"
		>
			{#if mode === 'edit' && household}
				<input type="hidden" name="household_id" value={household.id} />
			{/if}

			{#if errorMessage}
				<p
					class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
					role="alert"
				>
					{errorMessage}
				</p>
			{/if}

			<div class="space-y-2">
				<Label for="hh_name">Name</Label>
				<Input id="hh_name" name="name" bind:value={name} required placeholder="The Jones Family" />
			</div>

			<div class="space-y-2">
				<Label for="hh_line1">Address line 1</Label>
				<Input id="hh_line1" name="address_line_1" bind:value={addressLine1} />
			</div>
			<div class="space-y-2">
				<Label for="hh_line2">Address line 2</Label>
				<Input id="hh_line2" name="address_line_2" bind:value={addressLine2} />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-2">
					<Label for="hh_city">City</Label>
					<Input id="hh_city" name="city" bind:value={city} />
				</div>
				<div class="space-y-2">
					<Label for="hh_state">State</Label>
					<Input id="hh_state" name="state" bind:value={stateAbbr} placeholder="WI" />
				</div>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-2">
					<Label for="hh_postal">Postal code</Label>
					<Input id="hh_postal" name="postal_code" bind:value={postalCode} />
				</div>
				<div class="space-y-2">
					<Label for="hh_country">Country</Label>
					<Input id="hh_country" name="country" bind:value={country} placeholder="US" />
				</div>
			</div>

			{#if mode === 'edit' && household?.address_updated_on}
				<p class="text-xs text-muted-foreground">
					Address as of {formatYmdMediumChicago(household.address_updated_on)}
				</p>
			{/if}

			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-2">
					<Label>Giving</Label>
					<input type="hidden" name="giving_grade" value={givingGrade} />
					<Select.Root
						type="single"
						value={givingSelectValue}
						onValueChange={(v) => {
							givingGrade =
								!v || v === NONE
									? ''
									: (GIVING_GRADES as readonly string[]).includes(v)
										? (v as GivingGrade)
										: '';
						}}
					>
						<Select.Trigger class="w-full" size="lg">{givingLabel}</Select.Trigger>
						<Select.Content>
							<Select.Item value={NONE}>—</Select.Item>
							{#each GIVING_GRADES as g (g)}
								<Select.Item value={g}>{g}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2">
					<Label>Relationship</Label>
					<input type="hidden" name="relationship_grade" value={relationshipGrade} />
					<Select.Root
						type="single"
						value={relSelectValue}
						onValueChange={(v) => {
							relationshipGrade =
								!v || v === NONE
									? ''
									: (RELATIONSHIP_GRADES as readonly string[]).includes(v)
										? (v as RelationshipGrade)
										: '';
						}}
					>
						<Select.Trigger class="w-full" size="lg">{relLabel}</Select.Trigger>
						<Select.Content>
							<Select.Item value={NONE}>—</Select.Item>
							{#each RELATIONSHIP_GRADES as g (g)}
								<Select.Item value={g}>{g}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<div class="space-y-2">
				<Label for="hh_notes">Notes</Label>
				<textarea
					id="hh_notes"
					name="notes"
					bind:value={notes}
					rows={2}
					class="flex min-h-[56px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				></textarea>
			</div>

			<ContactListToggles {lists} bind:selectedIds={selectedListIds} />

			<div
				class="sticky bottom-0 mt-auto flex gap-2 border-t border-border bg-background pt-4 pb-1"
			>
				<Button
					type="button"
					variant="outline"
					hotkey="Escape"
					label="Cancel"
					onclick={() => (open = false)}
				/>
				<Button
					type="submit"
					hotkey={mode === 'create' ? 's' : 'u'}
					label={pending ? 'Saving…' : mode === 'create' ? 'Save household' : 'Update household'}
					disabled={pending || !name.trim()}
				/>
			</div>
		</form>

		{#if mode === 'edit' && household}
			{#if gradeChanges.length > 0}
				<details class="mx-1 mb-3 rounded-md border border-border px-3 py-2">
					<summary class="cursor-pointer text-sm font-medium">
						Grade history ({gradeChanges.length})
					</summary>
					<ul class="mt-2 space-y-1.5 border-t border-border pt-2">
						{#each gradeChanges as row (row.id)}
							<li class="text-xs text-muted-foreground">
								<span class="font-medium text-foreground"
									>{formatYmdMediumChicago(row.changed_on)}</span
								>
								{#if row.giving_grade}
									· Giving {row.giving_grade}
								{/if}
								{#if row.relationship_grade}
									· Rel {row.relationship_grade}
								{/if}
								{#if row.note}
									· {row.note}
								{/if}
							</li>
						{/each}
					</ul>
				</details>
			{/if}

			<section class="mx-1 mb-3 space-y-2 rounded-md border border-border p-3">
				<p class="text-sm font-medium">People</p>
				{#if members.length > 1}
					<p class="text-xs text-muted-foreground">
						Remove gives that person their own household (no address, no lists).
					</p>
				{/if}
				{#if members.length > 0}
					<ul class="space-y-1.5">
						{#each members as m (m.id)}
							<li class="flex items-center justify-between gap-2 text-sm">
								<span class="min-w-0 truncate">
									{contactDisplayName(m)}
									{#if m.status !== 'active'}
										<span class="text-xs text-muted-foreground">· retired</span>
									{/if}
								</span>
								{#if members.length > 1}
									<form
										method="POST"
										action="?/removeHouseholdPerson"
										use:enhance={onPeopleMutation}
									>
										<input type="hidden" name="contact_id" value={m.id} />
										<Button type="submit" variant="outline" size="sm" label="Remove" />
									</form>
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-xs text-muted-foreground">Nobody in this household yet.</p>
				{/if}
				{#if peopleErr}
					<p class="text-xs text-destructive" role="alert">{peopleErr}</p>
				{/if}
				{#if peopleMsg}
					<p class="text-xs text-emerald-700 dark:text-emerald-400" role="status">{peopleMsg}</p>
				{/if}

				<form
					method="POST"
					action="?/addHouseholdPerson"
					use:enhance={onPeopleMutation}
					class="space-y-2 border-t border-border pt-2"
				>
					<input type="hidden" name="household_id" value={household.id} />
					<input type="hidden" name="mode" value={addMode} />
					<div class="flex gap-4 text-xs" role="radiogroup" aria-label="Add person">
						<label class="flex items-center gap-1.5">
							<input type="radio" bind:group={addMode} value="new" /> Someone new
						</label>
						<label class="flex items-center gap-1.5">
							<input type="radio" bind:group={addMode} value="existing" /> Existing contact
						</label>
					</div>

					{#if addMode === 'new'}
						<div class="grid grid-cols-2 gap-2">
							<div class="space-y-1">
								<Label for="person_first" class="text-xs">First</Label>
								<Input id="person_first" name="first_name" bind:value={newFirst} />
							</div>
							<div class="space-y-1">
								<Label for="person_last" class="text-xs">Last</Label>
								<Input id="person_last" name="last_name" bind:value={newLast} />
							</div>
						</div>
					{:else}
						<input type="hidden" name="contact_id" value={pickId} />
						{#if picked}
							<div
								class="flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1.5 text-sm"
							>
								<span class="min-w-0 truncate">
									{contactDisplayName(picked)}
									{#if picked.household_id && householdNameById[picked.household_id] && householdNameById[picked.household_id] !== contactDisplayName(picked)}
										<span class="text-xs text-muted-foreground">
											· from {householdNameById[picked.household_id]}
										</span>
									{/if}
								</span>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									label="Change"
									onclick={() => (pickId = '')}
								/>
							</div>
						{:else}
							<Input
								type="search"
								placeholder="Search contacts…"
								aria-label="Search contacts"
								bind:value={pickQuery}
							/>
							{#if pickMatches.length}
								<ul class="divide-y divide-border rounded-md border border-border">
									{#each pickMatches as p (p.id)}
										<li>
											<button
												type="button"
												class="w-full px-2 py-1.5 text-left text-sm hover:bg-muted"
												onclick={() => (pickId = p.id)}
											>
												{contactDisplayName(p)}
												{#if p.household_id && householdNameById[p.household_id] && householdNameById[p.household_id] !== contactDisplayName(p)}
													<span class="text-xs text-muted-foreground">
														· {householdNameById[p.household_id]}
													</span>
												{/if}
											</button>
										</li>
									{/each}
								</ul>
							{/if}
						{/if}
						<p class="text-xs text-muted-foreground">
							If their old household ends up empty, it's merged in: lists, children, and its address
							if this one has none.
						</p>
					{/if}

					{#if offerRename}
						<label class="flex items-center gap-2 text-xs">
							<input type="checkbox" name="rename" bind:checked={renameOn} />
							Rename household to “{suggestedName}”
						</label>
						<input type="hidden" name="rename_to" value={suggestedName} />
					{/if}

					<div class="flex justify-end">
						<Button
							type="submit"
							size="sm"
							label="Add person"
							disabled={addMode === 'new' ? !newFirst.trim() : !pickId}
						/>
					</div>
				</form>
			</section>

			<section class="mx-1 mb-4 space-y-2 rounded-md border border-border p-3">
				<p class="text-sm font-medium">Children</p>
				{#if children.length > 0}
					<ul class="space-y-1.5">
						{#each children as child (child.id)}
							<li class="flex items-center justify-between gap-2 text-sm">
								<span class="min-w-0 truncate">
									{child.first_name}{child.last_name ? ` ${child.last_name}` : ''}
									{#if child.birthday}
										<span class="text-xs text-muted-foreground">
											· {formatYmdMediumChicago(child.birthday)}
										</span>
									{/if}
								</span>
								<form
									method="POST"
									action="?/softDeleteHouseholdChild"
									use:enhance={onChildMutation}
								>
									<input type="hidden" name="child_id" value={child.id} />
									<Button
										type="submit"
										variant="outline"
										size="sm"
										class="text-destructive"
										label="Remove"
									/>
								</form>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-xs text-muted-foreground">No children recorded.</p>
				{/if}

				<form
					method="POST"
					action="?/createHouseholdChild"
					use:enhance={onChildMutation}
					class="grid grid-cols-2 gap-2 border-t border-border pt-2"
				>
					<input type="hidden" name="household_id" value={household.id} />
					<div class="space-y-1">
						<Label for="child_first" class="text-xs">First</Label>
						<Input id="child_first" name="first_name" bind:value={childFirst} required />
					</div>
					<div class="space-y-1">
						<Label for="child_last" class="text-xs">Last</Label>
						<Input id="child_last" name="last_name" bind:value={childLast} />
					</div>
					<div class="space-y-1">
						<Label for="child_bday" class="text-xs">Birthday</Label>
						<Input id="child_bday" name="birthday" type="date" bind:value={childBirthday} />
					</div>
					<div class="flex items-end">
						<Button type="submit" size="sm" label="Add child" disabled={!childFirst.trim()} />
					</div>
				</form>
			</section>
		{/if}
	</Sheet.Content>
</Sheet.Root>

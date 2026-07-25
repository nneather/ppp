<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import ContactCadenceFields from '$lib/components/contact-cadence-fields.svelte';
	import ContactListToggles from '$lib/components/contact-list-toggles.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Select from '$lib/components/ui/select';
	import { daysToCadence, formatCadenceLabel, type CadenceUnit } from '$lib/contacts/cadence';
	import {
		CONTACT_STATUSES,
		CONTACT_STATUS_LABELS,
		type ContactListDef,
		type ContactListRow,
		type ContactStatus,
		type HouseholdRow
	} from '$lib/types/contacts';

	const NONE = '__none__';

	let {
		open = $bindable(false),
		mode,
		contact = null,
		households = [],
		lists = [],
		memberListIds = [],
		profileCadenceDefault = null,
		errorMessage = null,
		onSaved
	}: {
		open?: boolean;
		mode: 'create' | 'edit';
		contact?: ContactListRow | null;
		households?: HouseholdRow[];
		lists?: ContactListDef[];
		memberListIds?: string[];
		profileCadenceDefault?: number | null;
		errorMessage?: string | null;
		onSaved?: () => void | Promise<void>;
	} = $props();

	let sheetSide: 'right' | 'bottom' = $state('bottom');
	let pending = $state(false);

	let firstName = $state('');
	let lastName = $state('');
	let email = $state('');
	let phone = $state('');
	let householdId = $state('');
	let cadenceAmount = $state('');
	let cadenceUnit = $state<CadenceUnit>('months');
	let noReminders = $state(false);
	let status = $state<ContactStatus>('active');
	let notes = $state('');
	let showMailing = $state(false);
	let addressLine1 = $state('');
	let addressLine2 = $state('');
	let city = $state('');
	let stateAbbr = $state('');
	let postalCode = $state('');
	let country = $state('');
	let selectedListIds = $state<string[]>([]);

	const formAction = $derived(mode === 'create' ? '?/createContact' : '?/updateContact');
	const sheetTitle = $derived(mode === 'create' ? 'New contact' : 'Edit contact');
	const cadenceHint = $derived(
		`Blank uses the profile default (every ${formatCadenceLabel(profileCadenceDefault ?? 90)}).`
	);

	const householdSelectValue = $derived(householdId || NONE);
	const householdLabel = $derived.by(() => {
		if (!householdId) return 'No household';
		return households.find((h) => h.id === householdId)?.name ?? 'Select household';
	});

	function seedCadence(days: number | null) {
		if (days == null) {
			cadenceAmount = '';
			cadenceUnit = 'months';
			return;
		}
		const parsed = daysToCadence(days);
		cadenceAmount = parsed ? String(parsed.amount) : '';
		cadenceUnit = parsed?.unit ?? 'months';
	}

	function seedFromContact() {
		if (mode === 'edit' && contact) {
			firstName = contact.first_name;
			lastName = contact.last_name ?? '';
			email = contact.email ?? '';
			phone = contact.phone ?? '';
			householdId = contact.household_id ?? '';
			seedCadence(contact.cadence_days);
			noReminders = contact.no_reminders;
			status = contact.status;
			notes = contact.notes ?? '';
			selectedListIds = [...memberListIds];
			showMailing = false;
			addressLine1 = '';
			addressLine2 = '';
			city = '';
			stateAbbr = '';
			postalCode = '';
			country = '';
		} else {
			firstName = '';
			lastName = '';
			email = '';
			phone = '';
			householdId = '';
			seedCadence(null);
			noReminders = false;
			status = 'active';
			notes = '';
			selectedListIds = [];
			showMailing = false;
			addressLine1 = '';
			addressLine2 = '';
			city = '';
			stateAbbr = '';
			postalCode = '';
			country = '';
		}
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
		untrack(() => seedFromContact());
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
</script>

<Sheet.Root bind:open>
	<Sheet.Content side={sheetSide} class="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
		<Sheet.Header class="shrink-0 border-b border-border pb-4">
			<Sheet.Title>{sheetTitle}</Sheet.Title>
			<Sheet.Description class="text-sm text-muted-foreground">
				First name required. Optional mailing address creates a household of one.
			</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action={formAction}
			use:enhance={onSubmit}
			class="flex flex-1 flex-col gap-4 px-1 py-4"
		>
			{#if mode === 'edit' && contact}
				<input type="hidden" name="contact_id" value={contact.id} />
			{/if}

			{#if errorMessage}
				<p
					class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
					role="alert"
				>
					{errorMessage}
				</p>
			{/if}

			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-2">
					<Label for="contact_first_name">First name</Label>
					<Input id="contact_first_name" name="first_name" bind:value={firstName} required />
				</div>
				<div class="space-y-2">
					<Label for="contact_last_name">Last name</Label>
					<Input id="contact_last_name" name="last_name" bind:value={lastName} />
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-2">
					<Label for="contact_email">Email</Label>
					<Input id="contact_email" name="email" type="email" bind:value={email} />
				</div>
				<div class="space-y-2">
					<Label for="contact_phone">Phone</Label>
					<Input id="contact_phone" name="phone" type="tel" bind:value={phone} />
				</div>
			</div>

			<div class="space-y-2">
				<Label>Household</Label>
				<input type="hidden" name="household_id" value={householdId} />
				<Select.Root
					type="single"
					value={householdSelectValue}
					onValueChange={(v) => {
						householdId = !v || v === NONE ? '' : v;
					}}
				>
					<Select.Trigger class="w-full" size="lg">{householdLabel}</Select.Trigger>
					<Select.Content class="max-h-72">
						<Select.Item value={NONE}>No household</Select.Item>
						{#each households as h (h.id)}
							<Select.Item value={h.id}>{h.name}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			{#if !householdId}
				<div class="space-y-2">
					<button
						type="button"
						class="text-sm font-medium text-primary underline-offset-4 hover:underline"
						onclick={() => (showMailing = !showMailing)}
					>
						{showMailing ? 'Hide mailing address' : 'Add mailing address (household of one)'}
					</button>
					{#if showMailing}
						<div class="space-y-3 rounded-md border border-border p-3">
							<div class="space-y-2">
								<Label for="addr_line1">Address line 1</Label>
								<Input id="addr_line1" name="address_line_1" bind:value={addressLine1} />
							</div>
							<div class="space-y-2">
								<Label for="addr_line2">Address line 2</Label>
								<Input id="addr_line2" name="address_line_2" bind:value={addressLine2} />
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div class="space-y-2">
									<Label for="addr_city">City</Label>
									<Input id="addr_city" name="city" bind:value={city} />
								</div>
								<div class="space-y-2">
									<Label for="addr_state">State</Label>
									<Input id="addr_state" name="state" bind:value={stateAbbr} placeholder="WI" />
								</div>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div class="space-y-2">
									<Label for="addr_postal">Postal code</Label>
									<Input id="addr_postal" name="postal_code" bind:value={postalCode} />
								</div>
								<div class="space-y-2">
									<Label for="addr_country">Country</Label>
									<Input id="addr_country" name="country" bind:value={country} placeholder="US" />
								</div>
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<ContactCadenceFields
					bind:amount={cadenceAmount}
					bind:unit={cadenceUnit}
					amountId="contact_cadence_amount"
					unitId="contact_cadence_unit"
					label="Meet cadence"
					hint={cadenceHint}
				/>
				<div class="space-y-2">
					<Label>Status</Label>
					<input type="hidden" name="status" value={status} />
					<Select.Root
						type="single"
						value={status}
						onValueChange={(v) => {
							if (v && (CONTACT_STATUSES as readonly string[]).includes(v)) {
								status = v as ContactStatus;
							}
						}}
					>
						<Select.Trigger class="w-full" size="lg">{CONTACT_STATUS_LABELS[status]}</Select.Trigger>
						<Select.Content>
							{#each CONTACT_STATUSES as s (s)}
								<Select.Item value={s}>{CONTACT_STATUS_LABELS[s]}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					name="no_reminders"
					bind:checked={noReminders}
					class="size-4 rounded border-input"
				/>
				No meet reminders (still active / list-eligible)
			</label>

			<div class="space-y-2">
				<Label for="contact_notes">Notes</Label>
				<textarea
					id="contact_notes"
					name="notes"
					bind:value={notes}
					rows={3}
					class="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				></textarea>
			</div>

			<ContactListToggles lists={lists} bind:selectedIds={selectedListIds} />

			<div class="sticky bottom-0 mt-auto flex gap-2 border-t border-border bg-background pt-4 pb-1">
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
					label={pending ? 'Saving…' : mode === 'create' ? 'Save contact' : 'Update contact'}
					disabled={pending || !firstName.trim()}
				/>
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>

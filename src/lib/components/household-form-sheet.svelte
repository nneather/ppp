<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Sheet from '$lib/components/ui/sheet';
	import type { HouseholdRow } from '$lib/types/contacts';

	let {
		open = $bindable(false),
		mode,
		household = null,
		errorMessage = null,
		onSaved
	}: {
		open?: boolean;
		mode: 'create' | 'edit';
		household?: HouseholdRow | null;
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

	const formAction = $derived(mode === 'create' ? '?/createHousehold' : '?/updateHousehold');
	const sheetTitle = $derived(mode === 'create' ? 'New household' : 'Edit household');

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
		} else {
			name = '';
			addressLine1 = '';
			addressLine2 = '';
			city = '';
			stateAbbr = '';
			postalCode = '';
			country = '';
			notes = '';
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
</script>

<Sheet.Root bind:open>
	<Sheet.Content side={sheetSide} class="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
		<Sheet.Header class="shrink-0 border-b border-border pb-4">
			<Sheet.Title>{sheetTitle}</Sheet.Title>
			<Sheet.Description class="text-sm text-muted-foreground">
				Envelope name + mailing address. Assign contacts via the contact Sheet.
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
				<Input
					id="hh_name"
					name="name"
					bind:value={name}
					required
					placeholder="The Jones Family"
				/>
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

			<div class="space-y-2">
				<Label for="hh_notes">Notes</Label>
				<textarea
					id="hh_notes"
					name="notes"
					bind:value={notes}
					rows={2}
					class="flex min-h-[56px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				></textarea>
			</div>

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
					label={pending ? 'Saving…' : mode === 'create' ? 'Save household' : 'Update household'}
					disabled={pending || !name.trim()}
				/>
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>

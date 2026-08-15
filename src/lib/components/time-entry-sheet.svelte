<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { cn } from '$lib/utils.js';
	import { ymdInChicago } from '$lib/invoicing/chicago-date';
	import { formatHoursForInput, parseHoursInput } from '$lib/invoicing/hours';
	import { lineTotalFromHoursRate } from '$lib/invoicing/one-off';
	import type { ClientOption, TimeEntryRow } from '$lib/types/invoicing';

	type FormMessage = { message?: string } | null | undefined;
	type EntryKind = 'hours' | 'one_off';

	let {
		open = $bindable(false),
		clients,
		mode,
		entry = null,
		formMessage = null,
		initialKind = 'hours' as EntryKind
	}: {
		open?: boolean;
		clients: ClientOption[];
		mode: 'create' | 'edit';
		entry?: TimeEntryRow | null;
		formMessage?: FormMessage;
		/** Preferred kind when opening create mode. */
		initialKind?: EntryKind;
	} = $props();

	let entryKind = $state<EntryKind>('hours');
	let clientId = $state('');
	let dateStr = $state('');
	let hoursStr = $state('');
	let amountStr = $state('');
	let hoursAdjustedNote = $state<string | null>(null);
	let description = $state('');
	let sheetSide = $state<'bottom' | 'right'>('bottom');
	let pending = $state(false);
	let wasOpen = $state(false);
	let confirmDeleteOpen = $state(false);

	const selectItems = $derived(
		clients.map((c) => ({
			value: c.id,
			label: c.name
		}))
	);

	const clientLabel = $derived.by(() => {
		const c = clients.find((x) => x.id === clientId);
		return c?.name ?? 'Select client';
	});

	const formAction = $derived(mode === 'create' ? '?/create' : '?/update');

	const isOneOff = $derived(entryKind === 'one_off');

	const kindLocked = $derived(mode === 'edit');

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
		if (open && !wasOpen) {
			if (mode === 'edit' && entry) {
				entryKind = entry.is_one_off ? 'one_off' : 'hours';
				clientId = entry.client_id;
				dateStr = entry.date;
				description = entry.description ?? '';
				if (entry.is_one_off) {
					hoursStr = '';
					amountStr = String(lineTotalFromHoursRate(entry.hours, entry.rate));
				} else {
					hoursStr = String(entry.hours);
					amountStr = '';
				}
			} else {
				entryKind = initialKind;
				clientId = clients[0]?.id ?? '';
				dateStr = ymdInChicago();
				hoursStr = '';
				amountStr = '';
				hoursAdjustedNote = null;
				description = '';
			}
		}
		wasOpen = open;
	});

	function snapHoursOnBlur() {
		const before = hoursStr.trim();
		if (!before) {
			hoursAdjustedNote = null;
			return;
		}
		const n = parseHoursInput(before);
		if (n == null) {
			hoursAdjustedNote = null;
			return;
		}
		const snapped = formatHoursForInput(n);
		if (snapped !== before) {
			hoursAdjustedNote = `Adjusted ${before} → ${snapped}`;
		} else {
			hoursAdjustedNote = null;
		}
		hoursStr = snapped;
	}

	const submitEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			if (result.type === 'failure') {
				console.error('[time entry]', result.data);
			}
			await update();
			if (result.type === 'success' && result.data && typeof result.data === 'object') {
				const d = result.data as {
					saveAndNew?: boolean;
					savedDate?: string;
					entryKind?: EntryKind;
				};
				if (d.saveAndNew === true && typeof d.savedDate === 'string' && mode === 'create') {
					dateStr = d.savedDate;
					hoursStr = '';
					amountStr = '';
					hoursAdjustedNote = null;
					description = '';
					if (d.entryKind === 'one_off' || d.entryKind === 'hours') {
						entryKind = d.entryKind;
					}
					return;
				}
			}
			if (result.type === 'success') {
				open = false;
			}
		};
	};

	const deleteEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			confirmDeleteOpen = false;
			await update();
			if (result.type === 'success') open = false;
		};
	};

	function handleCancel() {
		open = false;
	}

	function confirmDelete() {
		if (!entry || !browser) return;
		const f = document.getElementById('time-entry-delete-form') as HTMLFormElement | null;
		f?.requestSubmit();
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side={sheetSide}
		interactOutsideBehavior="ignore"
		class={cn(
			'flex w-full flex-col gap-0 p-0',
			sheetSide === 'bottom' && 'h-[min(92dvh,640px)] max-h-[92dvh] rounded-t-xl',
			sheetSide === 'right' && 'max-w-md sm:max-w-md'
		)}
	>
		<Sheet.Header class="border-b border-border px-4 pt-2 pb-4">
			<Sheet.Title>
				{#if mode === 'create'}
					{isOneOff ? 'New one-off charge' : 'New time entry'}
				{:else}
					{isOneOff ? 'Edit one-off charge' : 'Edit time entry'}
				{/if}
			</Sheet.Title>
			<Sheet.Description class="text-muted-foreground">
				{#if isOneOff}
					{mode === 'create'
						? 'Add a fixed charge (e.g. travel, dinner) before invoicing.'
						: 'Update or delete this one-off charge.'}
				{:else}
					{mode === 'create' ? 'Log hours against a client.' : 'Update or delete this entry.'}
				{/if}
			</Sheet.Description>
		</Sheet.Header>

		<div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
			{#if clients.length === 0}
				<p class="text-sm text-muted-foreground">
					No clients found. Seed clients in Supabase before logging time.
				</p>
			{:else}
				{#if formMessage?.message}
					<p
						class="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
						role="alert"
					>
						{formMessage.message}
					</p>
				{/if}

				{#if !kindLocked}
					<div
						class="mb-5 inline-flex w-full rounded-lg border border-border p-0.5 text-sm font-medium"
						role="group"
						aria-label="Entry type"
					>
						<button
							type="button"
							class={cn(
								'flex-1 rounded-md px-3 py-2.5 transition-colors',
								entryKind === 'hours'
									? 'bg-foreground text-background'
									: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
							)}
							onclick={() => (entryKind = 'hours')}
						>
							Hours
						</button>
						<button
							type="button"
							class={cn(
								'flex-1 rounded-md px-3 py-2.5 transition-colors',
								entryKind === 'one_off'
									? 'bg-foreground text-background'
									: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
							)}
							onclick={() => (entryKind = 'one_off')}
						>
							One-off
						</button>
					</div>
				{/if}

				<form
					method="POST"
					action={formAction}
					use:enhance={submitEnhance}
					class="flex flex-col gap-5"
				>
					{#if mode === 'edit' && entry}
						<input type="hidden" name="id" value={entry.id} />
					{/if}
					<input type="hidden" name="client_id" value={clientId} />
					<input type="hidden" name="entry_kind" value={entryKind} />

					<div class="space-y-2">
						<Label for="te-client">Client</Label>
						<Select.Root type="single" bind:value={clientId} items={selectItems}>
							<Select.Trigger id="te-client" size="lg" class="w-full justify-between">
								<span data-slot="select-value" class="truncate text-left">{clientLabel}</span>
							</Select.Trigger>
							<Select.Content class="max-h-72">
								{#each clients as c (c.id)}
									<Select.Item value={c.id} label={c.name} class="min-h-11 py-3">
										{c.name}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>

					<div class="space-y-2">
						<Label for="te-date">Date</Label>
						<Input
							id="te-date"
							name="date"
							type="date"
							bind:value={dateStr}
							class="h-12 min-h-12 text-base"
							required
						/>
					</div>

					{#if isOneOff}
						<div class="space-y-2">
							<Label for="te-amount">Amount</Label>
							<Input
								id="te-amount"
								name="amount"
								type="number"
								inputmode="decimal"
								step="0.01"
								min="0"
								bind:value={amountStr}
								class="h-12 min-h-12 text-base tabular-nums"
								placeholder="e.g. 1600"
								required
							/>
							<p class="text-xs text-muted-foreground">Fixed charge; appears as a one-off invoice line.</p>
						</div>
					{:else}
						<div class="space-y-2">
							<Label for="te-hours">Hours</Label>
							<Input
								id="te-hours"
								name="hours"
								type="number"
								inputmode="decimal"
								step="0.25"
								min="0"
								bind:value={hoursStr}
								onblur={snapHoursOnBlur}
								class="h-12 min-h-12 text-base tabular-nums"
								placeholder="e.g. 1.5"
								required
							/>
							<p class="text-xs text-muted-foreground">Hours round to the nearest quarter (0.25).</p>
							{#if hoursAdjustedNote}
								<p class="text-xs text-muted-foreground" role="status">{hoursAdjustedNote}</p>
							{/if}
						</div>
					{/if}

					<div class="space-y-2">
						<Label for="te-desc">Description</Label>
						<textarea
							id="te-desc"
							name="description"
							bind:value={description}
							rows={4}
							class="flex min-h-28 w-full rounded-lg border border-input bg-background px-3 py-3 text-base shadow-xs ring-offset-background transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
							placeholder={isOneOff ? 'e.g. City Tour Dinner Trip' : 'What did you work on?'}
							required={isOneOff}
						></textarea>
					</div>

					<Sheet.Footer class="mt-2 flex-col gap-2 border-0 p-0 sm:flex-col">
						<Button
							type="submit"
							name="intent"
							value="save"
							class="h-12 w-full text-base"
							disabled={pending || !clientId}
							hotkey={mode === 'create' ? 's' : 'u'}
							label={pending
								? 'Saving…'
								: mode === 'create'
									? isOneOff
										? 'Save charge'
										: 'Save entry'
									: isOneOff
										? 'Update charge'
										: 'Update entry'}
						/>
						{#if mode === 'create'}
							<Button
								type="submit"
								name="intent"
								value="save_and_new"
								variant="outline"
								class="h-12 w-full text-base"
								disabled={pending || !clientId}
								hotkey="e"
								label="Save and New"
							/>
						{/if}
						{#if mode === 'edit' && entry && !entry.invoice_id}
							<Button
								type="button"
								variant="outline"
								class="h-12 w-full text-base text-destructive"
								disabled={pending}
								onclick={() => (confirmDeleteOpen = true)}
								label="Delete"
							/>
						{/if}
						<Button
							type="button"
							variant="outline"
							class="h-12 w-full text-base"
							disabled={pending}
							onclick={handleCancel}
							hotkey="Escape"
							label="Cancel"
						/>
					</Sheet.Footer>
				</form>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>

{#if mode === 'edit' && entry && !entry.invoice_id}
	<form
		id="time-entry-delete-form"
		class="hidden"
		method="POST"
		action="?/delete"
		use:enhance={deleteEnhance}
	>
		<input type="hidden" name="id" value={entry.id} />
		<button type="submit">Delete</button>
	</form>

	<ConfirmDialog
		bind:open={confirmDeleteOpen}
		title={isOneOff ? 'Delete this one-off charge?' : 'Delete this time entry?'}
		description="This soft-deletes the entry and removes it from this period."
		confirmLabel="Delete"
		destructive
		pending={pending}
		onConfirm={confirmDelete}
	/>
{/if}

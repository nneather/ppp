<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { cn } from '$lib/utils.js';
	import type { ClientOption, TimeEntryRow } from '$lib/types/invoicing';

	type FormMessage = { message?: string } | null | undefined;

	let {
		open = $bindable(false),
		clients,
		mode,
		entry = null,
		formMessage = null
	}: {
		open?: boolean;
		clients: ClientOption[];
		mode: 'create' | 'edit';
		entry?: TimeEntryRow | null;
		formMessage?: FormMessage;
	} = $props();

	let clientId = $state('');
	let dateStr = $state('');
	let hoursStr = $state('');
	let description = $state('');
	let sheetSide = $state<'bottom' | 'right'>('bottom');
	let pending = $state(false);

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
		if (mode === 'edit' && entry) {
			clientId = entry.client_id;
			dateStr = entry.date;
			hoursStr = String(entry.hours);
			description = entry.description ?? '';
		} else {
			const first = clients[0]?.id ?? '';
			clientId = first;
			dateStr = new Date().toISOString().slice(0, 10);
			hoursStr = '';
			description = '';
		}
	});

	const submitEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			if (result.type === 'failure') {
				console.error('[time entry]', result.data);
			}
			await update();
			if (result.type === 'success') {
				open = false;
			}
		};
	};

	function handleDelete() {
		if (!entry || !browser) return;
		if (!confirm('Delete this time entry?')) return;
		const f = document.getElementById('time-entry-delete-form') as HTMLFormElement | null;
		f?.requestSubmit();
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side={sheetSide}
		class={cn(
			'flex w-full flex-col gap-0 p-0',
			sheetSide === 'bottom' && 'h-[min(92dvh,640px)] max-h-[92dvh] rounded-t-xl',
			sheetSide === 'right' && 'max-w-md sm:max-w-md'
		)}
	>
		<Sheet.Header class="border-b border-border px-4 pt-2 pb-4">
			<Sheet.Title>{mode === 'create' ? 'New time entry' : 'Edit time entry'}</Sheet.Title>
			<Sheet.Description class="text-muted-foreground">
				{mode === 'create' ? 'Log hours against a client.' : 'Update or delete this entry.'}
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
					<div class="space-y-2">
						<Label for="te-client">Client</Label>
						<Select.Root type="single" bind:value={clientId} items={selectItems}>
							<Select.Trigger
								id="te-client"
								size="default"
								class="h-12 min-h-12 w-full justify-between px-3"
							>
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
							class="h-12 min-h-12 text-base tabular-nums"
							placeholder="e.g. 1.5"
							required
						/>
					</div>

					<div class="space-y-2">
						<Label for="te-desc">Description</Label>
						<textarea
							id="te-desc"
							name="description"
							bind:value={description}
							rows={4}
							class="flex min-h-28 w-full rounded-lg border border-input bg-background px-3 py-3 text-base shadow-xs ring-offset-background transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
							placeholder="What did you work on?"
						></textarea>
					</div>

					<Sheet.Footer class="mt-2 flex-col gap-2 border-0 p-0 sm:flex-col">
						<Button type="submit" class="h-12 w-full text-base" disabled={pending || !clientId}>
							{pending ? 'Saving…' : mode === 'create' ? 'Save entry' : 'Update entry'}
						</Button>
						{#if mode === 'edit' && entry}
							<Button
								type="button"
								variant="destructive"
								class="h-12 w-full text-base"
								disabled={pending}
								onclick={handleDelete}
							>
								Delete
							</Button>
						{/if}
					</Sheet.Footer>
				</form>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>

{#if mode === 'edit' && entry}
	<form
		id="time-entry-delete-form"
		class="hidden"
		method="POST"
		action="?/delete"
		use:enhance={submitEnhance}
	>
		<input type="hidden" name="id" value={entry.id} />
		<button type="submit">Delete</button>
	</form>
{/if}

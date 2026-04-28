<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Sheet from '$lib/components/ui/sheet';
	import { cn } from '$lib/utils';
	import EmailChipsEditor from './email-chips-editor.svelte';

	export type ClientFormInitial = {
		id?: string;
		name: string;
		billing_contact: string | null;
		address_line_1: string | null;
		address_line_2: string | null;
		email: string[];
		sort_rank: number | null;
	};

	let {
		open = $bindable(false),
		mode,
		initial,
		errorMessage = null
	}: {
		open: boolean;
		mode: 'create' | 'edit';
		initial: ClientFormInitial | null;
		errorMessage?: string | null;
	} = $props();

	let sheetSide: 'right' | 'bottom' = $state('bottom');
	let pending = $state(false);

	let name = $state('');
	let billingContact = $state('');
	let addressLine1 = $state('');
	let addressLine2 = $state('');
	let emails = $state<string[]>([]);
	let sortRank = $state('');

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
		name = initial?.name ?? '';
		billingContact = initial?.billing_contact ?? '';
		addressLine1 = initial?.address_line_1 ?? '';
		addressLine2 = initial?.address_line_2 ?? '';
		emails = initial?.email ? [...initial.email] : [];
		sortRank = initial?.sort_rank != null ? String(initial.sort_rank) : '';
	});

	const formAction = $derived(mode === 'create' ? '?/createClient' : '?/updateClient');
	const title = $derived(mode === 'create' ? 'New client' : 'Edit client');

	const submitEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update();
			if (result.type === 'success') {
				open = false;
			}
		};
	};
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side={sheetSide}
		class={cn(
			'flex w-full flex-col gap-0 p-0',
			sheetSide === 'bottom' && 'h-[min(92dvh,720px)] max-h-[92dvh] rounded-t-xl',
			sheetSide === 'right' && 'max-w-md sm:max-w-md'
		)}
	>
		<Sheet.Header class="border-b border-border px-4 pt-2 pb-4">
			<Sheet.Title>{title}</Sheet.Title>
			<Sheet.Description class="text-muted-foreground">
				{mode === 'create'
					? 'Add a new billable client.'
					: 'Update billing details for this client.'}
			</Sheet.Description>
		</Sheet.Header>

		<div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
			{#if errorMessage}
				<p
					class="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
					role="alert"
				>
					{errorMessage}
				</p>
			{/if}

			<form method="POST" action={formAction} use:enhance={submitEnhance} class="flex flex-col gap-5">
				{#if mode === 'edit' && initial?.id}
					<input type="hidden" name="id" value={initial.id} />
				{/if}

				<div class="space-y-2">
					<Label for="cl-name">Client name</Label>
					<Input
						id="cl-name"
						name="name"
						type="text"
						bind:value={name}
						maxlength={200}
						required
						class="h-12 min-h-12 text-base"
					/>
				</div>

				<div class="space-y-2">
					<Label for="cl-billing">Billing contact</Label>
					<Input
						id="cl-billing"
						name="billing_contact"
						type="text"
						bind:value={billingContact}
						placeholder="e.g. Accounts Payable"
						class="h-12 min-h-12 text-base"
					/>
				</div>

				<div class="space-y-2">
					<Label for="cl-addr1">Address line 1</Label>
					<Input
						id="cl-addr1"
						name="address_line_1"
						type="text"
						bind:value={addressLine1}
						class="h-12 min-h-12 text-base"
					/>
				</div>

				<div class="space-y-2">
					<Label for="cl-addr2">Address line 2</Label>
					<Input
						id="cl-addr2"
						name="address_line_2"
						type="text"
						bind:value={addressLine2}
						class="h-12 min-h-12 text-base"
					/>
				</div>

				<EmailChipsEditor
					bind:value={emails}
					fieldName="email"
					inputId="cl-email"
					label="Invoice recipient email(s)"
					placeholder="billing@client.com"
				/>

				<div class="space-y-2">
					<Label for="cl-sort-rank">Sort priority</Label>
					<Input
						id="cl-sort-rank"
						name="sort_rank"
						type="number"
						inputmode="numeric"
						min="0"
						max="9999"
						step="1"
						bind:value={sortRank}
						class="h-12 min-h-12 text-base"
					/>
					<p class="text-xs text-muted-foreground">
						Lower numbers appear first in customer pickers. Leave blank to sort alphabetically at
						the end.
					</p>
				</div>

				<Sheet.Footer class="mt-2 flex-col gap-2 border-0 p-0 sm:flex-col">
					<Button type="submit" class="h-12 w-full text-base" disabled={pending || !name.trim()}>
						{pending ? 'Saving…' : mode === 'create' ? 'Create client' : 'Save changes'}
					</Button>
				</Sheet.Footer>
			</form>
		</div>
	</Sheet.Content>
</Sheet.Root>

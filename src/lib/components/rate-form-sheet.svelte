<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Sheet from '$lib/components/ui/sheet';
	import { cn } from '$lib/utils';

	export type RateFormInitial = {
		id?: string;
		client_id: string;
		rate: number | null;
		effective_from: string;
		effective_to: string | null;
		service_type: string | null;
	};

	let {
		open = $bindable(false),
		mode,
		clientId,
		clientName,
		initial,
		errorMessage = null
	}: {
		open: boolean;
		mode: 'create' | 'edit';
		clientId: string;
		clientName: string;
		initial: RateFormInitial | null;
		errorMessage?: string | null;
	} = $props();

	let sheetSide: 'right' | 'bottom' = $state('bottom');
	let pending = $state(false);

	let rateStr = $state('');
	let effectiveFrom = $state('');
	let effectiveTo = $state('');
	let serviceType = $state('');

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
		if (mode === 'edit' && initial) {
			rateStr = initial.rate != null ? String(initial.rate) : '';
			effectiveFrom = initial.effective_from;
			effectiveTo = initial.effective_to ?? '';
			serviceType = initial.service_type ?? '';
		} else {
			rateStr = '';
			const today = new Date();
			const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
			effectiveFrom = ymd;
			effectiveTo = '';
			serviceType = '';
		}
	});

	const formAction = $derived(mode === 'create' ? '?/createRate' : '?/updateRate');
	const title = $derived(mode === 'create' ? 'New rate' : 'Edit rate');

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
			sheetSide === 'bottom' && 'h-[min(92dvh,640px)] max-h-[92dvh] rounded-t-xl',
			sheetSide === 'right' && 'max-w-md sm:max-w-md'
		)}
	>
		<Sheet.Header class="border-b border-border px-4 pt-2 pb-4">
			<Sheet.Title>{title}</Sheet.Title>
			<Sheet.Description class="text-muted-foreground">
				{clientName} · {mode === 'create' ? 'Adds a new active rate (closes prior).' : 'Update an existing rate row.'}
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
				<input type="hidden" name="client_id" value={clientId} />
				{#if mode === 'edit' && initial?.id}
					<input type="hidden" name="id" value={initial.id} />
				{/if}

				<div class="space-y-2">
					<Label for="rt-rate">Hourly rate</Label>
					<Input
						id="rt-rate"
						name="rate"
						type="number"
						inputmode="decimal"
						step="0.01"
						min="0"
						bind:value={rateStr}
						placeholder="e.g. 175.00"
						class="h-12 min-h-12 text-base tabular-nums"
						required
					/>
				</div>

				<div class="space-y-2">
					<Label for="rt-from">Effective from</Label>
					<Input
						id="rt-from"
						name="effective_from"
						type="date"
						bind:value={effectiveFrom}
						class="h-12 min-h-12 text-base"
						required
					/>
				</div>

				{#if mode === 'edit'}
					<div class="space-y-2">
						<Label for="rt-to">Effective to (optional)</Label>
						<Input
							id="rt-to"
							name="effective_to"
							type="date"
							bind:value={effectiveTo}
							class="h-12 min-h-12 text-base"
						/>
						<p class="text-xs text-muted-foreground">
							Leave blank for an open-ended (current) rate.
						</p>
					</div>
				{/if}

				<div class="space-y-2">
					<Label for="rt-svc">Service type (optional)</Label>
					<Input
						id="rt-svc"
						name="service_type"
						type="text"
						bind:value={serviceType}
						placeholder="e.g. design, dev"
						class="h-12 min-h-12 text-base"
					/>
				</div>

				<Sheet.Footer class="mt-2 flex-col gap-2 border-0 p-0 sm:flex-col">
					<Button type="submit" class="h-12 w-full text-base" disabled={pending || !rateStr.trim()}>
						{pending ? 'Saving…' : mode === 'create' ? 'Add rate' : 'Save changes'}
					</Button>
				</Sheet.Footer>
			</form>
		</div>
	</Sheet.Content>
</Sheet.Root>

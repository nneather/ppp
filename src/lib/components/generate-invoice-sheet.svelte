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
	import type { ClientOption, UnbilledBounds, UnbilledEntryPreview } from '$lib/types/invoicing';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	const THIS_WEEK_HEALTH = 'This Week Health';
	const FOUNTAIN_OF_LIFE = 'Fountain of Life Church';

	type FormMessage = { message?: string } | null | undefined;

	type OneOffDraft = {
		localId: string;
		description: string;
		quantity: string;
		unit_price: string;
		/** Charge date (YYYY-MM-DD); defaults to period end when adding a line. */
		date: string;
	};

	let {
		open = $bindable(false),
		clients,
		unbilledBounds = [],
		unbilledEntries = [],
		formMessage = null
	}: {
		open?: boolean;
		clients: ClientOption[];
		unbilledBounds?: UnbilledBounds[];
		unbilledEntries?: UnbilledEntryPreview[];
		formMessage?: FormMessage;
	} = $props();

	let clientId = $state('');
	let periodStart = $state('');
	let periodEnd = $state('');
	let sheetSide = $state<'bottom' | 'right'>('bottom');
	let pending = $state(false);
	let oneOffs = $state<OneOffDraft[]>([]);
	/** Avoid re-applying defaults when only period inputs change */
	let lastDefaultClientId = $state<string | null>(null);

	function pad2(n: number): string {
		return String(n).padStart(2, '0');
	}

	function toYMD(d: Date): string {
		return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
	}

	function parseYMD(s: string): Date | null {
		const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
		if (!m) return null;
		const y = Number(m[1]);
		const mo = Number(m[2]);
		const day = Number(m[3]);
		const d = new Date(y, mo - 1, day);
		if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
		return d;
	}

	function mondayOfWeekContaining(d: Date): Date {
		const day = d.getDay();
		const diffToMonday = (day + 6) % 7;
		return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diffToMonday);
	}

	function previousWeekMonSun(): { start: string; end: string } {
		const mon = mondayOfWeekContaining(new Date());
		const prevMon = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() - 7);
		const prevSun = new Date(prevMon.getFullYear(), prevMon.getMonth(), prevMon.getDate() + 6);
		return { start: toYMD(prevMon), end: toYMD(prevSun) };
	}

	function monthSpanFromBounds(
		minDateStr: string,
		maxDateStr: string
	): { start: string; end: string } {
		const minD = parseYMD(minDateStr);
		const maxD = parseYMD(maxDateStr);
		if (!minD || !maxD) {
			const t = new Date();
			const start = new Date(t.getFullYear(), t.getMonth(), 1);
			return { start: toYMD(start), end: toYMD(t) };
		}
		const start = new Date(minD.getFullYear(), minD.getMonth(), 1);
		const end = new Date(maxD.getFullYear(), maxD.getMonth() + 1, 0);
		return { start: toYMD(start), end: toYMD(end) };
	}

	function defaultMonthToDate(): { start: string; end: string } {
		const t = new Date();
		const start = new Date(t.getFullYear(), t.getMonth(), 1);
		return { start: toYMD(start), end: toYMD(t) };
	}

	function applyDefaultsForClient(cid: string) {
		const c = clients.find((x) => x.id === cid);
		const name = c?.name ?? '';

		if (name === THIS_WEEK_HEALTH) {
			const r = previousWeekMonSun();
			periodStart = r.start;
			periodEnd = r.end;
			return;
		}

		if (name === FOUNTAIN_OF_LIFE) {
			const b = unbilledBounds.find((x) => x.client_id === cid);
			if (b) {
				const r = monthSpanFromBounds(b.min_date, b.max_date);
				periodStart = r.start;
				periodEnd = r.end;
				return;
			}
		}

		const r = defaultMonthToDate();
		periodStart = r.start;
		periodEnd = r.end;
	}

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

	const oneOffsJson = $derived(
		JSON.stringify(
			oneOffs
				.filter(
					(o) => o.description.trim() || o.quantity.trim() || o.unit_price.trim() || o.date.trim()
				)
				.map((o) => {
					const dateRaw = o.date.trim();
					const date =
						dateRaw && parseYMD(dateRaw)
							? dateRaw
							: periodEnd && parseYMD(periodEnd)
								? periodEnd
								: '';
					return {
						date,
						description: o.description.trim(),
						quantity: Number(String(o.quantity).replace(',', '.')),
						unit_price: Number(String(o.unit_price).replace(',', '.'))
					};
				})
				.filter(
					(o) =>
						o.description &&
						Number.isFinite(o.quantity) &&
						Number.isFinite(o.unit_price) &&
						o.date &&
						parseYMD(o.date)
				)
		)
	);

	const hasValidOneOffs = $derived(oneOffsJson !== '[]' && oneOffsJson !== '');

	const rangePreview = $derived.by(() => {
		if (!clientId || !periodStart || !periodEnd || periodStart > periodEnd) {
			return { count: 0, hours: 0, amount: 0 };
		}
		let count = 0;
		let hours = 0;
		let amount = 0;
		for (const e of unbilledEntries) {
			if (e.client_id !== clientId) continue;
			if (e.date < periodStart || e.date > periodEnd) continue;
			count += 1;
			hours += e.hours;
			amount += e.hours * e.rate;
		}
		return {
			count,
			hours: Math.round(hours * 100) / 100,
			amount: Math.round(amount * 100) / 100
		};
	});

	const canSubmit = $derived(Boolean(clientId) && (rangePreview.count > 0 || hasValidOneOffs));

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
		if (!open) {
			lastDefaultClientId = null;
			return;
		}
		const first = clients[0]?.id ?? '';
		clientId = first;
		oneOffs = [];
		lastDefaultClientId = null;
	});

	$effect(() => {
		if (!open || !clientId) return;
		if (lastDefaultClientId === clientId) return;
		lastDefaultClientId = clientId;
		applyDefaultsForClient(clientId);
	});

	function addOneOff() {
		oneOffs = [
			...oneOffs,
			{
				localId: crypto.randomUUID(),
				description: '',
				quantity: '1',
				unit_price: '',
				date: periodEnd && parseYMD(periodEnd) ? periodEnd : ''
			}
		];
	}

	function removeOneOff(localId: string) {
		oneOffs = oneOffs.filter((o) => o.localId !== localId);
	}

	function money(n: number): string {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
	}

	const submitEnhance: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			await update();
			if (result.type === 'redirect') {
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
			sheetSide === 'right' && 'max-w-lg sm:max-w-lg'
		)}
	>
		<Sheet.Header class="border-b border-border px-4 pt-2 pb-4">
			<Sheet.Title>Generate invoice</Sheet.Title>
			<Sheet.Description class="text-muted-foreground">
				Choose client and billing period. Unbilled time entries in range become line items; add
				optional one-off lines.
			</Sheet.Description>
		</Sheet.Header>

		<div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
			{#if clients.length === 0}
				<p class="text-sm text-muted-foreground">
					No clients found. Seed clients in Supabase first.
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
					action="?/generate"
					use:enhance={submitEnhance}
					class="flex flex-col gap-5"
				>
					<input type="hidden" name="one_offs" value={oneOffsJson} />

					<div class="space-y-2">
						<Label for="gi-client">Client</Label>
						<Select.Root type="single" bind:value={clientId} items={selectItems}>
							<Select.Trigger
								id="gi-client"
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

					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<Label for="gi-start">Period start</Label>
							<Input
								id="gi-start"
								name="period_start"
								type="date"
								bind:value={periodStart}
								class="h-12 min-h-12 text-base"
								required
							/>
						</div>
						<div class="space-y-2">
							<Label for="gi-end">Period end</Label>
							<Input
								id="gi-end"
								name="period_end"
								type="date"
								bind:value={periodEnd}
								class="h-12 min-h-12 text-base"
								required
							/>
						</div>
					</div>

					<input type="hidden" name="client_id" value={clientId} />

					<div
						class="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground"
						aria-live="polite"
					>
						{#if rangePreview.count > 0}
							<p class="tabular-nums">
								<strong>{rangePreview.count}</strong> unbilled
								{rangePreview.count === 1 ? 'entry' : 'entries'} in this range —{' '}
								<strong>{rangePreview.hours}</strong>h,
								<strong>{money(rangePreview.amount)}</strong>
							</p>
						{:else}
							<p class="text-amber-800 dark:text-amber-200/90">
								No unbilled entries in this date range for this client. Add one-off lines below or
								adjust the period.
							</p>
						{/if}
					</div>

					<div class="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
						<div class="flex items-center justify-between gap-2">
							<p class="text-sm font-medium text-foreground">One-off line items</p>
							<Button type="button" variant="outline" size="sm" class="gap-1" onclick={addOneOff}>
								<Plus class="size-4" />
								Add line
							</Button>
						</div>
						<p class="text-xs text-muted-foreground">
							Optional. Set charge date, quantity × unit price (e.g. fixed fee). Included in the
							same invoice.
						</p>
						{#if oneOffs.length === 0}
							<p class="text-sm text-muted-foreground">No one-off lines.</p>
						{:else}
							<ul class="space-y-3">
								{#each oneOffs as o (o.localId)}
									<li class="rounded-md border border-border bg-background p-3">
										<div class="mb-2 flex justify-end">
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												class="text-muted-foreground"
												aria-label="Remove line"
												onclick={() => removeOneOff(o.localId)}
											>
												<Trash2 class="size-4" />
											</Button>
										</div>
										<div class="space-y-2">
											<Label class="text-xs" for="desc-{o.localId}">Description</Label>
											<Input
												id="desc-{o.localId}"
												bind:value={o.description}
												class="text-base"
												placeholder="e.g. Rush fee"
											/>
										</div>
										<div class="mt-2 space-y-2">
											<Label class="text-xs" for="date-{o.localId}">Charge date</Label>
											<Input
												id="date-{o.localId}"
												type="date"
												bind:value={o.date}
												class="h-11 min-h-11 text-base"
											/>
										</div>
										<div class="mt-2 grid grid-cols-2 gap-2">
											<div>
												<Label class="text-xs" for="qty-{o.localId}">Quantity</Label>
												<Input
													id="qty-{o.localId}"
													bind:value={o.quantity}
													type="number"
													inputmode="decimal"
													step="any"
													min="0"
													class="tabular-nums"
												/>
											</div>
											<div>
												<Label class="text-xs" for="price-{o.localId}">Unit price</Label>
												<Input
													id="price-{o.localId}"
													bind:value={o.unit_price}
													type="number"
													inputmode="decimal"
													step="0.01"
													min="0"
													class="tabular-nums"
												/>
											</div>
										</div>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<Sheet.Footer class="mt-2 flex-col gap-2 border-0 p-0 sm:flex-col">
						<Button type="submit" class="h-12 w-full text-base" disabled={pending || !canSubmit}>
							{pending ? 'Generating…' : 'Generate draft invoice'}
						</Button>
					</Sheet.Footer>
				</form>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
